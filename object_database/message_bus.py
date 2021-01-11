#   Copyright 2017-2019 object_database Authors
#
#   Licensed under the Apache License, Version 2.0 (the "License");
#   you may not use this file except in compliance with the License.
#   You may obtain a copy of the License at
#
#       http://www.apache.org/licenses/LICENSE-2.0
#
#   Unless required by applicable law or agreed to in writing, software
#   distributed under the License is distributed on an "AS IS" BASIS,
#   WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
#   See the License for the specific language governing permissions and
#   limitations under the License.

"""message_bus

Classes for maintaining a strongly-typed message bus over sockets,
along with classes to simulate this in tests.
"""

import ssl
import time
import threading
import queue
import struct
import logging
import select
import os
import socket
import sortedcontainers

from typed_python import Alternative, NamedTuple, TypeFunction, serialize, deserialize

from object_database.util import sslContextFromCertPathOrNone
from object_database.bytecount_limited_queue import BytecountLimitedQueue

MESSAGE_LEN_BYTES = 4  # sizeof an int32 used to pack messages
SELECT_TIMEOUT = 5.0
MSG_BUF_SIZE = 128 * 1024


class MessageBusLoopExit(Exception):
    pass


class MessageBuffer:
    def __init__(self, extraMessageSizeCheck):
        # the buffer we're reading
        self.buffer = bytearray()
        self.messagesEver = 0
        self.extraMessageSizeCheck = extraMessageSizeCheck

        # the current message length, if any.
        self.curMessageLen = None

    def pendingBytecount(self):
        return len(self.buffer)

    @staticmethod
    def encode(bytes, extraMessageSizeCheck):
        """Prepend a message-length prefix"""
        res = bytearray(struct.pack("i", len(bytes)))
        res.extend(bytes)

        if extraMessageSizeCheck:
            res.extend(struct.pack("i", len(bytes)))

        return res

    def write(self, bytesToWrite):
        """Push bytes into the buffer and read any completed messages.

        Args:
            bytesToWrite (bytes) - a portion of the message stream

        Returns:
            A list of messages completed by the bytes.
        """
        messages = []

        self.buffer.extend(bytesToWrite)

        while True:
            if self.curMessageLen is None:
                if len(self.buffer) >= MESSAGE_LEN_BYTES:
                    self.curMessageLen = struct.unpack("i", self.buffer[:MESSAGE_LEN_BYTES])[0]
                    self.buffer[:MESSAGE_LEN_BYTES] = b""

            if self.curMessageLen is None:
                return messages

            if self.extraMessageSizeCheck:
                if len(self.buffer) >= self.curMessageLen + MESSAGE_LEN_BYTES:
                    messages.append(bytes(self.buffer[: self.curMessageLen]))
                    self.messagesEver += 1
                    checkSize = struct.unpack(
                        "i",
                        self.buffer[
                            self.curMessageLen : self.curMessageLen + MESSAGE_LEN_BYTES
                        ],
                    )[0]
                    assert (
                        checkSize == self.curMessageLen
                    ), f"Corrupt message stream: {checkSize} != {self.curMessageLen}"

                    self.buffer[: self.curMessageLen + MESSAGE_LEN_BYTES] = b""
                    self.curMessageLen = None
                else:
                    return messages
            else:
                if len(self.buffer) >= self.curMessageLen:
                    messages.append(bytes(self.buffer[: self.curMessageLen]))
                    self.messagesEver += 1
                    self.buffer[: self.curMessageLen] = b""
                    self.curMessageLen = None
                else:
                    return messages


class Disconnected:
    """A singleton representing our disconnect state."""


class FailedToStart(Exception):
    """We failed to acquire the listening socket."""


class TriggerDisconnect:
    """A singleton for triggering a channel to disconnect."""


class TriggerConnect:
    """A singleton for signaling we should connect to a channel."""


Endpoint = NamedTuple(host=str, port=int)


ConnectionId = NamedTuple(id=int)


