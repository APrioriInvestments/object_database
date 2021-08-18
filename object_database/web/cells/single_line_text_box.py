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
from object_database.web.cells.slot import Slot


class SingleLineTextBox(FocusableCell):
    def __init__(
        self,
        initialText="",
        onTextChanged=None,
        onEnter=None,
        onEsc=None,
        font=None,
        textSize=None,
    ):
        """Construct a single-line text box.

        It will fill the width available to it, but it's always just one line.

        Args:
            initialText - the text to display when its first built, or a slot.
                if the slot value changes,
            onTextChanged - callback whenever the text is modified by the user.
                Gets called with (newText)
            onEnter - callback that gets called whenever the user hits 'enter'
                on the text box. Gets called with the current text.
            onEsc - callback that gets called whenever the user hits 'esc' on the
                textbox.
            font - a font override
            textSize - a textSize override
        """
        super().__init__()

        if isinstance(initialText, str):
            self.currentText = Slot(initialText)
        else:
            self.currentText = initialText

        self.currentText.addListener(self.slotValueChanged)

        self.onTextChanged = onTextChanged
        self.onEnter = onEnter
        self.onEsc = onEsc
        self.font = font
        self.textSize = textSize

    def slotValueChanged(self, oldValue, newValue, reason):
        if reason != "client-message":
            self.scheduleMessage({"event": "textChanged", "text": newValue})

    def recalculate(self):
        self.exportData["initialText"] = self.currentText.getWithoutRegisteringDependency()
        self.exportData["font"] = self.font
        self.exportData["textSize"] = self.textSize

    def onMessage(self, msgFrame):
        if msgFrame.get("event") == "gainFocus":
            self.onFocusGainedOnClient()

        if msgFrame.get("event") == "userEdit":
            self.currentText.set(msgFrame.get("text"), "client-message")

            if self.onTextChanged:
                self.onTextChanged(msgFrame.get("text"))

        if msgFrame.get("event") == "escape":
            if self.onEsc:
                self.onEsc()

        if msgFrame.get("event") == "enter":
            if self.onEnter:
                self.onEnter(self.currentText.get())
