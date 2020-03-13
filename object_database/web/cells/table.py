#   Copyright 2017-2020 object_database Authors
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
import traceback
from .cells import Cell, Slot, Octicon, SubscribeAndRetry, DisplayLineTextBox, Panel, Traceback
from .children import Children


class NewTable(Cell):
    """Table Cell

    This acts as a reactive table of rows, complete with
    pagination, sorting, and filtering

    Properties
    ----------
    colFun: Function
            A function that returns a list of keys for each column
    headerFun: Function
            A function that will return a Cell that corrsponds to each
            column header. Takes each result of the colFun as the main
            argument
    rowFun: Function
            A function that returns a list of keys for each row
    rendererFun: Function
            A function that returns a Cell for each combination of
            row key and column key. Takes the row key and column key
            as the two arguments. Note that these are created by the
            rowFun and colFun respectively
    maxRowsPerPage: int
            The maximum number of rows to show for each page
    currentPage: Slot
            A Slot holding an int that says which page is currently
            the active page being viewed
    """

    def __init__(self, colFun, rowFun, headerFun, rendererFun, maxRowsPerPage=20):
        self.colFun = colFun
        self.rowFun = (rowFun,)
        self.headerFun = headerFun
        self.rendererFun = rendererFun
        self.maxRowsPerPage = maxRowsPerPage

    def recalculate(self):
        pass


class TableHeader(Cell):
    def __init__(self, columnKeys, headerLabeller, paginatorCell):
        self.keys = columnKeys
        self.headerLabeller = headerLabeller
        self.paginator = paginatorCell
        self.children = Children()

    def makeHeaderCell(self, header_index, header_key):
        # TODO: Check for presence in some column filters
        # structure
        header_name = self.headerLabeller(header_key)
        octicon = Octicon("search", color="black")
        clearOcticon = Octicon("x", color="red")
        displayLine = DisplayLineTextBox(
            Slot(""),
            displayText=header_name,
            octicon=octicon,
            clearOcticon=clearOcticon,
            initialValue="",
        )

        return Panel(displayLine)

    def recalculate(self):
        new_children_dict = {"headerItems": []}
        for column_index, column_key in enumerate(self.keys):
            try:
                header_cell = self.makeHeaderCell(column_index, column_key)
                new_children_dict["headerItems"].append(header_cell)
            except SubscribeAndRetry:
                raise
            except Exception:
                traceback_cell = Traceback(traceback.format_exc())
                new_children_dict["headersItems"].append(traceback_cell)

        new_children_dict["paginator"] = self.paginator
        self.children = Children()
        self.children.addFromDict(new_children_dict)


class TablePaginator(Cell):
    def __init__(self, currentPageSlot, totalPagesSlot):
        self.currentPageSlot = currentPageSlot
        self.totalPagesSlot = totalPagesSlot

    def recalculate(self):
        self.exportData["currentPage"] = self.currentPageSlot.get()
        self.exportData["totalPages"] = self.totalPagesSlot.get()

    def onMessage(self, messageFrame):
        if messageFrame["event"] == "table-set-page":
            self.currentPageSlot.set(messageFrame["page"])
