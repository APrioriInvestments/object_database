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


class BasicTablePaginator(CellsTestPage):
    def cell(self):
        current_page = cells.Slot(1)
        total_pages = cells.Slot(10)
        return cells.Panel(cells.TablePaginator(current_page, total_pages))

    def text(self):
        return "You should see a TablePaginator with 10 pages"


class TablePaginatorOnePage(CellsTestPage):
    def cell(self):
        current_page = cells.Slot(1)
        total_pages = cells.Slot(1)
        return cells.Panel(cells.TablePaginator(current_page, total_pages))

    def text(self):
        return (
            "You should see a TablePaginator with just one page"
            " and it should have no input and buttons should be "
            "disabled"
        )


class BasicTableColumn(CellsTestPage):
    def cell(self):
        filter_slot = cells.Slot("")
        sort_slot = cells.Slot([None, None])
        table_column = cells.TableColumn("one", "First", filter_slot, sort_slot)
        sort_key_display = cells.Text("Sort Key: ") >> cells.Subscribed(
            lambda: cells.Text(sort_slot.get()[0])
        )
        sort_direction_display = cells.Text("Sort ascending: ") >> cells.Subscribed(
            lambda: cells.Text(sort_slot.get()[1])
        )
        filter_value_display = cells.Text("Filter value: ") >> cells.Subscribed(
            lambda: cells.Text(filter_slot.get())
        )
        display_area = cells.Sequence(
            [sort_key_display, sort_direction_display, filter_value_display]
        )
        return cells.Panel(table_column) + display_area

    def text(self):
        return "You should see a single TableColumn with displayed slot values"


class BasicTableColumnSorter(CellsTestPage):
    def cell(self):
        first_name = "First Column"
        second_name = "Second Column"
        slot = cells.Slot([None, None])
        first_sorter = cells.TableColumnSorter(first_name, slot)
        second_sorter = cells.TableColumnSorter(second_name, slot)
        first = cells.Panel(cells.Text(first_name) >> first_sorter)
        second = cells.Panel(cells.Text(second_name) >> second_sorter)
        display_area = cells.Panel(
            cells.Subscribed(lambda: slot.get()[0]) >> cells.Subscribed(lambda: slot.get()[1])
        )
        return cells.HorizontalSequence([first, second]) + display_area

    def text(self):
        return (
            "You should see two TableColumnSorters that interact and "
            "display the current sort properties"
        )


class BasicTableHeader(CellsTestPage):
    def cell(self):
        # Paginator slots and Cell
        current_page = cells.Slot(1)
        total_pages = cells.Slot(10)
        paginator = cells.TablePaginator(current_page, total_pages)

        # Sort Slot and Display
        sort_slot = cells.Slot([None, None])
        sort_display = cells.Panel(
            cells.Subscribed(lambda: sort_slot.get()[0])
            >> cells.Subscribed(lambda: sort_slot.get()[1])
        )

        # Column filter display maker
        def make_display_for(column):
            return cells.Panel(
                cells.Text(column.label) + cells.Subscribed(column.filter_slot.get)
            )

        # Columns
        column_slots = {
            "First": cells.Slot(""),
            "Second": cells.Slot(""),
            "Third": cells.Slot(""),
            "Fourth": cells.Slot(""),
        }
        columns = []
        for key, slot in column_slots.items():
            columns.append(cells.TableColumn(key, key, slot, sort_slot))

        # Filter Value Displays
        filter_displays = []
        for column in columns:
            filter_displays.append(make_display_for(column))

        # NewTableHeader
        header = cells.TableHeader(columns, lambda key: key, paginator, sort_slot)

        # Final display
        return header + (sort_display >> cells.HorizontalSequence(filter_displays))

    def text(self):
        return (
            "You should see a TableHeader made up of TableColumn and "
            "TableColumnSorter cells that have appropriately reactive "
            "slot interactions, along with displays of slot values"
        )


class BasicTableRows(CellsTestPage):
    def cell(self):
        column_keys = ["One", "Two", "Three"]
        rows = {
            "first": {"One": "cat", "Two": "dog", "Three": "giraffe"},
            "second": {"One": "elephant", "Two": "cat", "Three": "giraffe"},
        }

        def renderer(row_key, column_key):
            row = rows[row_key]
            return cells.Text("[ {} ]".format(row[column_key]))

        first_filter = ["cat", "", ""]
        second_filter = ["", "", "giraffe"]

        # First Example
        # 'cat' in column 1
        # Should only filter out the first row
        ex1_first_row = cells.TableRow(0, "first", column_keys, renderer)
        ex1_second_row = cells.TableRow(1, "second", column_keys, renderer)
        first_example = cells.Panel(
            cells.Text("Filter One (cat in column one)")
            + cells.Subscribed(
                lambda: ex1_first_row
                if ex1_first_row.filter(first_filter)
                else "[filtered out]"
            )
            + cells.Subscribed(
                lambda: ex1_second_row
                if ex1_second_row.filter(first_filter)
                else "[filtered out]"
            )
        )

        # Second Example
        # giraffe in column three
        # Should show boths rows
        ex2_first_row = cells.TableRow(0, "first", column_keys, renderer)
        ex2_second_row = cells.TableRow(1, "second", column_keys, renderer)
        second_example = cells.Panel(
            cells.Text("Filter Two (giraffe in last column)")
            + cells.Subscribed(
                lambda: ex2_first_row
                if ex2_first_row.filter(second_filter)
                else "[filtered out]"
            )
            + cells.Subscribed(
                lambda: ex2_second_row
                if ex2_second_row.filter(second_filter)
                else "[filtered out]"
            )
        )

        return first_example + second_example

    def text(self):
        return (
            "You should see a first example where only the first of "
            "two rows is filtered (shown)"
        )


def test_table_rows_render(headless_browser):
    root = headless_browser.get_demo_root_for(BasicTableRows)
    assert root
    rows_selector = '{} [data-cell-type="TableRow"]'.format(
        headless_browser.demo_root_selector
    )
    row_elements = headless_browser.find_by_css(rows_selector)
    assert row_elements
