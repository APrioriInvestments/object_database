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
        sessionId,
        currentUser,
        authorized_groups_text,
    ):
        self.inboundMessageQueue = inboundMessageQueue
        self._logger = logging.getLogger(__name__)
        self.sendMessage = sendMessage
        self.db = db
        self.path = path
        self.queryArgs = queryArgs
        self.sessionId = sessionId
        self.currentUser = currentUser
        self.authorized_groups_text = authorized_groups_text
        self.shouldStop = threading.Event()

        self.lastDumpTimestamp = time.time()
        self.lastDumpMessages = 0
        self.lastDumpFrames = 0
        self.lastDumpTimeSpentCalculating = 0.0
        self.frameTimestamps = []

        self.sessionState = SessionState()

        self.sessionState.currentUser = currentUser

        self.cells = Cells(self.db).withRoot(
            Subscribed(lambda: self.displayForPathAndQueryArgs(path, queryArgs)),
            session_state=self.sessionState,
        )

        self.largeMessageAck = queue.Queue()

        self.readThread = None

    def makeMessageCallback(self, jsonMsg):
        """Return a callback that processes 'jsonMsg'

        We have to process messages on the same thread as the rest of Cells or
        we'll get race conditions.
        """

        def callbackFun():
            cell_id = jsonMsg.get("target_cell")
            cell = self.cells[cell_id]

            if cell is not None:
                cell.onMessageWithTransaction(jsonMsg)

        return callbackFun

    def readThreadLoop(self):
        while not self.shouldStop.is_set():
            msg = self.inboundMessageQueue.get()

            if msg is DISCONNECT:
                self.largeMessageAck.put(DISCONNECT)
                return

            try:
                jsonMsg = json.loads(msg)

                if "ACK" in jsonMsg:
                    self.largeMessageAck.put(jsonMsg["ACK"])
                else:
                    self.cells.scheduleCallback(self.makeMessageCallback(jsonMsg))
            except Exception:
                self._logger.exception("Exception in inbound message:")

        self.largeMessageAck.put(DISCONNECT)

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
            self._logger.exception("Failed to encode message as json.")
            return 0

        # split msg into small frames
        frames = []
        i = 0
        while i < len(msg):
            frames.append(msg[i : i + FRAME_SIZE])
            i += FRAME_SIZE

        if len(frames) >= FRAMES_PER_ACK:
            self._logger.info(
                "Sending large message of %s bytes over %s frames", len(msg), len(frames)
            )

        self.sendMessage(json.dumps(len(frames)))

        for index, frame in enumerate(frames):
            self.sendMessage(frame)

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
            self._logger.info(
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
        self.readThread = threading.Thread(target=self.readThreadLoop)
        self.readThread.start()

        try:
            while not self.shouldStop.is_set():
                t0 = time.time()
                messages = self.cells.renderMessages()
                self.lastDumpTimeSpentCalculating += time.time() - t0

                if messages:
                    bytesSent = 0

                    for message in messages:
                        bytesSent += self.writeJsonMessage(message)

                        self.lastDumpMessages += 1

                    if bytesSent > 100 * 1024:
                        self._logger.info(
                            "Sent a large message packet of %.2f mb", bytesSent / 1024.0 ** 2
                        )

                    # tell the browser to execute the postscripts that its built up
                    self.writeJsonMessage("postscripts")

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
            self._logger.exception("Websocket handler error:")

        finally:
            self.shouldStop.set()
            self.inboundMessageQueue.put(DISCONNECT)

            self.readThread.join()
            self.cells.cleanupCells()

    def displayForPathAndQueryArgs(self, path, queryArgs):
        display, toggles = displayAndHeadersForPathAndQueryArgs(path, queryArgs)
        return makeMainView(display, toggles, self.currentUser, self.authorized_groups_text)

    def stop(self):
        self.shouldStop.set()
        self.inboundMessageQueue.put(DISCONNECT)
        self.largeMessageAck.put(DISCONNECT)
