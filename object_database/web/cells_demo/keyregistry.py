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

from object_database.web import cells as cells
from object_database.web.CellsTestPage import CellsTestPage


class KeyRegistryInfoRequest(CellsTestPage):
    """An example of sending a WS message to get the KeyRegistry info."""

    def cell(self):
        import datetime

        message = {"request": "KeyRegistry"}

        messageSlot = cells.Slot("Waiting for a message")

        lastKeystroke = cells.Slot()

        def callBack(info):
            messageSlot.set("KeyListeners: " + info["KeyListeners"])

        return cells.ResizablePanel(
            cells.Sequence(
                [
                    cells.WSMessageTester(
                        WSMessageToSend=message,
                        messageType="cellDataRequested",
                        onCallbackFunc=callBack,
                    ),
                    cells.KeyAction(
                        "ctrlKey+t", lambda x: lastKeystroke.set(str(datetime.datetime.now()))
                    ),
                ]
            ),
            cells.Subscribed(lambda: cells.Text(messageSlot.get())),
        )

    def text(self):
        return ""
