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
from object_database.web.cells.layout import Left
from object_database.web.cells.sized import Sized
from object_database.web.cells.padding import Padding
from object_database.web.cells.card import Card
from object_database.web.cells.slot import Slot
from object_database.web.cells.computed_slot import ComputedSlot
from object_database.web.cells.subscribed import Subscribed
from object_database.web.cells.button import Clickable, Button
from object_database.web.cells.single_line_text_box import SingleLineTextBox
from object_database.web.cells.leaves import Octicon, Text
from object_database.web.cells.sort_wrapper import SortWrapper

import time
import logging


class TableHeader(Cell):
    """A single row in a table."""

    def __init__(
        self,
        columnsSlot,
        headerFun,
        sortColumnSlot,
        sortAscendingSlot,
        columnFiltersSlot,
        curPageSlot,
        sortedRowsSlot,
        maxRowsPerPage,
    ):
        super().__init__()

        self.columnsSlot = columnsSlot

        self.sortColumnSlot = sortColumnSlot
        self.sortAscendingSlot = sortAscendingSlot
        self.columnFiltersSlot = columnFiltersSlot
        self.maxRowsPerPage = maxRowsPerPage

        self.curPageSlot = curPageSlot
        self.sortedRowsSlot = sortedRowsSlot

        self.headerFun = headerFun
        self.cols = []

    def buildPageWidget(self):
        totalRows = len(self.sortedRowsSlot.get() or [])

        totalPages = (totalRows - 1) // self.maxRowsPerPage + 1

        if totalPages <= 1:
            pageCell = Cell.makeCell(totalPages)
        else:

            def makeTableWidget():
                def setPageSlot(text):
                    try:
                        intOfText = int(text)
                    except Exception:
                        textBox.currentText.set(textBox.initialText)
                        return

                    self.curPageSlot.set(min(max(0, intOfText - 1), totalPages - 1))

                textBox = SingleLineTextBox(
                    str(self.curPageSlot.get() + 1), onEnter=setPageSlot
                )

                return Sized(textBox, width=40)

            pageCell = Subscribed(makeTableWidget)

        pageCell = pageCell >> Padding() >> Text(f"of {totalPages}")

        if self.curPageSlot.get() == 0:
            leftCell = Octicon("triangle-left", color="lightgray")
        else:
            leftCell = Clickable(
                Octicon("triangle-left"),
                lambda: self.curPageSlot.set(max(0, self.curPageSlot.get() - 1)),
            )
        if self.curPageSlot.get() >= totalPages - 1:
            rightCell = Octicon("triangle-right", color="lightgray")
        else:
            rightCell = Clickable(
                Octicon("triangle-right"),
                lambda: self.curPageSlot.set(min(self.curPageSlot.get() + 1, totalPages - 1)),
            )

        return Card(Left(pageCell >> Padding() >> leftCell >> rightCell), padding=1)

    def recalculate(self):
        self.cols = self.columnsSlot.get()

        self.children["cells"] = [Subscribed(lambda: self.buildPageWidget())] + [
            self.makeHeaderCell(i) for i in range(len(self.cols))
        ]

    def makeHeaderCell(self, col_ix):
        col = self.cols[col_ix]

        def icon():
            if self.sortColumnSlot.get() != col:
                return ""
            return Octicon("arrow-up" if not self.sortAscendingSlot.get() else "arrow-down")

        cell = Subscribed(lambda: self.headerFun(col)) >> Padding() >> Subscribed(icon)

        def onClick():
            if self.sortColumnSlot.get() == col:
                self.sortAscendingSlot.set(not self.sortAscendingSlot.get())
            else:
                self.sortColumnSlot.set(col)
                self.sortAscendingSlot.set(False)

        clickToSort = Clickable(cell, onClick, makeBold=True)

        # build a 'slot' that projects the entire columnFilterSlot (which encodes the
        # set of filters for all columns as a tuple of (colname, filter) values) down to
        # a slot that just has this particular column
        def setColFilter(newVal):
            existingValues = dict(self.columnFiltersSlot.get())

            if newVal is not None:
                existingValues[col] = newVal
            else:
                existingValues.pop(col, None)

            self.columnFiltersSlot.set(tuple(sorted(existingValues.items())))

        columnFilterSlot = ComputedSlot(
            lambda: dict(self.columnFiltersSlot.get()).get(col), onSet=setColFilter
        )

        def makeFilterBox():
            isNone = ComputedSlot(lambda: columnFilterSlot.get() is None)

            if isNone.get():
                return Clickable(Octicon("search"), lambda: columnFilterSlot.set(""))
            else:
                return SingleLineTextBox(columnFilterSlot) >> Button(
                    Octicon("x"), lambda: columnFilterSlot.set(None), small=True
                )

        return Card(Left(clickToSort >> Subscribed(makeFilterBox)), padding=1)


class TableRow(Cell):
    """A single row in a table."""

    def __init__(self, columnsSlot, rendererFun, rowKey):
        super().__init__()

        self.columnsSlot = columnsSlot
        self.rendererFun = rendererFun
        self.rowKey = rowKey
        self.cols = []

    def recalculate(self):
        self.cols = self.columnsSlot.get()

        self.children["cells"] = [Text("")] + [
            Subscribed.bind(self.rendererFun, self.rowKey, col)
            for col in self.cols
        ]


