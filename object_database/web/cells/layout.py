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


class FillSpace(Cell):
    def __init__(self, content, horizontal=None, vertical=None):
        """Fill space horizontally or vertically (or both).

        Args:
            horizontal - one of None, "left", "right", or "center"
            vertical - one of None, "top", "bottom", or "center"
        """
        super().__init__()

        assert horizontal in (None, "left", "right", "center")
        assert vertical in (None, "top", "bottom", "center")

        self.children["content"] = Cell.makeCell(content)

        if horizontal:
            self.exportData["horizontal"] = horizontal

        if vertical:
            self.exportData["vertical"] = vertical


def HCenter(cell):
    """Take up horizontal space, and center the cell within it."""
    return FillSpace(cell, "center", None)


def VCenter(cell):
    """Take up vertical space, and center the cell within it."""
    return FillSpace(cell, None, "center")


def Center(cell):
    """Take up horizontal and vertical space, and center the cell within it."""
    return FillSpace(cell, "center", "center")


def Left(cell):
    """Take up horizontal space, and place the cell on the left side of it."""
    return FillSpace(cell, "left", None)


def Right(cell):
    """Take up horizontal space, and place the cell on the right side of it."""
    return FillSpace(cell, "right", None)


def Top(cell):
    """Take up vertical space, and place the cell at the top of it."""
    return FillSpace(cell, None, "top")


def Bottom(cell):
    """Take up vertical space, and place the cell at the bottom of it."""
    return FillSpace(cell, None, "bottom")


def TopLeft(cell):
    """Take up vertical and horizontal space, and place the cell at the top left of it."""
    return FillSpace(cell, "left", "top")


def TopRight(cell):
    """Take up vertical and horizontal space, and place the cell at the top right of it."""
    return FillSpace(cell, "right", "top")


def BottomLeft(cell):
    """Take up vertical and horizontal space, and place the cell at the bottom left of it."""
    return FillSpace(cell, "left", "bottom")


def BottomRight(cell):
    """Take up vertical and horizontal space, and place the cell at the bottom right of it."""
    return FillSpace(cell, "right", "bottom")
