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
        num_columns = 3

        def colFun(start, end, cutoff=num_columns):
            columns = []
            if start >= cutoff:
                return columns
            for i in range(start, min(end, cutoff)):
                columns.append("column_%s" % i)
            return columns

        def rowFun(start, end, cutoff=100, num_columns=num_columns):
            rows = []
            if start >= cutoff:
                return rows
            for i in range(start, min(end, cutoff)):
                r = ["index_%s" % i] + ["entry_%s_%s" % (i, j) for j in
                                        range(num_columns)]
                rows.append(r)
            return rows
        return cells.Sheet(colFun, rowFun, colWidth=50, rowHeight=25)

    def text(self):
        return "You should see a basic sheet."


class BiggerSheet(CellsTestPage):
    def cell(self):
        num_columns = 300
        num_rows = 10000

        def colFun(start, end, cutoff=num_columns):
            columns = []
            if start >= cutoff:
                return columns
            for i in range(start, min(end, cutoff)):
                columns.append("column_%s" % i)
            return columns

        def rowFun(start, end, cutoff=num_rows, num_columns=num_columns):
            rows = []
            if start >= cutoff:
                return rows
            for i in range(start, min(end, cutoff)):
                r = ["index_%s" % i] + ["entry_%s_%s" % (i, j) for j in
                                        range(num_columns)]
                rows.append(r)
            return rows
        return cells.Sheet(colFun, rowFun)

    def text(self):
        return "You should see a bigger sheet."
