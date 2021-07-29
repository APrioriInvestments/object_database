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


class Container(Cell):
    # TODO: Figure out what this Cell
    # actually needs to do, ie why
    # we need this setContents method
    # now that we are not using contents strings
    def __init__(self, child=None):
        super().__init__()
        if child is None:
            self.children["child"] = None
        else:
            childCell = Cell.makeCell(child)
            self.children["child"] = childCell

    def setChild(self, child):
        self.setContents("", child)

    def setContents(self, newContents, newChildren):
        self.children["child"] = Cell.makeCell(newChildren)
        self.markDirty()
