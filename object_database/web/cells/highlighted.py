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


class Highlighted(Cell):
    """Highlighted

    This cell acts as a generic, highlighted container.
    It has a single child Cell element which is displayed.

    Properties
    ----------
    content: Cell
        A child cell that will be displayed within
        the bordered Panel area.
    """

    def __init__(self, content=None, color=None):
        super().__init__()
        self.content = content
        self.color = color

        self.exportData["color"] = color

    def recalculate(self):
        self.children["content"] = Cell.makeCell(self.content)

    def sortsAs(self):
        return self.content.sortsAs()

    def __mul__(self, other):
        if self.content is None:
            return Highlighted(other, color=self.color)
        else:
            return Highlighted(self.content * other, color=self.color)
