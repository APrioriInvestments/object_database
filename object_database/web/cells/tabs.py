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


class _NavTab(Cell):
    def __init__(self, slot, index, child):
        super().__init__()

        self.slot = slot
        self.index = index
        self.child = Cell.makeCell(child)
        self.children["child"] = self.child

    def recalculate(self):
        if self.index == self.slot.get():
            self.exportData["isActive"] = True
        else:
            self.exportData["isActive"] = False

    def onMessage(self, msgFrame):
        self.slot.set(self.index)


class Tabs(Cell):
    def __init__(self, headersAndChildren=(), **headersAndChildrenKwargs):
        super().__init__()

        self.whichSlot = Slot(0)
        self.headersAndChildren = list(headersAndChildren)
        self.headersAndChildren.extend(headersAndChildrenKwargs.items())

    def sortsAs(self):
        return None

    def setSlot(self, index):
        self.whichSlot.set(index)

    def recalculate(self):
        self.children["display"] = Subscribed(
            lambda: self.headersAndChildren[self.whichSlot.get()][1]
        )

        headersToAdd = []

        for i in range(len(self.headersAndChildren)):
            headersToAdd.append(_NavTab(self.whichSlot, i, self.headersAndChildren[i][0]))

        self.children["headers"] = headersToAdd
