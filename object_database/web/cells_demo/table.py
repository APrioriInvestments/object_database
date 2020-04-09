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
import random


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


def test_can_find_first_cell(headless_browser):
    """Ensure that we load and find the first cell
    value, which is '1'"""
    root = headless_browser.get_demo_root_for(MultiPageTable)
    assert root
    expected_value = "0"
    first_cell_query = "{} > tbody > tr > td".format(headless_browser.demo_root_selector)
    first_cell_location = (headless_browser.by.CSS_SELECTOR, first_cell_query)
    headless_browser.wait(5).until(
        headless_browser.expect.text_to_be_present_in_element(
            first_cell_location, expected_value
        )
    )


def test_can_paginate_forward(headless_browser):
    """Ensure that we can paginate, then find
    new value in first cell"""
    expected_value = "50"
    query = "{}  [data-cell-type='TablePaginator'] > *:nth-child(4)".format(
        headless_browser.demo_root_selector
    )
    right_btn = headless_browser.find_by_css(query)
    assert right_btn
    right_btn.click()
    first_cell_query = "{} > tbody > tr > td".format(headless_browser.demo_root_selector)
    first_cell_location = (headless_browser.by.CSS_SELECTOR, first_cell_query)
    headless_browser.wait(5).until(
        headless_browser.expect.text_to_be_present_in_element(
            first_cell_location, expected_value
        )
    )


def test_can_paginate_back(headless_browser):
    """Now ensure that we can paginate backward
    """
    expected_value = "0"
    query = "{}  [data-cell-type='TablePaginator'] > :first-child".format(
        headless_browser.demo_root_selector
    )
    left_btn = headless_browser.find_by_css(query)
    assert left_btn
    left_btn.click()
    first_cell_query = "{} > tbody > tr > td".format(headless_browser.demo_root_selector)
    first_cell_location = (headless_browser.by.CSS_SELECTOR, first_cell_query)
    headless_browser.wait(5).until(
        headless_browser.expect.text_to_be_present_in_element(
            first_cell_location, expected_value
        )
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
            "You should see a Table with several rows, a button to add new rows, "
            "a delete button on each row, and an edit box on each cell's text. "
            "If you change the text and hit enter, you should see the page re-sort."
        )


class HugeTable(CellsTestPage):
    def cell(self):
        rows = [i for i in range(1000)]

        def renderer(rowLabel, columnLabel):
            return cells.Cell.makeCell("{}-{}".format(columnLabel, rowLabel))

        return cells.Table(
            colFun=lambda: ["Col1", "Col2", "Col3", "Col4", "Col5"],
            rowFun=lambda: rows,
            headerFun=lambda columnLabel: columnLabel,
            rendererFun=renderer,
            maxRowsPerPage=100,
        )

    def text(self):
        return (
            "You should see an enormous table of row indices etc "
            "that you should be able to sort and filter"
        )


class HugeTableSorting(CellsTestPage):
    def cell(self):
        rows = [i for i in range(10000)]

        def renderer(rowLabel, columnLabel):
            num = random.randrange(0, 1000000)
            return cells.Cell.makeCell(str(num))

        return cells.Table(
            colFun=lambda: ["Col1", "Col2", "Col3"],
            rowFun=lambda: rows,
            headerFun=lambda label: label,
            rendererFun=renderer,
            maxRowsPerPage=20,
        )

    def text(self):
        return (
            "You should see a large table filled with three "
            "columns of random numbers that can be sorted"
        )
