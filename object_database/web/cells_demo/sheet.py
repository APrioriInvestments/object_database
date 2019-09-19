#   Coyright 2017-2019 Nativepython Authors
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

from object_database.web import cells as cells
from object_database.web.CellsTestPage import CellsTestPage


class BasicSheet(CellsTestPage):
    def cell(self):
        colFun = lambda colIx: "Col_%s" % colIx
        rowFun = lambda rowIx: ["(%s) ts" % rowIx, rowIx, rowIx+1, rowIx+2]
        return cells.Sheet(colFun, rowFun, colWidth=50, rowHeight=25)

    def text(self):
        return "You should see a basic sheet."


class BiggerSheet(CellsTestPage):
    def cell(self):
        num_rows = 10000
        colFun = lambda colIx: "Col_%s" % colIx
        rowFun = lambda rowIx: ["(%s) ts" % rowIx for rowIx in range(num_rows)]
        return cells.Sheet(colFun, rowFun)

    def text(self):
        return "You should see a bigger sheet."
