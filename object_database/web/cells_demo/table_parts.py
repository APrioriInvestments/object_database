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
