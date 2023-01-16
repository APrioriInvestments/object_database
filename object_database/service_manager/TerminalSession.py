#   Copyright 2017-2023 object_database Authors
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

from typed_python import TupleOf, Dict, OneOf, NamedTuple
import queue
import threading
import logging

from object_database.service_manager.ServiceSchema import service_schema
from object_database import Schema, Indexed, core_schema
from object_database.interactive_subprocess import InteractiveSubprocess, Disconnected
from object_database.reactor import Reactor
from object_database.view import revisionConflictRetry, current_transaction

terminal_schema = Schema("core.service.terminal")


DEFAULT_MAX_BYTES_TO_KEEP = 4000000
MIN_BLOCK_SIZE = 256
MAX_BLOCK_SIZE = 256 * 1024

@service_schema.define
class TerminalSession:
    """Models a process on a host running an interactive TTY."""

    host = Indexed(service_schema.ServiceHost)

    env = OneOf(None, Dict(str, str))
    command = TupleOf(str)
    shell = bool

    # connection object for the process handling this connection
    connection = Indexed(OneOf(None, core_schema.Connection))

    # the current boot state. Will be None if the service manager
    # hasn't started this up yet
    statusMessage = OneOf(None, str)

    @staticmethod
    def create(host, command, shell=False, env=None):
        TerminalSession(host=host, command=command, shell=shell, env=env)

    @staticmethod
    def ensureSubscribed(db, session):
        db.subscribeToIndex(TerminalBufferBlock, session=session)
        db.subscribeToIndex(TerminalState, session=session)
        db.subscribeToIndex(TerminalSubscription, session=session)

    def deleteSelf(self):
        for lb in TerminalBufferBlock.lookupAll(session=self):
            lb.delete()

        for state in TerminalState.lookupAll(session=self):
            state.delete()

        for subscriber in TerminalSubscription.lookupAll(session=self):
            subscriber.delete()

        self.delete()

    def createDriver(self, newDbConnection):
        """Return a 'TerminalDriver' that actually executes the terminal."""
        driver = TerminalDriver(newDbConnection, self)
        driver.start()

        return driver

    def cell(self):
        """Return a cell rendering this terminal."""
        import object_database.web.cells as cells

        cells.ensureSubscribedIndex(TerminalBufferBlock, session=self)
        cells.ensureSubscribedIndex(TerminalState, session=self)
        cells.ensureSubscribedIndex(TerminalSubscription, session=self)

        stream = Stream(session=self)

        return cells.Terminal(stream=stream) + cells.Effect(stream.update)

    def popUserInput(self):
        state = TerminalState.lookupAny(session=self)

        if not state:
            return ""

        return state.popUserInput()

    def onUserInput(self, data):
        state = TerminalState.lookupAny(session=self)

        if state is None:
            state = TerminalState(session=self)

        state.onUserInput(data)

    def writeDataFromSubprocessIntoBuffer(self, data):
        state = TerminalState.lookupAny(session=self)

        if state is None:
            state = TerminalState(session=self)

        state.writeDataFromSubprocessIntoBuffer(data)

    def readBytesFrom(self, offset):
        """Return any new bytes in the stream since 'offset'

        Returns:
            (newBytes, newIndex)
        """
        state = TerminalState.lookupAny(session=self)

        if state is None:
            return "", offset

        return state.readBytesFrom(offset)

    def getEffectiveSize(self):
        state = TerminalState.lookupAny(session=self)

        if state is None:
            return

        return state.effectiveSize

    def setEffectiveSize(self, curSize):
        state = TerminalState.lookupAny(session=self)

        if state is None:
            return

        state.setEffectiveSize(curSize)


@terminal_schema.define
class TerminalBufferBlock:
    session = Indexed(service_schema.TerminalSession)

    data = str


