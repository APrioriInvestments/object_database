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
import time

class NewBasicSheet(CellsTestPage):
    def cell(self):
        # Create the datasource
        datasource = [["{},{}".format(i, j) for j in range(100)] for i in range(10)]

        def colFun(start_column, end_column, num_columns=10):
            columns = []
            if start_column >= num_columns:
                return columns
            for i in range(start_column, min(end_column, num_columns)):
                columns.append("Column {}".format(i))
            return columns

        def rowFun(start_row, end_row, start_column, end_column, num_rows=100, num_columns=10):
            rows = []
            if start_row >= num_rows or start_column >= num_columns:
                return rows
            end_column = min(end_column, num_columns)
            end_row = min(end_row, num_rows)
            for i in range(start_row, end_row):
                r = [datasource[j][i] for j in range(start_column, end_column)]
                rows.append(r)
            return rows
        return cells.Sheet(colFun, rowFun, colWidth=75, rowHeight=30)

    def text(self):
        return "Basic demo on 10x100 datasource"


class NewBasicSheetWithDelay(CellsTestPage):
    def cell(self):
        # Create the datasource
        datasource = [["{},{}".format(i, j) for j in range(100)] for i in range(10)]

        def colFun(start_column, end_column, num_columns=10):
            columns = []
            if start_column >= num_columns:
                return columns
            for i in range(start_column, min(end_column, num_columns)):
                columns.append("Column {}".format(i))
            return columns

        def rowFun(start_row, end_row, start_column, end_column, num_rows=100, num_columns=10):
            rows = []
            if start_row >= num_rows or start_column >= num_columns:
                return rows
            end_column = min(end_column, num_columns)
            end_row = min(end_row, num_rows)
            for i in range(start_row, end_row):
                r = [datasource[j][i] for j in range(start_column, end_column)]
                rows.append(r)
            time.sleep(0.2)
            return rows
        return cells.Sheet(colFun, rowFun, colWidth=75, rowHeight=30)

    def text(self):
        return "Basic demo on 10x100 datasource, with a 0.2s delay"


class BasicSheet(CellsTestPage):
    def cell(self):
        num_columns = 3

        def colFun(start_column, end_column, num_columns=num_columns):
            columns = []
            if start_column >= num_columns:
                return columns
            for i in range(start_column, min(end_column, num_columns)):
                columns.append("column_%s" % i)
            return columns

        def rowFun(start_row, end_row, start_column, end_column,
                   num_rows=100, num_columns=num_columns):
            rows = []
            if start_row >= num_rows or start_column > num_columns:
                return rows
            end_column = min(end_column, num_columns)
            end_row = min(end_row, num_rows)
            for i in range(start_row, end_row):
                r = ["index_%s" % i] + ["entry_%s_%s" % (i, j) for j in
                                        range(start_column, end_column)]
                rows.append(r)
            return rows
        return cells.Sheet(colFun, rowFun, colWidth=70, rowHeight=25)

    def text(self):
        return "You should see a basic sheet."


class BiggerSheet(CellsTestPage):
    def cell(self):
        num_columns = 300
        num_rows = 10000

        def colFun(start_column, end_column, num_columns=num_columns):
            columns = []
            if start_column >= num_columns:
                return columns
            for i in range(start_column, min(end_column, num_columns)):
                columns.append("column_%s" % i)
            return columns

        def rowFun(start_row, end_row, start_column, end_column,
                   num_rows=num_rows, num_columns=num_columns):
            rows = []
            if start_row >= num_rows or start_column > num_columns:
                return rows
            end_column = min(end_column, num_columns)
            end_row = min(end_row, num_rows)
            for i in range(start_row, end_row):
                r = ["index_%s" % i] + ["entry_%s_%s" % (i, j) for j in
                                        range(start_column, end_column)]
                rows.append(r)
            return rows

        return cells.Sheet(colFun, rowFun, colWidth=80)

    def text(self):
        return "You should see a bigger sheet."
