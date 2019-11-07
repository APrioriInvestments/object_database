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

# import time


class BasicSheet(CellsTestPage):
    def cell(self):
        num_columns = 3
        num_rows = 50

        def rowFun(
            start_row,
            end_row,
            start_column,
            end_column,
            num_rows=num_rows,
            num_columns=num_columns,
        ):
            rows = []
            if start_row >= num_rows or start_column > num_columns:
                return rows
            end_column = min(end_column, num_columns)
            end_row = min(end_row, num_rows)
            for i in range(start_row, end_row + 1):
                r = ["entry_%s_%s" % (j, i) for j in range(start_column, end_column + 1)]
                rows.append(r)
            return rows

        return cells.Sheet(
            rowFun, colWidth=100, rowHeight=25, totalColumns=num_columns, totalRows=num_rows
        )

    def text(self):
        return "You should see a basic sheet."


class BiggerSheet(CellsTestPage):
    def cell(self):
        num_columns = 300
        num_rows = 10000

        def rowFun(
            start_row,
            end_row,
            start_column,
            end_column,
            num_rows=num_rows,
            num_columns=num_columns,
        ):
            rows = []
            if start_row >= num_rows or start_column > num_columns:
                return rows
            end_column = min(end_column, num_columns)
            end_row = min(end_row, num_rows)
            for i in range(start_row, end_row + 1):
                r = ["entry_%s_%s" % (j, i) for j in range(start_column, end_column + 1)]
                rows.append(r)
            return rows

        return cells.Sheet(rowFun, colWidth=80, totalColumns=num_columns, totalRows=num_rows)

    def text(self):
        return "You should see a bigger sheet."


class BasicSheetLockedRowsColumns(CellsTestPage):
    def cell(self):
        num_columns = 3
        num_rows = 50

        def rowFun(
            start_row,
            end_row,
            start_column,
            end_column,
            num_rows=num_rows,
            num_columns=num_columns,
        ):
            rows = []
            if start_row >= num_rows or start_column > num_columns:
                return rows
            end_column = min(end_column, num_columns)
            end_row = min(end_row, num_rows)
            for i in range(start_row, end_row + 1):
                r = ["entry_%s_%s" % (j, i) for j in range(start_column, end_column + 1)]
                rows.append(r)
            return rows

        return cells.Sheet(
            rowFun,
            colWidth=100,
            rowHeight=25,
            totalColumns=num_columns,
            totalRows=num_rows,
            numLockRows=2,
            numLockColumns=1,
        )

    def text(self):
        return "You should see a basic sheet."


class BiggerSheetLockedRowsColumns(CellsTestPage):
    def cell(self):
        num_columns = 300
        num_rows = 10000

        def rowFun(
            start_row,
            end_row,
            start_column,
            end_column,
            num_rows=num_rows,
            num_columns=num_columns,
        ):
            rows = []
            if start_row >= num_rows or start_column > num_columns:
                return rows
            end_column = min(end_column, num_columns)
            end_row = min(end_row, num_rows)
            for i in range(start_row, end_row + 1):
                r = ["entry_%s_%s" % (j, i) for j in range(start_column, end_column + 1)]
                rows.append(r)
            return rows

        return cells.Sheet(
            rowFun,
            colWidth=80,
            totalColumns=num_columns,
            totalRows=num_rows,
            numLockRows=1,
            numLockColumns=2,
        )

    def text(self):
        return "You should see a bigger sheet."
