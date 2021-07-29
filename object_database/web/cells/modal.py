#   Copyright 2017-2021 object_database Authors
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


from object_database.web.cells.cell import Cell
from object_database.web.cells.computing_cell_context import ComputingCellContext
from object_database.web.cells.button import Button
from object_database.web.cells.slot import Slot


class Modal(Cell):
    def __init__(self, title, message, show=None, **buttonActions):
        """Initialize a modal dialog.

        title - string for the title
        message - string for the message body
        show - A Slot whose value is True if the cell
               should currently be showing and false if
               otherwise.
        buttonActions - a dict from string to a button action function.
        """
        super().__init__()
        self.title = Cell.makeCell(title).tagged("title")
        self.message = Cell.makeCell(message).tagged("message")
        if not show:
            self.show = Slot(False)
        else:
            self.show = show
        self.initButtons(buttonActions)
        self.buttonActions = buttonActions

    def initButtons(self, buttonActions):
        def augmentButtonAction(onClick):
            def newOnClick():
                self.show.set(False)
                onClick()

            return newOnClick

        buttons = [
            Button(k, augmentButtonAction(v)).tagged(k) for k, v in buttonActions.items()
        ]
        self.buttons = {}
        for i in range(len(buttons)):
            button = buttons[i]
            self.buttons["____button_{}__".format(i)] = button

    def recalculate(self):
        self.children.addFromDict(
            {
                "buttons": list(self.buttons.values()),
                "title": self.title,
                "message": self.message,
            }
        )
        with ComputingCellContext(self):
            self.exportData["show"] = self.show.get()

    def onMessage(self, messageFrame):
        if messageFrame["event"] == "close":
            self.show.set(False)
            if "Cancel" in self.buttonActions:
                self.buttonActions["Cancel"]()

        elif messageFrame["event"] == "accept":
            # First, run the default action,
            # which should be the one associated
            # with the *first* button
            if len(self.buttons) >= 1:
                self.buttons["____button_0__"].onClick()
