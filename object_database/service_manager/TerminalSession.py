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

from typed_python import TupleOf, Dict, OneOf
import queue
import threading
import logging

from object_database.service_manager.ServiceSchema import service_schema
from object_database import Schema, Indexed, core_schema
from object_database.interactive_subprocess import InteractiveSubprocess, Disconnected
from object_database.reactor import Reactor
from object_database.view import revisionConflictRetry, current_transaction

terminal_schema = Schema("core.service.terminal")


DEFAULT_MAX_LINES_TO_KEEP = 10000


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

    def writeDataFromSubrocessIntoBuffer(self, data):
        state = TerminalState.lookupAny(session=self)

        if state is None:
            state = TerminalState(session=self)

        state.writeDataFromSubrocessIntoBuffer(data)

    def readBytesFrom(self, offset):
        """Return any new bytes in the stream since 'offset'

        Returns:
            (newBytes, newIndex)
        """
        state = TerminalState.lookupAny(session=self)

        if state is None:
            return "", offset

        return state.readBytesFrom(offset)


@terminal_schema.define
class TerminalBufferBlock:
    session = Indexed(service_schema.TerminalSession)

    data = str


@terminal_schema.define
class TerminalState:
    session = Indexed(service_schema.TerminalSession)

    topByteIx = int

    maxLinesToKeep = OneOf(None, int)

    # a collection of line bufferBlocks
    bufferBlocks = TupleOf(terminal_schema.TerminalBufferBlock)

    # bytes we want to write _into_ the terminal
    writeBuffer = str

    def onUserInput(self, data):
        self.writeBuffer += data

    def popUserInput(self):
        res = self.writeBuffer

        if res:
            self.writeBuffer = ""

        return res

    def writeDataFromSubrocessIntoBuffer(self, data):
        if not self.bufferBlocks:
            self.bufferBlocks = (terminal_schema.TerminalBufferBlock(session=self.session),)

        self.bufferBlocks[-1].data += data
        self.topByteIx += len(data)

    def readBytesFrom(self, offset):
        if self.topByteIx > offset:
            newBytes = self.bufferBlocks[-1].data[offset:]

            return newBytes, self.topByteIx

        return "", offset


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

    def update(self):
        """Effect callback"""
        if self.terminalSubscription is None:
            self.terminalSubscription = TerminalSubscription(
                session=self.session, connection=current_transaction().db().connectionObject
            )

        if not self.session.exists():
            self.terminalSubscription.delete()
            return

        newBytes, newSlotIx = self.session.readBytesFrom(
            self.lastByteReadSlot.get(),
        )
        if self.lastByteReadSlot.get() != newSlotIx:
            self.lastByteReadSlot.set(newSlotIx)

        if newBytes:
            self.onData(newBytes)

    def close(self):
        if self.terminalSubscription and self.terminalSubscription.exists():
            self.terminalSubscription.delete()

    def addDataListener(self, listener):
        self.listeners.append(listener)

    def setSize(self, rows, cols):
        if self.terminalSubscription:
            self.terminalSubscription.rows = rows
            self.terminalSubscription.cols = cols

    def write(self, data):
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

        self.curSizeTuple = (None, None)

    @revisionConflictRetry
    def writeDataIntoProcess(self):
        sessionIsTerminated = False

        with self.db.transaction():
            if not self.session.exists():
                sessionIsTerminated = True
            else:
                bytesToWrite = self.session.popUserInput()
                curSizeTuple = self._computeSizeTuple()

        if sessionIsTerminated:
            if not self.hasStopped:
                self.subprocess.stop()
                self.hasStopped = True

            return

        if curSizeTuple != self.curSizeTuple and curSizeTuple[0] is not None:
            self.subprocess.setSize(*curSizeTuple)
            self.curSizeTuple = curSizeTuple

            logging.info("New terminal size is %s", self.curSizeTuple)

        if bytesToWrite:
            self.subprocess.write(bytesToWrite)

    def _computeSizeTuple(self):
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

        return (rows, cols)

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

                    if not self.writeDataFromSubrocessIntoBuffer(data):
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
            self.session.deleteSelf()

    @revisionConflictRetry
    def writeDataFromSubrocessIntoBuffer(self, data):
        with self.db.transaction():
            if not self.session.exists():
                return False

            self.session.writeDataFromSubrocessIntoBuffer(data)

        return True