@TypeFunction
def MessageBusEvent(MessageType):
    return Alternative(
        "MessageBusEvent",
        # the entire bus was stopped (by us). This is always the last message
        Stopped=dict(),
        # someone connected to us. All messages sent on this particular socket connectionId
        # will be associated with the given connectionId.
        NewIncomingConnection=dict(source=Endpoint, connectionId=ConnectionId),
        # an incoming connection closed
        IncomingConnectionClosed=dict(connectionId=ConnectionId),
        # someone sent us a message one one of our channels
        IncomingMessage=dict(connectionId=ConnectionId, message=MessageType),
        # we made a new outgoing connection. this connection is also
        # valid as an input connection (we may receive messages on it)
        OutgoingConnectionEstablished=dict(connectionId=ConnectionId),
        # an outgoing connection failed
        OutgoingConnectionFailed=dict(connectionId=ConnectionId),
        # an outgoing connection closed
        OutgoingConnectionClosed=dict(connectionId=ConnectionId),
    )


class MessageBus(object):
    def __init__(
        self,
        busIdentity,
        endpoint,
        inMessageType,
        outMessageType,
        onEvent,
        authToken=None,
        serializationContext=None,
        certPath=None,
        wantsSSL=True,
        sslContext=None,
        extraMessageSizeCheck=True,
    ):
        """Initialize a MessageBus

        Args:
            busIdentity: any object that identifies this message bus
            endpoint: a (host, port) tuple that we're supposed to listen on,
                or None if we accept no incoming.
            inMessageType: the wire-type of messages we receive. Can be 'object', in
                which case we'll require a serializationContext to know how
                to serialize the names of types.
            outMessageType: the wire-type of messages we send. Can be 'object', in
                which case we'll require a serializationContext to know how
                to serialize the names of types.
            serializationContext: the serialization context to use for
                serializing things, or None to use naked serialization
                from typed_python without any 'object'.
            authToken: the authentication token that must be sent to us for
                the connection to succeed. If None, then don't require
                authentication. MessageBus objects must have the same
                authToken to work together.
            onEvent: a callback function recieving a stream of 'eventType'
                objects (MessageBusEvents).
            certPath(str or None): if we use SSL, an optional path to a cert file.
            wantsSSL(bool): should we encrypt our channel with SSL
            sslContext - an SSL context if we've already got one

        The MessageBus listens for connection on the endpoint and calls
        onEvent from the read thread whenever a new event occurs.

        Clients may establish connection to other MessageBus objects, and
        will receive a ConnectionId object representing that channel.
        Other clients connecting in will produce their own 'ConnectionId's
        associated with the incoming connection. ConnectionIds are unique
        for a given MessageBus instance.

        Clients may send messages to outgoing connections that have been
        established or to other incoming connections.
        The send function indicates whether the send _might_ succeed,
        meaning it returns False only if it's KNOWN that the message
        channel on the other side is closed.

        All event callbacks are fired from the same internal thread.
        This function should never throw, and if it blocks, it will
        block execution across all threads.

        Clients are expected to call 'start' to start the bus, and 'stop'
        to stop it and tear down threads.

        Clients can call 'connect' to get a connection id back, which they
        can pass to 'closeConnection' or 'sendMessage'.
        """
        if authToken is not None:
            assert isinstance(authToken, str), (authToken, type(authToken))

        self._logger = logging.getLogger(__file__)

        self.busIdentity = busIdentity

        self._certPath = certPath
        self.onEvent = onEvent
        self.serializationContext = serializationContext
        self.inMessageType = inMessageType
        self.outMessageType = outMessageType
        self.eventType = MessageBusEvent(inMessageType)
        self._eventQueue = queue.Queue()
        self._authToken = authToken
        self._listeningEndpoint = Endpoint(endpoint) if endpoint is not None else None
        self._lock = threading.RLock()
        self.started = False
        self._acceptSocket = None
        self.extraMessageSizeCheck = extraMessageSizeCheck

        self._connIdToIncomingSocket = {}  # connectionId -> socket
        self._connIdToOutgoingSocket = {}  # connectionId -> socket

        self._socketToIncomingConnId = {}  # socket -> connectionId
        self._socketToOutgoingConnId = {}  # socket -> connectionId

        self._unauthenticatedConnections = set()
        self._connIdToIncomingEndpoint = {}  # connectionId -> Endpoint
        self._connIdToOutgoingEndpoint = {}  # connectionId -> Endpoint
        self._connIdPendingOutgoingConnection = set()
        self._messagesForUnconnectedOutgoingConnection = {}  # connectionId- > [bytes]

        self._messageToSendWakePipe = None
        self._eventToFireWakePipe = None
        self._generalWakePipe = None

        self._currentlyClosingConnections = (
            set()
        )  # set of ConnectionId, while we are closing them

        # how many bytes do we actually have in our deserialized pump loop
        # waiting to be sent down the wire.
        self.totalBytesPendingInOutputLoop = 0

        # how many bytes have we actually written (to anybody)
        self.totalBytesWritten = 0

        # how many bytes are in the deserialization queue that have not
        # created full messages.
        self.totalBytesPendingInInputLoop = 0
        self.totalBytesPendingInInputLoopHighWatermark = 0

        # how many bytes have we actually read (from anybody)
        self.totalBytesRead = 0

        self._connectionIdCounter = 0

        # queue of messages to write to other endpoints
        self._messagesToSendQueue = BytecountLimitedQueue(self._bytesPerMsg)
        self._eventsToFireQueue = queue.Queue()

        self._socketThread = threading.Thread(target=self._socketThreadLoop)
        self._eventThread = threading.Thread(target=self._eventThreadLoop)
        self._socketThread.daemon = True
        self._eventThread.daemon = True
        self._wantsSSL = wantsSSL
        self._sslContext = sslContext

        # socket -> bytes that need to be written
        self._socketToBytesNeedingWrite = {}
        self._socketsWithSslWantWrite = set()

        # set of sockets currently readable
        self._allReadSockets = set()

        # dict from 'socket' object to MessageBuffer
        self._incomingSocketBuffers = {}

        if self._wantsSSL:
            if self._sslContext is None:
                self._sslContext = sslContextFromCertPathOrNone(self._certPath)
        else:
            assert (
                self._certPath is None
            ), "Makes no sense to give a cert path and not request ssl"
            assert (
                self._sslContext is None
            ), "Makes no sense to give an ssl context and not request ssl"

        # a set of (timestamp, callback) pairs of callbacks we're supposed
        # to fire on the output thread.
        self._pendingTimedCallbacks = sortedcontainers.SortedSet(
            key=lambda tsAndCallback: tsAndCallback[0]
        )

    @property
    def listeningEndpoint(self):
        return self._listeningEndpoint

    def setMaxWriteQueueSize(self, queueSize):
        """Insist that we block any _sending_ threads if our outgoing queue gets too large."""
        self._messagesToSendQueue.setMaxBytes(queueSize)

    def isWriteQueueBlocked(self):
        return self._messagesToSendQueue.isBlocked()

    def start(self):
        """
        Start the message bus. May create threads and connect sockets.
        """
        assert not self.started

        if not self._setupAcceptSocket():
            raise FailedToStart()

        # allocate the pipes that we use to wake our select loop.
        self._messageToSendWakePipe = os.pipe()
        self._eventToFireWakePipe = os.pipe()
        self._generalWakePipe = os.pipe()

        self.started = True
        self._socketThread.start()
        self._eventThread.start()

    def stop(self, timeout=None):
        """
        Stop the message bus.

        This bus may not be started again. Client threads blocked reading on the bus
        will return immediately with no message.
        """
        with self._lock:
            if not self.started:
                return
            self.started = False

        self._logger.debug(
            "Stopping MessageBus (%s) on endpoint %s",
            self.busIdentity,
            self._listeningEndpoint,
        )

        self._messagesToSendQueue.put(Disconnected)
        self._scheduleEvent(self.eventType.Stopped())

        self._socketThread.join(timeout=timeout)

        if self._socketThread.is_alive():
            raise Exception("Failed to shutdown our threads!")

        # shutdown the event loop after the threadloops, so that we're guaranteed
        # that we fire the shutdown events.
        self._eventQueue.put(None)
        self._eventThread.join(timeout=timeout)

        if self._eventThread.is_alive():
            raise Exception("Failed to shutdown our threads!")

        if self._acceptSocket is not None:
            self._ensureSocketClosed(self._acceptSocket)

        def closePipe(fdPair):
            os.close(fdPair[0])
            os.close(fdPair[1])

        closePipe(self._messageToSendWakePipe)
        closePipe(self._eventToFireWakePipe)
        closePipe(self._generalWakePipe)

        for sock in self._connIdToIncomingSocket.values():
            self._ensureSocketClosed(sock)

        for sock in self._connIdToOutgoingSocket.values():
            self._ensureSocketClosed(sock)

    def connect(self, endpoint: Endpoint) -> ConnectionId:
        """Make a connection to another endpoint and return a ConnectionId for it.

        You can send messages on this ConnectionId immediately.

        Args:
            endpoint (Endpoint) - the host/port to connect to

        Returns:
            a ConnectionId representing the connection.
        """
        if not self.started:
            raise Exception(f"Bus {self.busIdentity} is not active")

        endpoint = Endpoint(endpoint)

        connId = self._newConnectionId()

        with self._lock:
            self._connIdToOutgoingEndpoint[connId] = endpoint
            self._connIdPendingOutgoingConnection.add(connId)

        self._putOnSendQueue(connId, TriggerConnect)

        return connId

    def _putOnSendQueue(self, connectionId, msg):
        self._messagesToSendQueue.put((connectionId, msg))
        assert os.write(self._messageToSendWakePipe[1], b" ") == 1

    def scheduleCallback(self, callback, *, atTimestamp=None, delay=None):
        """Schedule a callback to fire on the message read thread.

        Use 'delay' or 'atTimestamp' to decide when the callback runs, or
        use neither to mean 'immediately'. You can't use both.

        Args:
            atTimestamp - the earliest posix timestamp to run the callback on
            delay - the amount of time until we fire the callback.
        """
        with self._lock:
            assert atTimestamp is None or delay is None

            if atTimestamp is None:
                atTimestamp = time.time() + (delay or 0.0)

            self._pendingTimedCallbacks.add((atTimestamp, callback))

            # if we put this on the front of the queue, we need to wake
            # the thread loop
            if self._pendingTimedCallbacks[0][0] == atTimestamp:
                assert os.write(self._generalWakePipe[1], b" ") == 1

    def sendMessage(self, connectionId, message):
        """Send a message to another endpoint endpoint.

        Send a message and return immediately (before guaranteeding we've sent
        the message). This function may block if we have too much outgoing data on the wire,
        but doesn't have to.

        Args:
            targetEndpoint - a host and port tuple.
            message - a message of type (self.MessageType) to send to the other endpoint.

        Returns:
            True if the message was queued, False if we preemptively dropped it because the
            other endpoint is disconnected.
        """
        if not self.started:
            raise Exception(f"Bus {self.busIdentity} is not active")

        if self.serializationContext is None:
            serializedMessage = serialize(self.outMessageType, message)
        else:
            serializedMessage = self.serializationContext.serialize(
                message, serializeType=self.outMessageType
            )

        with self._lock:
            isDefinitelyDead = (
                connectionId not in self._connIdToOutgoingEndpoint
                and connectionId not in self._connIdToIncomingEndpoint
            )

        if isDefinitelyDead:
            return False

        self._putOnSendQueue(connectionId, serializedMessage)

        return True

    def closeConnection(self, connectionId):
        """Trigger a connection close."""
        with self._lock:
            isDefinitelyDead = (
                connectionId not in self._connIdToOutgoingEndpoint
                and connectionId not in self._connIdToIncomingEndpoint
            )

        if isDefinitelyDead:
            return

        self._putOnSendQueue(connectionId, TriggerDisconnect)

    def _newConnectionId(self):
        with self._lock:
            self._connectionIdCounter += 1
            return ConnectionId(id=self._connectionIdCounter)

    def _bytesPerMsg(self, msg):
        if not isinstance(msg, tuple):
            return 0

        if msg[1] is TriggerConnect or msg[1] is TriggerDisconnect:
            return 0

        return len(msg[1])

    def _scheduleEvent(self, event):
        """Schedule an event to get sent to the onEvent callback on the input loop"""
        self._eventsToFireQueue.put(event)
        assert os.write(self._eventToFireWakePipe[1], b" ") == 1

    def _setupAcceptSocket(self):
        assert not self.started

        if self._listeningEndpoint is None:
            return True

        sock = socket.socket(socket.AF_INET, socket.SOCK_STREAM, 0)
        sock.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)

        try:
            sock.bind((self._listeningEndpoint.host, self._listeningEndpoint.port))
            sock.listen(2048)
            sock.setsockopt(socket.IPPROTO_TCP, socket.TCP_NODELAY, True)

            # if we listen on port zero, we need to get the port assigned
            # by the operating system
            if self._listeningEndpoint.port == 0:
                self._listeningEndpoint = Endpoint(
                    host=self._listeningEndpoint.host, port=sock.getsockname()[1]
                )

            with self._lock:
                self._acceptSocket = sock

                self._logger.debug(
                    "%s listening on %s:%s",
                    self.busIdentity,
                    self._listeningEndpoint[0],
                    self._listeningEndpoint[1],
                )

                return True

        except OSError:
            sock.close()

        return False

    def _scheduleBytesForWrite(self, connId, bytes):
        if not bytes:
            return

        if connId in self._currentlyClosingConnections:
            return
        if connId in self._connIdToOutgoingSocket:
            sslSock = self._connIdToOutgoingSocket.get(connId)
        elif connId in self._connIdToIncomingSocket:
            sslSock = self._connIdToIncomingSocket.get(connId)
        else:
            # we're not connected yet, so we can't put this on the buffer
            # so instead, put it on a pending buffer.
            if connId not in self._connIdPendingOutgoingConnection:
                # if we don't have one, it's because we disconnected
                return

            with self._lock:
                self._messagesForUnconnectedOutgoingConnection.setdefault(connId, []).append(
                    bytes
                )

            return

        bytes = MessageBuffer.encode(bytes, self.extraMessageSizeCheck)

        self.totalBytesPendingInOutputLoop += len(bytes)

        if sslSock not in self._socketToBytesNeedingWrite:
            self._socketToBytesNeedingWrite[sslSock] = bytearray(bytes)
        else:
            self._socketToBytesNeedingWrite[sslSock].extend(bytes)

    def _handleReadReadySocket(self, socketWithData):
        """Our select loop indicated 'socketWithData' has data pending."""
        if socketWithData is self._acceptSocket:
            newSocket, newSocketSource = socketWithData.accept()
            newSocket.setsockopt(socket.IPPROTO_TCP, socket.TCP_NODELAY, True)
            newSocket.setblocking(False)

            if self._wantsSSL:
                newSocket = self._sslContext.wrap_socket(
                    newSocket, server_side=True, do_handshake_on_connect=False
                )

            self._allReadSockets.add(newSocket)

            with self._lock:
                connId = self._newConnectionId()

            with self._lock:
                if self._authToken is not None:
                    self._unauthenticatedConnections.add(connId)
                self._connIdToIncomingSocket[connId] = newSocket
                self._socketToIncomingConnId[newSocket] = connId
                self._connIdToIncomingEndpoint[connId] = newSocketSource

                self._incomingSocketBuffers[newSocket] = MessageBuffer(
                    self.extraMessageSizeCheck
                )

            self._fireEvent(
                self.eventType.NewIncomingConnection(
                    source=Endpoint(newSocketSource), connectionId=connId
                )
            )

            return True
        elif socketWithData in self._allReadSockets:
            try:
                bytesReceived = socketWithData.recv(MSG_BUF_SIZE)
            except ssl.SSLWantReadError:
                bytesReceived = None
            except ssl.SSLWantWriteError:
                self._socketsWithSslWantWrite.add(socketWithData)
            except ConnectionResetError:
                bytesReceived = b""
            except Exception:
                self._logger.exception("MessageBus read socket shutting down")
                bytesReceived = b""

            if bytesReceived is None:
                # do nothing
                pass
            elif bytesReceived == b"":
                self._markSocketClosed(socketWithData)
                self._allReadSockets.discard(socketWithData)
                del self._incomingSocketBuffers[socketWithData]
                return True
            else:
                self.totalBytesRead += len(bytesReceived)

                oldBytecount = self._incomingSocketBuffers[socketWithData].pendingBytecount()
                newMessages = self._incomingSocketBuffers[socketWithData].write(bytesReceived)

                self.totalBytesPendingInInputLoop += (
                    self._incomingSocketBuffers[socketWithData].pendingBytecount()
                    - oldBytecount
                )

                self.totalBytesPendingInInputLoopHighWatermark = max(
                    self.totalBytesPendingInInputLoop,
                    self.totalBytesPendingInInputLoopHighWatermark,
                )

                for m in newMessages:
                    if not self._handleIncomingMessage(m, socketWithData):
                        self._markSocketClosed(socketWithData)
                        self._allReadSockets.discard(socketWithData)
                        del self._incomingSocketBuffers[socketWithData]
                        break

                return True
        else:
            self._logger.warning(
                "MessageBus got data on a socket it didn't know about: %s", socketWithData
            )

    def _socketThreadLoop(self):
        selectsWithNoUpdate = 0
        try:
            while True:
                # don't read from the serialization queue unless we can handle the
                # bytes in our 'self.totalBytesPendingInOutputLoop' flow
                canRead = (
                    self._messagesToSendQueue.maxBytes is None
                    or self.totalBytesPendingInOutputLoop < self._messagesToSendQueue.maxBytes
                )

                # before going to sleep, flush any callbacks that need to fire. Note that
                # we do this only if we're allowed to read messages also
                if canRead:
                    maxSleepTime = self.consumeCallbacksOnOutputThread()
                    if maxSleepTime is None:
                        maxSleepTime = SELECT_TIMEOUT
                else:
                    maxSleepTime = SELECT_TIMEOUT

                readableSockets = list(self._allReadSockets)
                if self._acceptSocket is not None:
                    readableSockets.append(self._acceptSocket)
                readableSockets.append(self._generalWakePipe[0])
                readableSockets.append(self._eventToFireWakePipe[0])

                if canRead:
                    # only listen on this socket if we can actually absorb more
                    # data. if we cant we'll wake up in SELECT_TIMEOUT seconds, after
                    # which something should have flushed
                    readableSockets.append(self._messageToSendWakePipe[0])

                try:
                    writeableSelectSockets = set(self._socketsWithSslWantWrite)

                    # if we're just spinning making no progress, don't bother
                    if selectsWithNoUpdate < 10:
                        writeableSelectSockets = set(self._socketToBytesNeedingWrite)

                    readReady, writeReady = select.select(
                        readableSockets,
                        writeableSelectSockets,
                        [],
                        min(maxSleepTime, SELECT_TIMEOUT),
                    )[:2]

                    if time.time() > 0.01:
                        selectsWithNoUpdate = 0

                except ValueError:
                    # one of the sockets must have failed
                    def filenoFor(socketOrFd):
                        if isinstance(socketOrFd, int):
                            return socketOrFd
                        else:
                            return socketOrFd.fileno()

                    failedSockets = [
                        s for s in self._socketToBytesNeedingWrite if filenoFor(s) < 0
                    ] + [s for s in readableSockets if filenoFor(s) < 0]

                    if not failedSockets:
                        # if not, then we don't have a good understanding of why this happened
                        raise

                    readReady = []
                    writeReady = []

                    for s in failedSockets:
                        if s in self._socketToBytesNeedingWrite:
                            del self._socketToBytesNeedingWrite[s]
                else:
                    writeReady.extend(self._socketsWithSslWantWrite)

                    self._socketsWithSslWantWrite.clear()

                    didSomething = False

                    for socketWithData in readReady:
                        if socketWithData == self._messageToSendWakePipe[0]:
                            self._handleMessageToSendWakePipe()
                            didSomething = True
                        elif socketWithData == self._eventToFireWakePipe[0]:
                            self._handleEventToFireWakePipe()
                            didSomething = True
                        elif socketWithData == self._generalWakePipe[0]:
                            self._handleGeneralWakePipe()
                            didSomething = True
                        else:
                            if self._handleReadReadySocket(socketWithData):
                                didSomething = True

                    for writeable in writeReady:
                        if self._handleWriteReadySocket(writeable):
                            didSomething = True

                    if didSomething:
                        selectsWithNoUpdate = 0
                    else:
                        selectsWithNoUpdate += 1

        except MessageBusLoopExit:
            self._logger.debug("Socket loop for MessageBus exiting gracefully")
        except Exception:
            self._logger.exception("Socket loop for MessageBus failed")

    def _handleMessageToSendWakePipe(self):
        for receivedMsgTrigger in os.read(self._messageToSendWakePipe[0], MSG_BUF_SIZE):
            self._handleMessageToSend()

    def _handleEventToFireWakePipe(self):
        for receivedMsgTrigger in os.read(self._eventToFireWakePipe[0], MSG_BUF_SIZE):
            self._handleEventToFire()

    def _handleGeneralWakePipe(self):
        os.read(self._generalWakePipe[0], MSG_BUF_SIZE)

    def _handleMessageToSend(self):
        connectionAndMsg = self._messagesToSendQueue.get(timeout=0.0)

        if connectionAndMsg is Disconnected:
            return

        if connectionAndMsg is not None:
            connId, msg = connectionAndMsg

            if msg is TriggerDisconnect:
                # take this message, and make sure we never put this
                # socket in the selectloop again.
                if connId in self._socketToBytesNeedingWrite:
                    del self._socketToBytesNeedingWrite[connId]

                with self._lock:
                    self._currentlyClosingConnections.add(connId)

                # Then trigger the socket loop to remove it and gracefully close it.
                self._scheduleEvent((connId, TriggerDisconnect))

            elif msg is TriggerConnect:
                # we're supposed to connect to this worker. We have to do
                # this in a background.

                # preschedule the auth token write. When we connect we'll send it
                # immediately
                if self._authToken is not None:
                    self._scheduleBytesForWrite(connId, self._authToken.encode("utf8"))

                self.scheduleCallback(lambda: self._connectTo(connId))
            else:
                self._scheduleBytesForWrite(connId, msg)

    def _handleEventToFire(self):
        # one message should be on the queue for each "E" msg trigger on the
        # thread pipe
        readMessage = self._eventsToFireQueue.get_nowait()

        if isinstance(readMessage, tuple) and readMessage[1] is TriggerDisconnect:
            connIdToClose = readMessage[0]

            if connIdToClose in self._connIdToIncomingSocket:
                socket = self._connIdToIncomingSocket[connIdToClose]
            elif connIdToClose in self._connIdToOutgoingSocket:
                socket = self._connIdToOutgoingSocket[connIdToClose]
            else:
                socket = None

            if socket is not None:
                self._markSocketClosed(socket)
                self._allReadSockets.discard(socket)
                del self._incomingSocketBuffers[socket]
                self._currentlyClosingConnections.discard(socket)
        else:
            assert isinstance(readMessage, self.eventType)
            self._fireEvent(readMessage)

            if readMessage.matches.Stopped:
                # this is the only valid way to exit the loop
                raise MessageBusLoopExit()

            elif readMessage.matches.OutgoingConnectionEstablished:
                sock = self._connIdToOutgoingSocket.get(readMessage.connectionId)
                if sock is not None:
                    self._allReadSockets.add(sock)
                    self._incomingSocketBuffers[sock] = MessageBuffer(
                        self.extraMessageSizeCheck
                    )

    def _handleWriteReadySocket(self, writeable):
        """Socket 'writeable' can accept more bytes."""
        if writeable not in self._socketToBytesNeedingWrite:
            return

        try:
            bytesWritten = writeable.send(self._socketToBytesNeedingWrite[writeable])
        except ssl.SSLWantReadError:
            bytesWritten = -1
        except ssl.SSLWantWriteError:
            self._socketsWithSslWantWrite.add(writeable)
            bytesWritten = -1
        except OSError:
            bytesWritten = 0
        except BrokenPipeError:
            bytesWritten = 0
        except Exception:
            self._logger.exception(
                "MessageBus write socket shutting down because of exception"
            )
            bytesWritten = 0

        if bytesWritten > 0:
            self.totalBytesPendingInOutputLoop -= bytesWritten
            self.totalBytesWritten += bytesWritten

        if bytesWritten == 0:
            # the primary socket close pathway is in the socket handler.
            del self._socketToBytesNeedingWrite[writeable]
        elif bytesWritten == -1:
            # do nothing
            pass
        else:
            self._socketToBytesNeedingWrite[writeable][:bytesWritten] = b""

            if not self._socketToBytesNeedingWrite[writeable]:
                # we have no bytes to flush
                del self._socketToBytesNeedingWrite[writeable]

            return True

    def _ensureSocketClosed(self, sock):
        try:
            sock.close()
        except OSError:
            pass

    def _markSocketClosed(self, socket):
        toFire = []

        with self._lock:
            if socket in self._socketToIncomingConnId:
                connId = self._socketToIncomingConnId[socket]
                del self._socketToIncomingConnId[socket]
                del self._connIdToIncomingSocket[connId]
                del self._connIdToIncomingEndpoint[connId]
                self._unauthenticatedConnections.discard(connId)
                toFire.append(self.eventType.IncomingConnectionClosed(connectionId=connId))
            elif socket in self._socketToOutgoingConnId:
                connId = self._socketToOutgoingConnId[socket]
                del self._socketToOutgoingConnId[socket]
                del self._connIdToOutgoingSocket[connId]
                del self._connIdToOutgoingEndpoint[connId]
                toFire.append(self.eventType.OutgoingConnectionClosed(connectionId=connId))

        for event in toFire:
            self._fireEvent(event)

        self._ensureSocketClosed(socket)

    def isUnauthenticated(self, connId):
        with self._lock:
            return connId in self._unauthenticatedConnections

    def _handleIncomingMessage(self, serializedMessage, socket):
        if socket in self._socketToIncomingConnId:
            connId = self._socketToIncomingConnId[socket]
        elif socket in self._socketToOutgoingConnId:
            connId = self._socketToOutgoingConnId[socket]
        else:
            return False

        if connId in self._unauthenticatedConnections:
            try:
                if serializedMessage.decode("utf8") != self._authToken:
                    self._logger.error("Unauthorized socket connected to us.")
                    return False

                self._unauthenticatedConnections.discard(connId)
                return True

            except Exception:
                self._logger.exception("Failed to read incoming auth message for %s", connId)
                return False
        else:
            try:
                if self.serializationContext is None:
                    message = deserialize(self.inMessageType, serializedMessage)
                else:
                    message = self.serializationContext.deserialize(
                        serializedMessage, self.inMessageType
                    )
            except Exception:
                if serializedMessage != self._authToken:
                    self._logger.exception("Failed to deserialize a message")
                return False

            self._fireEvent(
                self.eventType.IncomingMessage(connectionId=connId, message=message)
            )

            return True

    def _fireEvent(self, event):
        self._eventQueue.put(event)

    def _connectTo(self, connId: ConnectionId):
        """Actually form an outgoing connection.

        This should never get called from the thread-loop because its
        a blocking call (the wrap_socket ssl code can block) and may
        introduce a deadlock.
        """
        try:
            endpoint = self._connIdToOutgoingEndpoint[connId]

            naked_socket = socket.create_connection((endpoint.host, endpoint.port))

            if self._wantsSSL:
                ssl_socket = self._sslContext.wrap_socket(naked_socket)
            else:
                ssl_socket = naked_socket

            ssl_socket.setblocking(False)

            with self._lock:
                self._socketToOutgoingConnId[ssl_socket] = connId
                self._connIdToOutgoingSocket[connId] = ssl_socket

                # this message notifies the socket loop that it needs to pay attention to this
                # connection.
                self._scheduleEvent(self.eventType.OutgoingConnectionEstablished(connId))

                if connId in self._messagesForUnconnectedOutgoingConnection:
                    messages = self._messagesForUnconnectedOutgoingConnection.pop(connId)

                    for m in messages:
                        self._scheduleBytesForWrite(connId, m)

            return True
        except Exception:
            # we failed to connect. cleanup after ourselves.
            with self._lock:
                if connId in self._connIdToOutgoingEndpoint:
                    del self._connIdToOutgoingEndpoint[connId]
                self._connIdPendingOutgoingConnection.discard(connId)
                if connId in self._messagesForUnconnectedOutgoingConnection:
                    del self._messagesForUnconnectedOutgoingConnection[connId]

            self._scheduleEvent(self.eventType.OutgoingConnectionFailed(connectionId=connId))

            return False

    def consumeCallbacksOnOutputThread(self):
        """Move any callbacks that are scheduled for now onto the event thread.

        Returns:
            None if no additional callbacks are pending, or the amount of time
            to the next scheduled callback.
        """
        while True:
            with self._lock:
                t0 = time.time()

                callback = None

                if self._pendingTimedCallbacks and self._pendingTimedCallbacks[0][0] <= t0:
                    _, callback = self._pendingTimedCallbacks.pop(0)
                else:
                    if self._pendingTimedCallbacks:
                        return max(self._pendingTimedCallbacks[0][0] - t0, 0.0)
                    return

                if callback is not None:
                    self._eventQueue.put(callback)

    def _eventThreadLoop(self):
        while True:
            msg = self._eventQueue.get()
            if msg is None:
                return

            if isinstance(msg, self.eventType):
                try:
                    self.onEvent(msg)
                except Exception:
                    self._logger.exception("Message callback threw unexpected exception")
            else:
                try:
                    msg()
                except Exception:
                    self._logger.exception(f"User callback {msg} threw unexpected exception:")