@terminal_schema.define
class TerminalState:
    session = Indexed(service_schema.TerminalSession)

    topByteIx = int
    bottomByteIx = int

    maxBytesToKeep = OneOf(None, int)
    maxBlockSize = OneOf(None, int)

    # a collection of line bufferBlocks
    bufferBlocks = TupleOf(terminal_schema.TerminalBufferBlock)

    # bytes we want to write _into_ the terminal
    writeBuffer = str

    # the 'effective size' of the terminal, which is the minimum
    # of all the terminal sizes that are actually looking at it.
    # this is what we have told the terminal is its size
    effectiveSize = OneOf(None, NamedTuple(rows=int, cols=int))

    def setEffectiveSize(self, curSize):
        newSz = NamedTuple(rows=int, cols=int)(
            rows=curSize['rows'], cols=curSize['cols']
        ) if curSize is not None else None

        if self.effectiveSize != newSz:
            self.effectiveSize = newSz

    def onUserInput(self, data):
        self.writeBuffer += data

    def popUserInput(self):
        res = self.writeBuffer

        if res:
            self.writeBuffer = ""

        return res

    def writeDataFromSubprocessIntoBuffer(self, data):
        if not self.bufferBlocks:
            self.bufferBlocks = (terminal_schema.TerminalBufferBlock(session=self.session),)

        if len(self.bufferBlocks[-1].data) + len(data) > MIN_BLOCK_SIZE:
            self.bufferBlocks = self.bufferBlocks + (terminal_schema.TerminalBufferBlock(session=self.session),)

        self.bufferBlocks[-1].data += data
        self.topByteIx += len(data)

        # we don't want to rewrite the buffer back to ODB every time we make a change.
        # this would make the system impossibly slow once a terminal has a decent amount
        # of output. Instead, we maintain a logarithmically-sized sequence of blocks
        while (
            len(self.bufferBlocks) > 1
            and len(self.bufferBlocks[-1].data) >= len(self.bufferBlocks[-2].data)
            and len(self.bufferBlocks[-1].data) < (self.maxBlockSize or MAX_BLOCK_SIZE)
        ):
            # if the last block is larger than the second to last block, collapse them together
            self.bufferBlocks[-2].data += self.bufferBlocks[-1].data
            self.bufferBlocks = self.bufferBlocks[:-1]

        # if we're holding too much data, chop some out
        while (
            self.topByteIx - self.bottomByteIx > (self.maxBytesToKeep or DEFAULT_MAX_BYTES_TO_KEEP)
            and len(self.bufferBlocks) > 1
        ):
            chunks = self.bufferBlocks[0].data.rsplit("\n", 1)
            self.bottomByteIx += len(chunks[0]) + 1

            if len(chunks) == 2:
                self.bufferBlocks[1].data = chunks[1] + self.bufferBlocks[1].data

            self.bufferBlocks = self.bufferBlocks[1:]

    def readBytesFrom(self, offset):
        if offset >= self.topByteIx:
            return "", offset

        res = ""

        curBlockIx = len(self.bufferBlocks) - 1
        topIx = self.topByteIx
        bottomIx = topIx - len(self.bufferBlocks[curBlockIx].data)

        while True:
            if offset >= bottomIx:
                return self.bufferBlocks[curBlockIx].data[offset - bottomIx:] + res, self.topByteIx

            res = self.bufferBlocks[curBlockIx].data + res

            if curBlockIx == 0:
                return res, self.topByteIx

            curBlockIx -= 1
            topIx = bottomIx
            bottomIx = topIx - len(self.bufferBlocks[curBlockIx].data)


@terminal_schema.define
class TerminalSubscription:
    session = Indexed(service_schema.TerminalSession)

    connection = core_schema.Connection

    # current rows and columns for this session. we'll display
    # the 'max' of these
    rows = OneOf(None, int)
    cols = OneOf(None, int)


