import logging
import select


class SocketWatcher:
    """A lightweight wrapper around select.epoll"""

    def __init__(self):
        self._logger = logging.getLogger(__name__)
        self._epoll = select.epoll()

        #  _sockets: dict(sockOrFd -> tuple(fd: int, canRead: bool, canWrite: bool))
        self._sockets = {}

        # _fdToSocketObj: dict(fd: int -> sockOrFd)
        self._fdToSocketObj = {}

    @staticmethod
    def fdForSockOrFd(sockOrFd):
        if isinstance(sockOrFd, int):
            return sockOrFd
        else:
            return sockOrFd.fileno()

    @staticmethod
    def eventMask(forRead: bool, forWrite: bool):
        readMask = select.EPOLLIN if forRead else 0
        writeMask = select.EPOLLOUT if forWrite else 0
        return readMask | writeMask

    def canRead(self, sockOrFd) -> bool:
        if sockOrFd in self._sockets:
            fd, canRead, canWrite = self._sockets[sockOrFd]
            return canRead

        else:
            return False

    def canWrite(self, sockOrFd) -> bool:
        if sockOrFd in self._sockets:
            fd, canRead, canWrite = self._sockets[sockOrFd]
            return canWrite

        else:
            return False

    def __contains__(self, sockOrFd):
        return sockOrFd in self._sockets

    def gc(self):
        """Garbage-Collect any closed sockets."""
        sockets = []

        for sock in list(self._sockets.keys()):
            if self.fdForSockOrFd(sock) < 0:
                self.discard(sock, True, True)
                sockets.append(sock)

        return sockets

    def add(self, sockOrFd, addRead: bool, addWrite: bool) -> bool:
        """Start watching the given socket or filedescriptor.

        Args:
            sockOrFd - must be an int or an object with 'fileno'
        """
        fd = self.fdForSockOrFd(sockOrFd)
        if fd < 0:
            if sockOrFd in self._sockets:
                self.discard(sockOrFd, True, True)

            return False

        if sockOrFd not in self._sockets:
            try:
                self._epoll.register(fd, self.eventMask(addRead, addWrite))

            except Exception as e:
                self._logger.error(
                    f"Failed to register socket {sockOrFd} with FD={fd}: {str(e)}"
                )
                return False

            else:
                self._sockets[sockOrFd] = (fd, addRead, addWrite)
                self._fdToSocketObj[fd] = sockOrFd
                return True

        else:
            currFd, currRead, currWrite = self._sockets[sockOrFd]

            if fd != currFd:
                self.discard(sockOrFd, True, True)
                return self.add(sockOrFd, addRead, addWrite)

            else:
                # we may be adding read or write to a socket
                forRead = addRead or currRead
                forWrite = addWrite or currWrite

                if currRead != forRead or currWrite != forWrite:
                    try:
                        self._epoll.modify(fd, self.eventMask(forRead, forWrite))

                    except Exception:
                        self._logger.error(f"Failed to modify socket {sockOrFd} with FD={fd}.")
                        return False

                    else:
                        self._sockets[sockOrFd] = (fd, forRead, forWrite)
                        return True

    def addForRead(self, socketOrFd) -> bool:
        return self.add(socketOrFd, True, False)

    def addForWrite(self, socketOrFd) -> bool:
        return self.add(socketOrFd, False, True)

    def poll(self, timeout=None):
        """Return a list of the sockets that have pending data.

        The response will contain the object or integer you originally passed.
        """
        events = self._epoll.poll(timeout)

        socketsReadable = set()
        socketsWriteable = set()

        for fd, eventMask in events:
            if eventMask & select.EPOLLIN:
                socketsReadable.add(self._fdToSocketObj[fd])
            if eventMask & select.EPOLLOUT:
                socketsWriteable.add(self._fdToSocketObj[fd])

        return socketsReadable, socketsWriteable

    def discardForRead(self, socketOrFd) -> bool:
        return self.discard(socketOrFd, True, False)

    def discardForWrite(self, socketOrFd) -> bool:
        return self.discard(socketOrFd, False, True)

    def discard(self, sockOrFd, discardRead: bool = True, discardWrite: bool = True) -> bool:
        if sockOrFd in self._sockets:
            curFd, currRead, currWrite = self._sockets[sockOrFd]
            forRead = False if discardRead else currRead
            forWrite = False if discardWrite else currWrite
            fd = self.fdForSockOrFd(sockOrFd)

            if fd < 0 or (not forRead and not forWrite):
                # remove socket completely
                self._sockets.pop(sockOrFd)
                self._fdToSocketObj.pop(curFd)

                try:
                    self._epoll.unregister(curFd)

                except Exception:
                    if fd >= 0:
                        self._logger.exception(f"INFO: Failed to unregister FD={curFd}")

                return True

            elif forRead != currRead or forWrite != currWrite:
                # modify socket
                self._sockets[sockOrFd] = (curFd, forRead, forWrite)

                try:
                    self._epoll.modify(curFd, self.eventMask(forRead, forWrite))
                    return True

                except Exception:
                    self._logger.error(f"Failed to modify socket {sockOrFd} with FD={curFd}.")

        else:
            return False

    def teardown(self):
        self._epoll.close()
        self._sockets = {}
        self._fdToSocketObj = {}

    def __len__(self):
        return len(self._fdToSocketObj)
