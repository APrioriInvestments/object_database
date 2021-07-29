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


class Popover(Cell):
    def __init__(self, contents, title, detail, width=400):
        super().__init__()

        self.width = width
        contentCell = Cell.makeCell(contents)
        detailCell = Cell.makeCell(detail)
        titleCell = Cell.makeCell(title)
        self.children.addFromDict(
            {"content": contentCell, "detail": detailCell, "title": titleCell}
        )

    def recalculate(self):
        self.exportData["width"] = self.width

    def sortsAs(self):
        if self.children.hasChildNamed("title"):
            return self.children["title"].sortAs()
