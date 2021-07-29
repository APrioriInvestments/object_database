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


class SingleLineTextBox(Cell):
    def __init__(self, slot, pattern=None, width=None):
        super().__init__()
        self.pattern = None
        self.slot = slot

        if width:
            self.exportData["width"] = width

    def recalculate(self):
        if self.pattern:
            self.exportData["pattern"] = self.pattern

        newText = self.getText()

        if newText != self.exportData.get("defaultValue"):
            self.exportData["defaultValue"] = newText
            self.markDirty()

    def getText(self):
        with ComputingCellContext(self):
            with self.view() as v:
                try:
                    return self.slot.get()
                finally:
                    self._resetSubscriptionsToViewReads(v)

    def onMessage(self, msgFrame):
        self.slot.set(msgFrame["text"])
