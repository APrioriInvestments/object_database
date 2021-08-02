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


class Flex(Cell):
    """Flex Cell

    This cell acts as a generic spacefilling container within the context of
    a sequence.
    """

    def __init__(self, content):
        super().__init__()

        self.content = Cell.makeCell(content)

    def recalculate(self):
        self.children["content"] = Cell.makeCell(self.content)
