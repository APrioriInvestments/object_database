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


class Card(Cell):
    def __init__(self, body, header=None, padding=None):
        super().__init__()

        self.padding = padding
        self.body = body
        self.header = header

    def recalculate(self):
        bodyCell = Cell.makeCell(self.body)
        self.children["body"] = bodyCell

        if self.header is not None:
            headerCell = Cell.makeCell(self.header)
            self.children["header"] = headerCell

        self.exportData["padding"] = self.padding

    def sortsAs(self):
        return self.contents.sortsAs()


class CardTitle(Cell):
    def __init__(self, inner):
        super().__init__()
        innerCell = Cell.makeCell(inner)
        self.children["inner"] = innerCell

    def sortsAs(self):
        return self.inner.sortsAs()