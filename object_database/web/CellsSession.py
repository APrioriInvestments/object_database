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

from object_database.web.ActiveWebService_util import (
    makeMainView,
    displayAndHeadersForPathAndQueryArgs,
)

from object_database.web.cells import Subscribed, Cells, MAX_FPS, SessionState


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
        inboundMessageQueue,
        sendMessage,
        path,
        queryArgs,
        sessionCookie,
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
            sendMessage - a function of (connId, msg) to send a str message to 'connId'
            path - the actual path we were loaded with
            queryArgs - the queryArgs we were loaded with
            sessionCookie - the session cookie
            currentUser - name of the currently authenticated user
            authorized_groups_text - a string description of who can log in.
        """
        self.inboundMessageQueue = inboundMessageQueue
        self.sendMessage = sendMessage

        self.primaryConnId = None

        self.db = db
        self.path = path
        self.queryArgs = queryArgs
        self.sessionCookie = sessionCookie

        self.sessionId = None

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
                    self.sessionId = str(uuid.uuid4())

                    logging.info("Initializing new cells session %s", self.sessionId)

                    self.sendMessage(self.primaryConnId, "1")
                    self.sendMessage(
                        self.primaryConnId,
                        json.dumps(dict(type="#sessionId", sessionId=self.sessionId)),
                    )
                elif jsonMsg.get("event") == "setSessionId":
                    self.sessionId = jsonMsg["sessionId"]
                    logging.info("Continuing existing cells session %s", self.sessionId)

        self.sessionState = SessionState(self.sessionId)

        self.sessionState.cleanupOldSessions(self.db)
        self.sessionState.setup(self.db)

        with self.db.transaction():
            self.sessionState.set("currentUser", self.currentUser)

        self.cells = Cells(self.db).withRoot(
            Subscribed(lambda: self.displayForPathAndQueryArgs(self.path, self.queryArgs)),
            session_state=self.sessionState,
        )

    def makeMessageCallback(self, jsonMsg):
        """Return a callback that processes 'jsonMsg'

        We have to process messages on the same thread as the rest of Cells or
        we'll get race conditions.
        """

        def callbackFun():
            cell_id = jsonMsg.get("target_cell")
            if cell_id == "main_cells_handler":
                self.cells.onMessage(jsonMsg)
            else:
                cell = self.cells[cell_id]

                if cell is not None:
                    cell.onMessageWithTransaction(jsonMsg)

        return callbackFun

    def readThreadLoop(self):
        while not self.shouldStop.is_set():
            msg, connId = self.inboundMessageQueue.get()

            if msg is DISCONNECT:
                self.largeMessageAck.put(DISCONNECT)
                return

            try:
                jsonMsg = json.loads(msg)

                if isinstance(jsonMsg, dict) and jsonMsg.get("msg") == "getPacket":
                    self.sendPacketTo(connId, jsonMsg.get("packet"))
                else:
                    if "ACK" in jsonMsg:
                        self.largeMessageAck.put(jsonMsg["ACK"])
                    else:
                        self.cells.scheduleCallback(self.makeMessageCallback(jsonMsg))
            except Exception:
                logging.exception("Exception in inbound message:")

        self.largeMessageAck.put(DISCONNECT)

    def sendPacketTo(self, connId, packetId):
        packetContents = self.cells.getPacketContents(packetId)

        if not isinstance(packetContents, (bytes, str)):
            logging.error("Packet %s has no data: %s", packetId, type(packetContents))
            self.sendMessage(connId, b"")
        else:
            self.sendMessage(connId, packetContents)

    def writeJsonMessage(self, message):
        """Send a message over the websocket.

        We chunk it into small frames of 32 kb apiece to keep the browser
        from getting overloaded.
        """
        FRAME_SIZE = 128 * 1024
        FRAMES_PER_ACK = 10

        try:
            msg = json.dumps(message)
        except Exception:
            logging.exception("Failed to encode message as json.")
            return 0

        # split msg into small frames
        frames = []
        i = 0
        while i < len(msg):
            frames.append(msg[i : i + FRAME_SIZE])
            i += FRAME_SIZE

        if len(frames) >= FRAMES_PER_ACK:
            logging.info(
                "Sending large message of %s bytes over %s frames", len(msg), len(frames)
            )

        self.sendMessage(self.primaryConnId, json.dumps(len(frames)))

        for index, frame in enumerate(frames):
            self.sendMessage(self.primaryConnId, frame)

            # block until we get the ack for FRAMES_PER_ACK frames ago. That
            # way we always have FRAMES_PER_ACK frames in the buffer.
            framesSent = index + 1
            if framesSent % FRAMES_PER_ACK == 0 and framesSent > FRAMES_PER_ACK:
                ack = self.largeMessageAck.get()

                if ack is DISCONNECT:
                    return 0
                else:
                    assert ack == framesSent - FRAMES_PER_ACK, (
                        ack,
                        framesSent - FRAMES_PER_ACK,
                    )

        framesSent = len(frames)

        if framesSent >= FRAMES_PER_ACK:
            finalAckIx = framesSent - (framesSent % FRAMES_PER_ACK)

            ack = self.largeMessageAck.get()

            if ack is DISCONNECT:
                return 0
            else:
                assert ack == finalAckIx, (ack, finalAckIx)

        return len(message)

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
                    time.sleep(0.01)

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

                self.lastDumpTimeSpentCalculating += time.time() - t0

                if time.time() - t0 > 0.1:
                    logging.info(
                        "Rendering message packet with %s updates "
                        "and %s new cells took %.2f seconds.",
                        sum(len(message.get("nodesUpdated", ())) for message in messages),
                        sum(len(message.get("nodesCreated", ())) for message in messages),
                        time.time() - t0,
                    )

                if messages:
                    bytesSent = 0

                    for message in messages:
                        bytesSent += self.writeJsonMessage(message)

                        self.lastDumpMessages += 1

                    if bytesSent > 100 * 1024:
                        logging.info(
                            "Sent a large message packet of %.2f mb", bytesSent / 1024.0 ** 2
                        )

                    # request an ACK from the browser before sending any more data
                    # otherwise it can get overloaded and crash because it can't
                    # keep up with the data volume
                    self.writeJsonMessage("request_ack")

                    ack = self.largeMessageAck.get()

                    if ack is DISCONNECT:
                        return

                    self.onFrame()

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

    def stop(self):
        self.shouldStop.set()
        self.inboundMessageQueue.put((DISCONNECT, None))
        self.largeMessageAck.put(DISCONNECT)