def sortedRowsComputedSlot(
    rowFun, rendererFun, columnFiltersSlot, sortColumnSlot, sortColumnAscendingSlot
):
    """Build a ComputedSlot that contains the sorted rows of the table."""
    subslotCache = {}

    def makeSlotComputer(col, row):
        return ComputedSlot(lambda: Cell.makeCell(rendererFun(row, col)))

    def getValueFor(col, row):
        rowDict = subslotCache.setdefault(row, {})

        if col not in rowDict:
            rowDict[col] = makeSlotComputer(col, row)

        return rowDict[col].get()

    def matchesFilter(cell, filterText):
        cellStr = cell.sortsAs()
        if cellStr is None:
            cellStr = ""
        else:
            cellStr = str(cellStr)

        return filterText in cellStr

    def computeSortedRows():
        t0 = time.time()

        rows = tuple(rowFun())

        if columnFiltersSlot.get():
            for colKey, filterText in columnFiltersSlot.get():
                rows = [r for r in rows if matchesFilter(getValueFor(colKey, r), filterText)]

        # now sort the rows
        if sortColumnSlot.get():
            sortCol = sortColumnSlot.get()

            rows = sorted(rows, key=lambda r: SortWrapper(getValueFor(sortCol, r)))

            if not sortColumnAscendingSlot.get():
                rows = list(rows[::-1])

        if time.time() - t0 > 0.1:
            logging.info("Spent %.2f seconds evaluating a row list.", time.time() - t0)

        return rows

    return ComputedSlot(computeSortedRows)


class Table(Cell):
    """An active table with paging, filtering, sortable columns."""

    def __init__(
        self,
        colFun,
        rowFun,
        headerFun,
        rendererFun,
        maxRowsPerPage=20,
        sortColumn=None,
        sortColumnAscending=True,
        fillWidth=False,
        fillHeight=False,
    ):
        """
        Args:
            colFun: a function from nothing to a list of column names
            rowFun: a function from nothing to a list of row elements.
                Typically this is something like lambda: schema.Type.lookupAll()
            headerFun: usually lambda x: x
            rendererFun: a function from (row, column:str) to the value of that cell
            maxRowsPerPage (int): max number of rows per page
            sortColumn (int or None): index of column to sort (starts at 0).
            sortColumnAscending (bool): ascending or descending sorting.
        """
        super().__init__()
        self.colFun = colFun
        self.rowFun = rowFun
        self.headerFun = headerFun
        self.rendererFun = rendererFun

        self.rowKeys = []
        self.rowDict = {}

        self.fillWidth = fillWidth
        self.fillHeight = fillHeight

        self.maxRowsPerPage = maxRowsPerPage

        # the current page of results, zero based.
        self.curPageSlot = Slot(0)

        # tuple of (colKey, filter) pairs containing the currently attached filters
        self.columnFiltersSlot = Slot(())

        # the current column name to sort on
        self.sortColumnSlot = Slot(sortColumn)

        # should we sort ascending or descending
        self.sortColumnAscendingSlot = Slot(sortColumnAscending)

        self.columnsComputedSlot = ComputedSlot(
            lambda: list(self.colFun())
        )

        self.sortedRowsSlot = sortedRowsComputedSlot(
            self.rowFun,
            self.rendererFun,
            self.columnFiltersSlot,
            self.sortColumnSlot,
            self.sortColumnAscendingSlot,
        )

        self.children["header"] = TableHeader(
            self.columnsComputedSlot,
            self.headerFun,
            self.sortColumnSlot,
            self.sortColumnAscendingSlot,
            self.columnFiltersSlot,
            self.curPageSlot,
            self.sortedRowsSlot,
            self.maxRowsPerPage,
        )

        self.exportData["fillWidth"] = fillWidth
        self.exportData["fillHeight"] = fillHeight

    def prepareForReuse(self):
        if not self.garbageCollected:
            return False

        self.rowDict = {}
        self.curPageSlot.set(0)

        super().prepareForReuse()

    def recalculate(self):
        # check that this isn't throwing an exception.
        self.columnsComputedSlot.get()

        # first, determine what the _set_ of rows we're going to use is
        rowKeys = self.sortedRowsSlot.get()

        # now filter them for the current page
        rowMin = self.curPageSlot.get() * self.maxRowsPerPage
        rowMax = (self.curPageSlot.get() + 1) * self.maxRowsPerPage

        self.rowKeys = rowKeys[rowMin:rowMax]

        # build a list of row cells
        rowCells = []
        rowKeysUsed = set()

        for rowKey in self.rowKeys:
            if rowKey not in self.rowDict:
                self.rowDict[rowKey] = TableRow(
                    self.columnsComputedSlot,
                    self.rendererFun,
                    rowKey
                )

            rowCells.append(self.rowDict[rowKey])

            rowKeysUsed.add(rowKey)

        # drop any row no longer in our set
        for key in set(self.rowDict) - rowKeysUsed:
            self.rowDict.pop(key)

        self.children["rows"] = rowCells
