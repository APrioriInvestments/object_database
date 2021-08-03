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
        columns = cells.Slot(4)
        rows = cells.Slot(20)
        offset = cells.Slot(0)

        def updownSetter(name, slot):
            return (
                cells.Subscribed(lambda: f"{name}: {slot.get()}")
                + cells.Button("Up", lambda: slot.set(slot.get() + 1))
                + cells.Button("Up10", lambda: slot.set(slot.get() + 10))
                + cells.Button("Down", lambda: slot.set(slot.get() - 1))
            )

        return (
            updownSetter("Rows", rows)
            >> updownSetter("Columns", columns)
            >> updownSetter("Offset", offset)
        ) + cells.Scrollable(
            cells.Table(
                colFun=lambda: [f"Col{i+1}" for i in range(columns.get())],
                rowFun=lambda: list(range(rows.get())),
                headerFun=lambda x: x,
                rendererFun=lambda w, field: f"{field} {w} {offset.get()}",
                maxRowsPerPage=50,
                sortColumn="Col1",
                sortColumnAscending=True,
            )
        )

    def text(self):
        return (
            "You should see a table with two columns, "
            "two pages of 50 rows and all fields saying 'hi'"
        )


class TableNoScrollWithAndWithoutFlex(CellsTestPage):
    def cell(self):
        columns = cells.Slot(4)
        rows = cells.Slot(10)
        offset = cells.Slot(0)
        fillWidth = cells.Slot(False)
        fillHeight = cells.Slot(False)

        def updownSetter(name, slot):
            return (
                cells.Subscribed(lambda: f"{name}: {slot.get()}")
                + cells.Button("Up", lambda: slot.set(slot.get() + 1))
                + cells.Button("Up10", lambda: slot.set(slot.get() + 10))
                + cells.Button("Down", lambda: slot.set(slot.get() - 1))
            )

        return (
            updownSetter("Rows", rows)
            >> updownSetter("Columns", columns)
            >> updownSetter("Offset", offset)
            >> cells.Button("ChangeFillWidth", fillWidth.toggle)
            >> cells.Button("ChangeFillHeight", fillHeight.toggle)
        ) + cells.Subscribed(
            lambda: cells.ResizablePanel(
                cells.Text("Hi")
                + cells.Flex(
                    cells.Table(
                        colFun=lambda: [f"Col{i+1}" for i in range(columns.get())],
                        rowFun=lambda: list(range(rows.get())),
                        headerFun=lambda x: x,
                        rendererFun=lambda w, field: f"{field} {w} {offset.get()}",
                        maxRowsPerPage=50,
                        sortColumn="Col1",
                        sortColumnAscending=True,
                        fillWidth=fillWidth.get(),
                        fillHeight=fillHeight.get(),
                    )
                ),
                cells.Text("Hi")
                + cells.Table(
                    colFun=lambda: [f"Col{i+1}" for i in range(columns.get())],
                    rowFun=lambda: list(range(rows.get())),
                    headerFun=lambda x: x,
                    rendererFun=lambda w, field: f"{field} {w} {offset.get()}",
                    maxRowsPerPage=50,
                    sortColumn="Col1",
                    sortColumnAscending=True,
                    fillWidth=fillWidth.get(),
                    fillHeight=fillHeight.get(),
                ),
            )
        )

    def text(self):
        return (
            "You should see a table with two columns, "
            "two pages of 50 rows and all fields saying 'hi'"
        )
