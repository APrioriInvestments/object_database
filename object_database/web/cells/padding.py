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


class Padding(Cell):
    def __init__(
        self, padding=None, content=None, left=None, right=None, top=None, bottom=None
    ):
        super().__init__()

        if (
            padding is None
            and left is None
            and right is None
            and top is None
            and bottom is None
        ):
            padding = 2

        self.content = content
        self.left = self.exportData["left"] = padding if left is None else left
        self.right = self.exportData["right"] = padding if right is None else right
        self.top = self.exportData["top"] = padding if top is None else top
        self.bottom = self.exportData["bottom"] = padding if bottom is None else bottom

    def recalculate(self):
        if self.content is not None:
            self.children["content"] = Cell.makeCell(self.content)

    def sortsAs(self):
        if self.content is not None:
            return self.content.sortsAs()
        else:
            return None

    def __mul__(self, other):
        return Padding(
            padding=None,
            content=other if self.content is None else self.content * other,
            left=self.left,
            right=self.right,
            top=self.top,
            bottom=self.bottom,
        )
