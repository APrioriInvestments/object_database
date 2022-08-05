#   Copyright 2019-2020 Object Database Authors
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

import logging
import threading
import time
import queue
import json
import uuid

from object_database.web.cells.recomputing_cell_context import RecomputingCellContext
from object_database.web.ActiveWebServiceSchema import active_webservice_schema
from object_database.web.ActiveWebService_util import (
    makeMainView,
    displayAndHeadersForPathAndQueryArgs,
)

from object_database.web.cells import Subscribed, Cells, MAX_FPS, SessionState
from object_database.view import revisionConflictRetry


class DISCONNECT:
    pass


class CellsSession:
    """Runs a single session of a webpage, sending and receiving json messages.

    The ActiveWebService uses this class to actually execute the session. This
    class executes in a separate process for each connection. ActiveWebService
    is responsible for brokering messages between this and the main session.
    """

    def __init__(
        self,
        db,
        session,
        inboundMessageQueue,
        sendMessage,
        path,
        queryArgs,
        currentUser,
        authorized_groups_text,
    ):
        """Initialize a CellsSession:

        Args:
            db - an odb connection
            inboundMessageQueue - a queue containing (msg, connId) instances,
                where 'msg' is a string containing a websocket message and
                connId is the connection that sent us the data.

                There is one connId which represents the incoming socket connection.
            session - the active_webservice_schema.Session object for this session
            sendMessage - a function of (connId, msg) to send a str message to 'connId'
            path - the actual path we were loaded with
            queryArgs - the queryArgs we were loaded with
            currentUser - name of the currently authenticated user
            authorized_groups_text - a string description of who can log in.
        """
        self.inboundMessageQueue = inboundMessageQueue
        self.sendMessage = sendMessage

        self.primaryConnId = None

        self.db = db
        self.path = path
        self.queryArgs = queryArgs

        self.sessionId = None
        self.session = session

        self.currentUser = currentUser
        self.authorized_groups_text = authorized_groups_text
        self.shouldStop = threading.Event()

        self.lastDumpTimestamp = time.time()
        self.lastDumpMessages = 0
        self.lastDumpFrames = 0
        self.lastDumpTimeSpentCalculating = 0.0
        self.frameTimestamps = []

        # not set until the persistent sessionId is known
        self.sessionState = None
        self.cells = None

        self.largeMessageAck = queue.Queue()

        self.readThread = None

        self.sentPacketId = 0

    def performSessionHandshake(self):
        """Wait for all initial handshakes to finish.

        This takes over main socket interactions and synchronously executes
        until we know which channel is the primary websocket channel (in case
        of a race condition on startup) and what the browser-stored
        session id is (so that we can bounce the browser and retain our
        session information).
        """
        while self.primaryConnId is None or self.sessionId is None:
            msg, connId = self.inboundMessageQueue.get()

            if msg is DISCONNECT or self.shouldStop.is_set():
                return

            jsonMsg = json.loads(msg)

            if jsonMsg.get("msg") == "primaryWebsocket":
                self.primaryConnId = connId
            else:
                assert self.primaryConnId is not None

                if jsonMsg.get("event") == "requestSessionId":
                    self.sessionId = str(uuid.uuid4()).replace("-", "")

                    logging.info("Initializing new cells session %s", self.sessionId)

                    self.sendMessage(self.primaryConnId, "1")
                    self.sendMessage(
                        self.primaryConnId,
                        json.dumps(dict(type="#sessionId", sessionId=self.sessionId)),
                    )
                elif jsonMsg.get("event") == "setSessionId":
                    self.sessionId = jsonMsg["sessionId"]
                    logging.info("Continuing existing cells session %s", self.sessionId)

        self.setSessionIdInOdb(self.sessionId)

        self.sessionState = SessionState(self.sessionId)

        self.sessionState.cleanupOldSessions(self.db)
        self.sessionState.setup(self.db)

        with self.db.transaction():
            self.sessionState.set("currentUser", self.currentUser)

        self.cells = Cells(self.db).withRoot(
            Subscribed(lambda: self.displayForPathAndQueryArgs(self.path, self.queryArgs)),
            session_state=self.sessionState,
        )

    @revisionConflictRetry
    def setSessionIdInOdb(self, newSessionId):
        with self.db.transaction():
            for session in active_webservice_schema.Session.lookupAll(sessionId=newSessionId):
                session.delete()

            self.session.sessionId = newSessionId

    def makeMessageCallback(self, jsonMsg):
        """Return a callback that processes 'jsonMsg'

        We have to process messages on the same thread as the rest of Cells or
        we'll get race conditions.
        """
        t0 = time.time()

        def callbackFun():
            cell_id = jsonMsg.get("target_cell")
            if cell_id == "main_cells_handler":
                self.cells.onMessage(jsonMsg)
            else:
                cell = self.cells[cell_id]

                if cell is not None:
                    with RecomputingCellContext(cell):
                        cell.onMessage(jsonMsg)

                logging.info(
                    "Processed onMessage for cell %s with lag of %s: %s",
                    cell,
                    time.time() - t0,
                    repr(jsonMsg)[:100],
                )

        return callbackFun

    def readThreadLoop(self):
        while not self.shouldStop.is_set():
            msg, connId = self.inboundMessageQueue.get()

            if msg is DISCONNECT:
                self.largeMessageAck.put(DISCONNECT)
                return

            try:
                jsonMsg = json.loads(msg)

                if "ACK" in jsonMsg:
                    self.largeMessageAck.put(jsonMsg["ACK"])
                else:
                    self.cells.scheduleUnconditionalCallback(self.makeMessageCallback(jsonMsg))

            except Exception:
                logging.exception("Exception in inbound message:")

        self.largeMessageAck.put(DISCONNECT)

    def writeJsonMessage(self, message):
        """Send a message over the websocket.

        We chunk it into small frames of 32 kb apiece to keep the browser
        from getting overloaded.
        """
        try:
            msg = json.dumps(message)
        except Exception:
            logging.exception("Failed to encode message as json.")
            return 0

        self.sendMessage(self.primaryConnId, msg)

    def onFrame(self):
        """Notice that we ticked a frame, log, and throttle so we don't jam the browser."""
        self.lastDumpFrames += 1

        # log slow messages
        if time.time() - self.lastDumpTimestamp > 60.0:
            logging.info(
                "In the last %.2f seconds, spent %.2f seconds"
                " calculating %s messages over %s frames",
                time.time() - self.lastDumpTimestamp,
                self.lastDumpTimeSpentCalculating,
                self.lastDumpMessages,
                self.lastDumpFrames,
            )

            self.lastDumpFrames = 0
            self.lastDumpMessages = 0
            self.lastDumpTimeSpentCalculating = 0
            self.lastDumpTimestamp = time.time()

            # make sure the session timestamp is up to date
            with self.db.transaction():
                self.sessionState.touch()

        self.frameTimestamps.append(time.time())

        if len(self.frameTimestamps) > MAX_FPS:
            self.frameTimestamps = self.frameTimestamps[-MAX_FPS + 1 :]

            if time.time() - self.frameTimestamps[0] < 1.0:
                maxTime = time.time() + 1.0 / MAX_FPS + 0.001

                while time.time() < maxTime:
                    sleepTime = maxTime - time.time()
                    if sleepTime > 0.0:
                        time.sleep(sleepTime)

                    if self.shouldStop.is_set():
                        return

    def run(self):
        self.performSessionHandshake()

        self.readThread = threading.Thread(target=self.readThreadLoop)
        self.readThread.start()

        try:
            # don't execute until we know which channel is the main websocket.
            while not self.shouldStop.is_set():
                t0 = time.time()
                messages = self.cells.renderMessages()
                packets = self.cells.getPackets()

                self.lastDumpTimeSpentCalculating += time.time() - t0

                if time.time() - t0 > 0.0:
                    updateCount = sum(
                        len(message.get("nodesUpdated", ())) for message in messages
                    )
                    createCount = sum(
                        len(message.get("nodesCreated", ())) for message in messages
                    )

                    if updateCount or createCount:
                        logging.info(
                            "Rendering message packet with %s updates "
                            "and %s new cells took %.4f seconds. Bytecount is %.2f kb",
                            updateCount,
                            createCount,
                            time.time() - t0,
                            sum(len(json.dumps(x)) for x in messages) / 1024.0,
                        )

                if messages:
                    for message in messages:
                        self.writeJsonMessage(message)

                        self.lastDumpMessages += 1

                    self.onFrame()

                if packets:
                    # send all of our packets. Each packet is just a 'bytes' object.
                    # packetIds are allocated in linear order, starting with 1, so
                    # the receiving side can tell that each packet increments linearly
                    # and can just store it in a buffer to be picked up later.
                    packets = sorted(packets.items())

                    for packetId, packetContents in packets:
                        if packetId < self.sentPacketId:
                            logging.error("Somehow, we're sending packet %s again!", packetId)
                        else:
                            while packetId > self.sentPacketId + 1:
                                logging.error("Somehow, we are skipping packet %s", packetId)

                                self.sendMessage(self.primaryConnId, b"")
                                self.sentPacketId += 1

                            if not isinstance(packetContents, bytes):
                                logging.error("Packet %s was not a bytes object", packetId)
                                self.sendMessage(self.primaryConnId, b"")
                            else:
                                self.sendMessage(self.primaryConnId, packetContents)

                            self.sentPacketId = packetId

                self.cells.wait()

        except Exception:
            logging.exception("Websocket handler error:")

        finally:
            self.shouldStop.set()
            self.inboundMessageQueue.put((DISCONNECT, None))

            self.readThread.join()

            if self.cells is not None:
                self.cells.cleanupCells()

    def displayForPathAndQueryArgs(self, path, queryArgs):
        try:
            display, toggles = displayAndHeadersForPathAndQueryArgs(path, queryArgs)

            if toggles is None:
                return display

            return makeMainView(
                display, toggles, self.currentUser, self.authorized_groups_text
            )
        except Exception as e:
            if "is instantiated in another codebase already" in str(e):
                logging.info("Cells exiting because codebase is out of date.")
                self.stop()
            else:
                raise

    def stop(self):
        self.shouldStop.set()
        self.inboundMessageQueue.put((DISCONNECT, None))
        self.largeMessageAck.put(DISCONNECT)
