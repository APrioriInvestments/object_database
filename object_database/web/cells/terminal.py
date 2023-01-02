#   Copyright 2017-2022 object_database Authors
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

from object_database.web.cells.cell import FocusableCell
from object_database.web.cells.interactive_subprocess import InteractiveSubprocess
import threading
import logging


class EchoStream:
    def __init__(self):
        self.listeners = []

    def close(self):
        pass

    def addDataListener(self, listener):
        self.listeners.append(listener)

    def setSize(self, rows, cols):
        pass

    def write(self, data):
        for listener in self.listeners:
            listener(data)


class PopenStream:
    def __init__(self, cmd, **kwargs):
        self.listeners = []

        self.cmd = cmd
        self.kwargs = kwargs

        self.runner = InteractiveSubprocess(
            self.cmd,
            onStdOut=self.onData,
            **self.kwargs
        )

    def close(self):
        self.runner.stop()

    def addDataListener(self, listener):
        self.listeners.append(listener)
        self.runner.start()

    def setSize(self, rows, cols):
        self.runner.setSize(rows, cols)

    def write(self, data):
        self.runner.write(data)

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


class Terminal(FocusableCell):
    """Produce a terminal emulator"""

    def __init__(
        self,
        stream=None
    ):
        """Initialize a terminal."""
        super().__init__()
        self.stream = stream or EchoStream()

        self.stream.addDataListener(self.onStreamData)

        self.streamDataLock = threading.Lock()
        self.streamDataBuffer = []
        self.streamDataTriggered = False

    def onRemovedFromTree(self):
        self.stream.close()

    def onStreamData(self, streamData):
        with self.streamDataLock:
            self.streamDataBuffer.append(streamData)
            if not self.streamDataTriggered:
                self.cells.scheduleUnconditionalCallback(self.handleStreamData)
                self.streamDataTriggered = True

    def handleStreamData(self):
        with self.streamDataLock:
            dataToSend = self.streamDataBuffer
            self.streamDataBuffer = []
            self.streamDataTriggered = False

        self.scheduleMessage(dict(data="".join(dataToSend)))

    def onMessage(self, messageFrame):
        if messageFrame.get("size"):
            self.stream.setSize(messageFrame['size']['rows'], messageFrame['size']['cols'])

        if messageFrame.get("data"):
            self.stream.write(messageFrame['data'])
