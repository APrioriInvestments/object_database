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


class Sized(Cell):
    def __init__(self, content=None, height=None, width=None):
        super().__init__()
        if content is not None:
            self.content = Cell.makeCell(content)
        else:
            self.content = None

        self.height = height
        self.width = width

        self.exportData["height"] = height
        self.exportData["width"] = width

        if self.content is not None:
            self.children["content"] = Cell.makeCell(self.content)

    def __mul__(self, other):
        return Sized(
            content=other if self.content is None else self.content * other,
            height=self.height,
            width=self.width,
        )

    def sortsAs(self):
        return self.content.sortsAs()
