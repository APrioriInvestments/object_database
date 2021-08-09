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
from object_database.web.cells.slot import Slot
from object_database.web.cells.subscribed import Subscribed


class ContextMenu(Cell):
    """Allow right-click to show a wrappedCell with arbitrary content"""

    def __init__(self, wrappedCell, content):
        """
        Parameters
        ----------
        wrappedCell - a cell we're augmenting with a contexual menu
        content - the contents of the dropdown when its open.
        """
        super().__init__()
        self.isOpen = Slot(False)

        self.contentCell = Subscribed(
            lambda: Cell.makeCell(content) if self.isOpen.get() else None
        )
        self.menuCell = Cell.makeCell(wrappedCell)

        self.children["content"] = self.contentCell
        self.children["wrappedCell"] = self.menuCell

    def onMessage(self, msgFrame):
        if "open_state" in msgFrame:
            self.isOpen.set(msgFrame["open_state"])

    def childHadUserAction(self, directChild, deepChild):
        if directChild is self.children["content"]:
            self.scheduleMessage({"action": "force-close"})
        else:
            self.parent.childHadUserAction(self, deepChild)
