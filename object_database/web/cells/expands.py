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
from object_database.web.cells.session_state import SessionState


class Expands(Cell):
    # TODO: Do the icons really need to be their own Cell objects?
    # In fact, does Octicon need to be its own Cell class/object at all,
    # considering it is a styling/visual issue that can
    # more easily be handled by passing names to the front end?
    def __init__(self, closed, open, closedIcon=None, openedIcon=None):
        super().__init__()
        self.closed = closed
        self.open = open
        self.openedIcon = openedIcon or Octicon("diff-removed")
        self.closedIcon = closedIcon or Octicon("diff-added")

        # if we get 'isExpanded' written to before we get calculated, we write here.
        self.toWrite = None

    @property
    def isExpanded(self):
        if self.toWrite is not None:
            return self.toWrite

        if self.cells is None:
            return False

        return self.getContext(SessionState).get(self.identityPath + ("ExpandState",)) or False

    @isExpanded.setter
    def isExpanded(self, isExpanded):
        if self.cells is None:
            self.toWrite = isExpanded
            return

        return self.getContext(SessionState).set(
            self.identityPath + ("ExpandState",), bool(isExpanded)
        )

    def sortsAs(self):
        if self.isExpanded:
            return self.open.sortsAs()
        return self.closed.sortsAs()

    def recalculate(self):
        if self.toWrite is not None:
            self.isExpanded = self.toWrite
            self.toWrite = None

        self.children.addFromDict(
            {
                "content": self.open if self.isExpanded else self.closed,
                "icon": self.openedIcon if self.isExpanded else self.closedIcon,
            }
        )

        self.exportData["isOpen"] = self.isExpanded

        for c in self.children.allChildren:
            if c.cells is not None:
                c.prepareForReuse()

    def onMessage(self, msgFrame):
        self.isExpanded = not self.isExpanded
