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
            rendererFun=lambda w, field: (
                f"hi {w}"
                if field == "Col 1"
                else f"ho {w}"
                if field == "Col 2"
                else f"Unknown field {field}"
            ),
            maxRowsPerPage=30,
        )

    def text(self):
        return (
            "You should see a table with two columns, 100 rows, and 30 rows per page"
            "(so 3 pages of 30 rows and one page of 10 rows). The first column's prefix "
            "is 'hi', the second column's prefix is 'ho', and each cell is suffixed with "
            "the row's number [0, 99]."
        )


def test_can_find_first_cell(headless_browser):
    """Ensure that we load and find the first cell
    value, which is '1'"""
    root = headless_browser.get_demo_root_for(MultiPageTable)
    assert root
    expected_value = "1"
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
    expected_value = "31"
    query = "{} > thead > tr > th > *:nth-child(3)".format(headless_browser.demo_root_selector)
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
    expected_value = "1"
    query = "{} > thead > tr > th > :first-child".format(headless_browser.demo_root_selector)
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
