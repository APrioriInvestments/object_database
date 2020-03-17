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


class BasicTableColumn(CellsTestPage):
    def cell(self):
        filter_slot = cells.Slot("")
        sort_slot = cells.Slot(0)
        table_column = cells.TableColumn("one", "First", filter_slot, sort_slot)
        display_area = cells.Panel(
            cells.Sequence(
                [
                    cells.Subscribed(lambda: filter_slot.get()),
                    cells.Subscribed(lambda: sort_slot.get()),
                ]
            )
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
        current_page = cells.Slot(1)
        total_pages = cells.Slot(10)
        paginator = cells.TablePaginator(current_page, total_pages)

        first_slot = cells.Slot("")
        second_slot = cells.Slot("")
        third_slot = cells.Slot("")
        fourth_slot = cells.Slot("")
        column_dict = {
            "One": first_slot,
            "Two": second_slot,
            "Three": third_slot,
            "Four": fourth_slot,
        }

        def label_maker(header_name):
            return header_name

        header = cells.TableHeader(column_dict, label_maker, paginator)
        slot_display_area = cells.Panel(
            cells.Sequence(
                [
                    cells.Subscribed(lambda: current_page.get()),
                    cells.Subscribed(lambda: second_slot.get()),
                    cells.Subscribed(lambda: third_slot.get()),
                    cells.Subscribed(lambda: fourth_slot.get()),
                ]
            )
        )

        return cells.Panel(header) + slot_display_area

    def text(self):
        return "You should see a TableHeader with a 10 page paginator"


class BasicNewTableHeader(CellsTestPage):
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
            columns.append(cells.TableColumn(key, key, slot))

        # Filter Value Displays
        filter_displays = []
        for column in columns:
            filter_displays.append(make_display_for(column))

        # NewTableHeader
        header = cells.NewTableHeader(columns, lambda key: key, paginator, sort_slot)

        # Final display
        return header + (sort_display >> cells.HorizontalSequence(filter_displays))

    def text(self):
        return (
            "You should see a NewTableHeader made up of TableColumn and "
            "TableColumnSorter cells that have appropriately reactive "
            "slot interactions, along with displays of slot values"
        )


class BasicTableRow(CellsTestPage):
    def cell(self):
        index = 5
        num_elements = 6
        elements = []
        for i in range(num_elements):
            elements.append(cells.Text("{}-{}".format(index, i)))

        return cells.TableRow(index, elements)

    def text(self):
        return "You should see a row of basic text elements"


class BasicTablePage(CellsTestPage):
    def cell(self):
        page_size = 5
        total_num_rows = 14
        row_element_size = 3

        def makeRowElements(row_index):
            elements = []
            for element_index in range(row_element_size):
                elements.append(cells.Text("({}, {})\t".format(row_index, element_index)))
            return elements

        rows = []
        for row_index in range(total_num_rows):
            elements = makeRowElements(row_index)
            rows.append(cells.TableRow(row_index, elements))

        # Now create three TablePages.
        # The final one should only have 4 rows
        total_pages_slot = cells.Slot(3)
        first_page_current_slot = cells.Slot(1)
        first_page = cells.TablePage(
            rows, first_page_current_slot, total_pages_slot, page_size
        )
        second_page_current_slot = cells.Slot(2)
        second_page = cells.TablePage(
            rows, second_page_current_slot, total_pages_slot, page_size
        )
        third_page_current_slot = cells.Slot(3)
        third_page = cells.TablePage(
            rows, third_page_current_slot, total_pages_slot, page_size
        )

        first_display = cells.Panel(
            (
                cells.Text("Page Num:")
                >> cells.Subscribed(lambda: first_page_current_slot.get())
            )
            + first_page
        )
        second_display = cells.Panel(
            (
                cells.Text("Page Num:")
                >> cells.Subscribed(lambda: second_page_current_slot.get())
            )
            + second_page
        )
        third_display = cells.Panel(
            (
                cells.Text("Page Num:")
                >> cells.Subscribed(lambda: third_page_current_slot.get())
            )
            + third_page
        )

        # Display as vertical sequence
        return first_display + second_display + third_display

    def text(self):
        return (
            "You should see three TablePages each with at most "
            "5 items, mapped over a total row list of 14 items. \
                Note that the last TablePage should only have 4 items"
        )
