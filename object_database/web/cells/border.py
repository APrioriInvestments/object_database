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


class Border(Cell):
    def __init__(
        self,
        border=None,
        content=None,
        left=None,
        right=None,
        top=None,
        bottom=None,
        radius=None,
        backgroundColor=None,
    ):
        super().__init__()

        if (
            border is None
            and left is None
            and right is None
            and top is None
            and bottom is None
        ):
            border = 1

        def addPx(x, addSolid=True):
            if isinstance(x, (float, int)):
                if addSolid:
                    return f"{x}px solid"
                else:
                    return f"{x}px"
            return x

        self.content = content
        self.left = self.exportData["left"] = addPx(border if left is None else left)
        self.right = self.exportData["right"] = addPx(border if right is None else right)
        self.top = self.exportData["top"] = addPx(border if top is None else top)
        self.bottom = self.exportData["bottom"] = addPx(border if bottom is None else bottom)
        self.radius = self.exportData["radius"] = addPx(radius, addSolid=False)
        self.backgroundColor = self.exportData["backgroundColor"] = backgroundColor

    def recalculate(self):
        if self.content is not None:
            self.children["content"] = Cell.makeCell(self.content)

    def __mul__(self, other):
        return Border(
            border=None,
            content=other if self.content is None else self.content * other,
            left=self.left,
            right=self.right,
            top=self.top,
            bottom=self.bottom,
            radius=self.radius,
            backgroundColor=self.backgroundColor,
        )
