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


from object_database.web.cells.cell import FocusableCell
from object_database.web.cells.computing_cell_context import ComputingCellContext
from object_database.web.cells.session_state import sessionState


class CodeEditor(FocusableCell):
    """Produce a code editor."""

    def __init__(
        self,
        keybindings=None,
        noScroll=False,
        minLines=None,
        fontSize=None,
        readOnly=False,
        autocomplete=True,
        onTextChange=None,
        firstVisibleRow=None,
        onFirstRowChange=None,
        onSelectionChanged=None,
        textToDisplayFunction=lambda: "",
        mouseoverTimeout=1000,
        onMouseover=None,
    ):
        """Create a code editor

        Parameters
        ----------

        keybindings: map
            map from keycode to a lambda function that will receive
            the current buffer and the current selection range when the user
            types ctrl-X and 'X' is a valid keycode. Common values here are also
            'Enter' and 'space'

        You may call 'setContents' to override the current contents of the editor.
        This version is not robust to mutiple users editing at the same time.

        onTextChange: func
            called when the text buffer changes with the new buffer
            and a json selection.

        textToDisplayFunction: func
            a function of no arguments that should return
            the current text we _ought_ to be displaying.

        onFirstRowChange - a function that is called when the first visible row
            changes. It takes one argument which is said row.

        onSelectionChanged - a function that is called when the selection changes.
            It gets called with None, or a dict with start_row, end_row, start_column,
            end_column.

        mouseoverTimeout - timeout for mouseover callback WS message in
            milliseconds

        onMouseover = a function which is called subsequent to the mouseover
            event fires on the client side and corresponding WS message is
            received.The entire message is passed to the function.
        """
        super().__init__()
        # contains (current_iteration_number: int, text: str)
        self.currentIteration = 0
        self.keybindings = keybindings or {}
        self.noScroll = noScroll
        self.fontSize = fontSize
        self.minLines = minLines
        self.readOnly = readOnly
        self.autocomplete = autocomplete
        self.onTextChange = onTextChange
        self.onSelectionChanged = onSelectionChanged
        self.textToDisplayFunction = textToDisplayFunction
        self.mouseoverTimeout = mouseoverTimeout
        self.onMouseover = onMouseover
        self.onFirstRowChange = onFirstRowChange

        if firstVisibleRow is not None:
            self.firstVisibleRowOverride = firstVisibleRow
        else:
            self.firstVisibleRowOverride = None

    def onMessage(self, msgFrame):
        if msgFrame["event"] == "keybinding":
            self.keybindings[msgFrame["key"]](msgFrame["buffer"], msgFrame["selection"])

        elif msgFrame["event"] == "editing":
            if (
                msgFrame["iteration"] is not None
                and self.currentIteration < msgFrame["iteration"]
            ):
                if msgFrame["buffer"] is not None:
                    self.exportData["initialText"] = msgFrame["buffer"]
                    self.currentIteration = msgFrame["iteration"]

                    if self.onTextChange:
                        self.onTextChange(msgFrame["buffer"], msgFrame["selection"])

                self.selectionSlot.set(msgFrame["selection"])

                if self.onSelectionChanged:
                    self.onSelectionChanged(msgFrame["selection"])

        elif msgFrame["event"] == "scrolling":
            self.firstVisibleRowSlot.set(msgFrame["firstVisibleRow"])
            if self.onFirstRowChange is not None:
                self.onFirstRowChange(msgFrame["firstVisibleRow"])
        elif msgFrame["event"] == "mouseover":
            if self.onMouseover is not None:
                self.onMouseover(msgFrame)

    def setFirstVisibleRow(self, rowNum):
        """ Send a message to set the first visible row of the editor to
        rowNum.

        Parameters
        ----------
        rowNum : int
        """
        self.firstVisibleRowSlot.set(rowNum)

        self.scheduleMessage({"firstVisibleRow": rowNum})

    def setSelection(self, selection):
        """ Send a message to set the first visible row of the editor to
        rowNum.

        Args:
            selection - a dict(
                start=dict(row=int, column=int),
                end=dict(row=int, column=int)
            )

            indicating what our selection state should be
        """
        assert isinstance(selection, dict)
        selection = dict(
            start=dict(row=selection["start"]["row"], column=selection["start"]["column"]),
            end=dict(row=selection["end"]["row"], column=selection["end"]["column"]),
        )

        self.selectionSlot.set(selection)

        self.scheduleMessage({"selection": selection})

    def setMarkers(self, markers):
        """Set the list of markers.

        Each marker must be a dict with:
            startRow
            endRow (optional)
            startColumn (optional)
            endColumn (only if startColumn)
            color (red, blue, green)
            label
        """
        res = []
        for m in markers:
            sm = {}
            sm["startRow"] = int(m["startRow"])
            sm["endRow"] = int(m.get("endRow", sm["startRow"]))
            sm["startColumn"] = int(m.get("startColumn", 0))
            sm["endColumn"] = int(m.get("endColumn", 1000))
            sm["color"] = m.get("color", "red")
            assert sm["color"] in ["red", "blue", "green"]
            if m.get("label"):
                sm["label"] = str(m.get("label"))
            res.append(sm)

        self.scheduleMessage({"updateMarkers": True, "markers": res})

    def focusEditor(self):
        """ Send a message to focus the editor immediately. """
        self.scheduleMessage({"focusNow": True})

    def setCurrentTextFromServer(self, text):
        if text is None:
            text = ""

        # prevent firing an event to the client if the text isn't actually
        # different than what we know locally.
        if text == self.exportData["initialText"]:
            return

        self.exportData["initialText"] = text

        self.currentIteration += 1000000

        self.scheduleMessage({"setTextFromServer": text, "iteration": self.currentIteration})

    def updateFromCallback(self):
        self.setCurrentTextFromServer(self.calculateCurrentText())

    def subscribedSlotChanged(self, slot):
        """Override the way we respond to a slot changing.

        Instead of recalculating, which would rebuild the component, we
        simply send a message to the server. Eventually this will used the 'data changed'
        channel
        """
        # we can't calculate this directly because we're on a message processing thread
        self.cells.scheduleCallback(self.updateFromCallback)

    def subscribedOdbValueChanged(self, odbKey):
        """Override the way we respond to an odb value changing.

        Instead of recalculating, which would rebuild the component, we
        simply send a message to the server. Eventually this will used the 'data changed'
        channel
        """
        # we can't calculate this directly because we're on a message processing thread
        self.cells.scheduleCallback(self.updateFromCallback)

    def calculateCurrentText(self):
        """Calculate the text we're supposed to display (according to the server)

        as part of this change, look at which values changed and make sure we subscribe
        correctly to them.
        """
        with ComputingCellContext(self):
            with self.view() as v:
                try:
                    return self.textToDisplayFunction()
                finally:
                    self._resetSubscriptionsToViewReads(v)

    @property
    def selectionSlot(self):
        return sessionState()._slotFor(self.identityPath + ("CodeEditorState",))

    @property
    def firstVisibleRowSlot(self):
        return sessionState()._slotFor(self.identityPath + ("CodeEditorStateFirstVisibleRow",))

    def recalculate(self):
        if self.firstVisibleRowOverride is not None:
            self.firstVisibleRowSlot.set(self.firstVisibleRowOverride)
            self.firstVisibleRowOverride = None

        self.exportData["initialText"] = self.calculateCurrentText()
        self.exportData["currentIteration"] = self.currentIteration
        self.exportData[
            "initialSelection"
        ] = self.selectionSlot.getWithoutRegisteringDependency()
        self.exportData["autocomplete"] = self.autocomplete
        self.exportData["noScroll"] = self.noScroll
        self.exportData["readOnly"] = self.readOnly

        if self.fontSize is not None:
            self.exportData["fontSize"] = self.fontSize
        if self.minLines is not None:
            self.exportData["minLines"] = self.minLines

        self.exportData[
            "firstVisibleRow"
        ] = self.firstVisibleRowSlot.getWithoutRegisteringDependency()

        self.exportData["mouseoverTimeout"] = self.mouseoverTimeout

        self.exportData["keybindings"] = [k for k in self.keybindings.keys()]
