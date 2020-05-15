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


def test_basic_sheet_display(headless_browser):
    # Ensures we can load the demo page element
    demo_root = headless_browser.get_demo_root_for(BasicSheet)
    assert demo_root
    query = '[data-cell-type="Sheet"]'
    sheet = headless_browser.find_by_css(query)
    assert sheet


def test_basic_sheet_selector(headless_browser):
    # Ensures we can load the demo page element
    demo_root = headless_browser.get_demo_root_for(BasicSheet)
    assert demo_root
    query_0_0 = '[data-x="0"][data-y="0"]'
    element_0_0 = headless_browser.find_by_css(query_0_0)
    query_0_1 = '[data-x="0"][data-y="1"]'
    element_0_1 = headless_browser.find_by_css(query_0_1)
    # make sure the element is selected by default
    selector_class = "view-cell selector-cursor selector-anchor"
    assert element_0_0.get_attribute("class") == selector_class
    # click on another sheet cell and make sure it becomes the selector
    element_0_1.click()
    assert element_0_1.get_attribute("class") == selector_class


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


def test_bigger_sheet_display(headless_browser):
    # Ensures we can load the demo page element
    demo_root = headless_browser.get_demo_root_for(BiggerSheet)
    assert demo_root
    query = '[data-cell-type="Sheet"]'
    sheet = headless_browser.find_by_css(query)
    assert sheet


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


def test_basic_sheet_locked_rows_columnsdisplay(headless_browser):
    # Ensures we can load the demo page element
    demo_root = headless_browser.get_demo_root_for(BasicSheetLockedRowsColumns)
    assert demo_root
    query = '[data-cell-type="Sheet"]'
    sheet = headless_browser.find_by_css(query)
    assert sheet


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


def test_bigger_sheet_locked_rows_columnsdisplay(headless_browser):
    # Ensures we can load the demo page element
    demo_root = headless_browser.get_demo_root_for(BiggerSheetLockedRowsColumns)
    assert demo_root
    query = '[data-cell-type="Sheet"]'
    sheet = headless_browser.find_by_css(query)
    assert sheet


def test_bigger_sheet_locked_selector(headless_browser):
    # Ensures we can load the demo page element
    demo_root = headless_browser.get_demo_root_for(BiggerSheetLockedRowsColumns)
    assert demo_root
    query_0_0 = '[data-x="0"][data-y="0"]'
    element_0_0 = headless_browser.find_by_css(query_0_0)
    query_0_1 = '[data-x="0"][data-y="1"]'
    element_0_1 = headless_browser.find_by_css(query_0_1)
    # make sure the element is selected by default
    selector_class = "in-locked-row selector-cursor selector-anchor"
    assert element_0_0.get_attribute("class") == selector_class
    # click on another sheet cell and make sure it becomes the selector
    element_0_1.click()
    selector_class = "in-locked-column selector-cursor selector-anchor"
    assert element_0_1.get_attribute("class") == selector_class


class TwoColumnSheetLockedRowsColumns(CellsTestPage):
    def cell(self):
        num_columns = 2
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
            numLockColumns=1,
        )

    def text(self):
        return "You should see a bigger sheet."


def test_two_column_sheet_locked_rows_columnsdisplay(headless_browser):
    # Ensures we can load the demo page element
    demo_root = headless_browser.get_demo_root_for(TwoColumnSheetLockedRowsColumns)
    assert demo_root
    query = '[data-cell-type="Sheet"]'
    sheet = headless_browser.find_by_css(query)
    assert sheet


class BasicNewSheet(CellsTestPage):
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


class BasicNewSheetTwoLockedRows(CellsTestPage):
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
            numLockRows=2,
            numLockColumns=2,
        )

    def text(self):
        return "You should see a bigger sheet."


class BasicNewSheetInPanel(CellsTestPage):
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

        return cells.Panel(
            cells.Sheet(
                rowFun,
                colWidth=80,
                totalColumns=num_columns,
                totalRows=num_rows,
                numLockRows=1,
                numLockColumns=2,
            )
        )

    def text(self):
        return "You should see a bigger sheet, but inside a Panel"


class SheetInSmallSizedPanel(CellsTestPage):
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

        return cells.SizedPanel(
            cells.Sheet(
                rowFun,
                colWidth=80,
                totalColumns=num_columns,
                totalRows=num_rows,
                numLockColumns=3,
            ),
            width=250,
            height=500,
        )

    def text(self):
        return "You should see a sheet whose locked cols exceed the horiz space"


class BiggerSheetLargeCellContent(CellsTestPage):
    def cell(self):
        num_columns = 300
        num_rows = 10000
        long_text = """
        Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do
        eiusmod tempor incididunt ut labore et dolore magna aliqua. Ut enim ad
        minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip
        ex ea commodo consequat. Duis aute irure dolor in reprehenderit in
        voluptate velit esse cillum dolore eu fugiat nulla pariatur. Excepteur
        sint occaecat cupidatat non proident, sunt in culpa qui officia
        deserunt mollit anim id est laborum.
        """

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
                r = [long_text for j in range(start_column, end_column + 1)]
                rows.append(r)
            return rows

        return cells.Sheet(rowFun, colWidth=80, totalColumns=num_columns, totalRows=num_rows)

    def text(self):
        return "You should see a bigger sheet with a lot of text in each cell."


class SmallSheet(CellsTestPage):
    def cell(self):
        num_columns = 5
        num_rows = 5

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
        return "You should see a 5x5 sheet."