class Stream:
    def __init__(self, session):
        import object_database.web.cells as cells

        self.listeners = []
        self.session = session
        self.terminalSubscription = None
        self.lastByteReadSlot = cells.Slot(0)
        self.lastTerminalSize = cells.Slot(None)

    def update(self):
        """Effect callback"""
        if not self.session.exists():
            if self.terminalSubscription.exists():
                self.terminalSubscription.delete()

            self.onData(Disconnected)

            return

        if self.terminalSubscription is None:
            self.terminalSubscription = TerminalSubscription(
                session=self.session, connection=current_transaction().db().connectionObject
            )

        newBytes, newSlotIx = self.session.readBytesFrom(
            self.lastByteReadSlot.get(),
        )
        if self.lastByteReadSlot.get() != newSlotIx:
            self.lastByteReadSlot.set(newSlotIx)

        if newBytes:
            self.onData(newBytes)

        if self.lastTerminalSize.get() != self.session.getEffectiveSize():
            self.lastTerminalSize.set(self.session.getEffectiveSize())
            self.onData(
                self.lastTerminalSize.get()
            )

    def close(self):
        if self.terminalSubscription and self.terminalSubscription.exists():
            self.terminalSubscription.delete()

    def addDataListener(self, listener):
        self.listeners.append(listener)

    def setSize(self, size):
        if self.terminalSubscription and self.terminalSubscription.exists():
            self.terminalSubscription.rows = size['rows']
            self.terminalSubscription.cols = size['cols']

    def write(self, data):
        if self.session.exists():
            self.session.onUserInput(data)

    def onData(self, data):
        badListeners = []

        for listener in self.listeners:
            try:
                listener(data)
            except Exception:
                logging.exception("Unexpected error processing stream listener")
                badListeners.append(listener)

        for listener in badListeners:
            self.listeners.remove(listener)


class TerminalDriver:
    """Spawn a subprocess executing a terminal session and service it"""

    def __init__(self, db, session: TerminalSession):
        self.db = db
        self.session = session
        self.subprocess = None
        self.queue = queue.Queue()
        self.readThread = None
        self.hasStopped = False
        self.reactor = Reactor(self.db, self.writeDataIntoProcess)

        self.curSize = None

    @revisionConflictRetry
    def writeDataIntoProcess(self):
        sessionIsTerminated = False

        with self.db.transaction():
            if not self.session.exists():
                sessionIsTerminated = True
            else:
                bytesToWrite = self.session.popUserInput()
                curSize = self._computeSize()

                self.session.setEffectiveSize(curSize)

        if sessionIsTerminated:
            if not self.hasStopped:
                logging.info("Terminating process because session was deleted")
                self.subprocess.stop()
                self.hasStopped = True

            return

        if curSize != self.curSize and curSize is not None:
            self.subprocess.setSize(rows=curSize['rows'], cols=curSize['cols'])
            self.curSize = curSize

        if bytesToWrite:
            self.subprocess.write(bytesToWrite)

    def _computeSize(self):
        rows = None
        cols = None

        def minOrNone(a, b):
            if a is None:
                return b

            if b is None:
                return a

            return min(a, b)

        for subscription in TerminalSubscription.lookupAll(session=self.session):
            rows = minOrNone(rows, subscription.rows)
            cols = minOrNone(cols, subscription.cols)

        if rows is None:
            return None

        return dict(rows=rows, cols=cols)

    def start(self):
        self.readThread = threading.Thread(target=self.readQueueThread)
        self.readThread.start()

    def onStdOut(self, data):
        self.queue.put(data)

    def startSubprocessAndReactor(self):
        self.db.subscribeToSchema(service_schema)
        TerminalSession.ensureSubscribed(self.db, self.session)

        with self.db.view():
            if not self.session.exists():
                return

            command = self.session.command
            env = self.session.env
            shell = self.session.shell

        self.subprocess = InteractiveSubprocess(command, self.onStdOut, env=env, shell=shell)

        self.subprocess.start()
        self.reactor.start()

    def readQueueThread(self):
        logging.info("Terminal driver started")

        self.startSubprocessAndReactor()

        try:
            isDisconnected = False

            while not isDisconnected:
                somePackets = []

                try:
                    while not isDisconnected:
                        packet = self.queue.get(block=not somePackets)

                        if packet is Disconnected:
                            isDisconnected = True
                        else:
                            somePackets.append(packet)
                except queue.Empty:
                    pass

                if somePackets:
                    data = "".join(somePackets)

                    if not self.writeDataFromSubprocessIntoBuffer(data):
                        self.subprocess.stop()
                        return

        except Exception:
            logging.exception("Terminal driver failed")
        finally:
            self.teardown()

    @revisionConflictRetry
    def teardown(self):
        self.reactor.stop()

        with self.db.transaction():
            if self.session.exists():
                self.session.deleteSelf()

    @revisionConflictRetry
    def writeDataFromSubprocessIntoBuffer(self, data):
        with self.db.transaction():
            if not self.session.exists():
                return False

            self.session.writeDataFromSubprocessIntoBuffer(data)

        return True
