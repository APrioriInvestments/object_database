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


from object_database.web.cells.subscribed import Subscribed
from object_database.web.cells.padding import Padding
from object_database.web.cells.cell import Cell
from object_database.web.cells.button import Button


class Modal(Cell):
    def __init__(self, body, header=None, footer=None, onEnter=None, onEsc=None):
        """Show a modal dialog.  It will be immediately visible.

        The dialog will prevent anything behind it from accepting keystrokes,
        and will defocus any prior elements.

        Only one modal may be visible at once.
        """
        super().__init__()

        if body:
            self.children["body"] = Cell.makeCell(body)

        if header:
            self.children["header"] = Cell.makeCell(header)

        if footer:
            self.children["footer"] = Cell.makeCell(footer)

        self.onEnter = onEnter
        self.onEsc = onEsc

    def onMessage(self, msg):
        if msg.get("event") == "enter":
            if self.onEnter:
                self.onEnter()

        if msg.get("event") == "esc":
            if self.onEsc:
                self.onEsc()

    def sortsAs(self):
        header = self.children["header"]
        if isinstance(header, Cell):
            return self.header.sortsAs()
        else:
            return header


def ButtonModal(shown, title, body, ok, cancel=None):
    """ Make a Modal with buttons.

    Args:
        shown (cells.Slot): a cells.Slot boolean that determines whether the modal
            is shown or hidden.
        title (str): the text of the title-bar of the modal
        body (cells.Cell): a Cell to be displayed as the body of the modal
        ok (zero-arg function): what to execute on clicking 'OK'
        cancel (zero-arg function): what to execute on clicking 'Cancel'. This is optional.
            If it is missing, there will be no 'Cancel' button.
    """

    def makeModal():
        def onOk():
            shown.set(False)
            ok()

        def onCancel():
            shown.set(False)
            cancel()

        buttons = Button("OK", onOk)
        if cancel:
            buttons = buttons >> Padding() >> Button("Cancel", onCancel)

        return Modal(body, header=title, footer=buttons, onEnter=onOk, onEsc=onCancel)

    return Subscribed(lambda: makeModal() if shown.get() else None)
