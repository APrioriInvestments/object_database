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


class MenuItem(Cell):
    def __init__(self, content, onClick):
        """
        Args:
            content (Cell or something that auto-converts to a Cell): the cell to display
            onClick: str or zero-argument function that either returns a string which will be
                the link to follow, or that performs the action to be performed.
        """
        super().__init__()
        self.onClick = onClick
        self.content = Cell.makeCell(content)

    def recalculate(self):
        self.children["content"] = self.content

    def sortsAs(self):
        return self.content.sortsAs()

    def onMessage(self, msgFrame):
        self.onClick()
        self.parent.childHadUserAction(self, self)
