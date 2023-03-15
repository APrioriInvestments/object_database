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
from object_database.web.cells.leaves import Octicon
from object_database.web.cells.session_state import sessionState


class Expands(Cell):
    def __init__(self, closed, open, closedIcon=None, openedIcon=None):
        super().__init__()

        self.closed = closed
        self.open = open
        self.openedIcon = openedIcon or Octicon("diff-removed")
        self.closedIcon = closedIcon or Octicon("diff-added")

    @property
    def isExpanded(self):
        isExpandedSlot = sessionState().slotFor(self.identityPath + ("ExpandsState",))

        return isExpandedSlot.get() or False

    @isExpanded.setter
    def isExpanded(self, isExpanded):
        isExpandedSlot = sessionState().slotFor(self.identityPath + ("ExpandsState",))

        isExpandedSlot.set(bool(isExpanded))

    def sortsAs(self):
        if self.isExpanded:
            return self.open.sortsAs()
        return self.closed.sortsAs()

    def recalculate(self):
        isExpanded = self.isExpanded

        self.children["content"] = self.open if isExpanded else self.closed
        self.children["icon"] = self.openedIcon if isExpanded else self.closedIcon

        self.exportData["isOpen"] = isExpanded

    def onMessage(self, msgFrame):
        self.isExpanded = not self.isExpanded
