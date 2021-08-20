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


class Popover(Cell):
    def __init__(self, contents, title, detail, width=400):
        super().__init__()

        self.width = width
        self.isOpen = Slot(False)

        self.contentCell = Cell.makeCell(contents)
        self.detailCell = Subscribed(
            lambda: Cell.makeCell(detail) if self.isOpen.get() else None
        )
        self.titleCell = Subscribed(
            lambda: Cell.makeCell(title) if self.isOpen.get() else None
        )

        self.children["content"] = self.contentCell
        self.children["detail"] = self.detailCell
        self.children["title"] = self.titleCell

        self.exportData["width"] = self.width

    def sortsAs(self):
        return self.contentCell.sortsAs()

    def onMessage(self, msgFrame):
        if "open_state" in msgFrame:
            self.isOpen.set(msgFrame["open_state"])
