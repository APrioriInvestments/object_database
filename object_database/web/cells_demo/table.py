#   Copyright 2017-2019 object_database Authors
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


class MultiPageTable(CellsTestPage):
    def cell(self):
        return cells.Table(
            colFun=lambda: ["Col 1", "Col 2"],
            rowFun=lambda: list(range(100)),
            headerFun=lambda x: x,
            rendererFun=lambda w, field: "hi",
            maxRowsPerPage=50,
        )

    def text(self):
        return (
            "You should see a table with two columns, "
            "two pages of 50 rows and all fields saying 'hi'"
        )


class TableWithEditStructure(CellsTestPage):
    def cell(self):
        rows = cells.Slot((1, 2, 3))
        rowData = {1: cells.Slot("hi"), 2: cells.Slot("bye"), 3: cells.Slot("yoyo")}

        def renderFun(rowLabel, fieldname):
            data = rowData.setdefault(rowLabel, cells.Slot("empty"))

            if fieldname == "Delete":
                return cells.Button(
                    cells.Octicon("trashcan"),
                    lambda: rows.set(tuple(x for x in rows.get() if x != rowLabel)),
                )
            if fieldname == "Edit":
                return cells.SingleLineTextBox(data)
            if fieldname == "Contents":
                return cells.Subscribed(lambda: data.get())

        return cells.Button(
            "new", lambda: rows.set(rows.get() + (max(rows.get()) + 1,))
        ) + cells.ResizablePanel(
            cells.Table(
                colFun=lambda: ["Delete", "Edit", "Contents"],
                rowFun=lambda: rows.get(),
                headerFun=lambda x: x,
                rendererFun=renderFun,
                maxRowsPerPage=50,
            ),
            cells.Table(
                colFun=lambda: ["Delete", "Edit", "Contents"],
                rowFun=lambda: rows.get(),
                headerFun=lambda x: x,
                rendererFun=renderFun,
                maxRowsPerPage=50,
            ),
        )

    def text(self):
        return (
            "You should see a table with several rows, a button to add new rows, "
            "a delete button on each row, and an edit box on each cell's text. "
            "If you change the text and hit enter, you should see the page re-sort."
        )
