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


class Clickable(Cell):
    def __init__(self, content, onClick, makeBold=False, aTarget=None):
        """
        Args:
            content (Cell or something that auto-converts to a Cell): the cell to display
            onClick: str or zero-argument function that either returns a string which will be
                the link to follow, or that performs the action to be performed.
            makeBold (bool): should the text be bold
            aTarget (str): None or a target to an HTML <a> element. One of _blank, _self,
                _parent, _top, or a valid framename.
        """
        super().__init__()
        self.onClick = onClick
        self.content = Cell.makeCell(content)
        self.bold = makeBold
        self.target = aTarget

    def recalculate(self):
        self.children["content"] = self.content
        self.exportData["bold"] = self.bold

        if isinstance(self.onClick, str):
            self.exportData["url"] = self.onClick
            self.exportData["target"] = self.target

    def sortsAs(self):
        return self.content.sortsAs()

    def onMessage(self, msgFrame):
        redirectValue = self.onClick()

        if isinstance(redirectValue, str):
            self.scheduleMessage(
                {"action": "redirect", "url": redirectValue, "target": self.target}
            )


class Button(Clickable):
    def __init__(self, *args, small=False, active=True, style="primary", **kwargs):
        Clickable.__init__(self, *args, **kwargs)
        self.small = small
        self.active = active
        self.style = style

    def recalculate(self):
        super().recalculate()

        self.exportData["small"] = bool(self.small)
        self.exportData["active"] = bool(self.active)
        self.exportData["style"] = self.style


class ButtonGroup(Cell):
    def __init__(self, buttons):
        super().__init__()
        self.buttons = buttons

    def recalculate(self):
        self.children["buttons"] = self.buttons
