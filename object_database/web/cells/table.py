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
from .cells import (
    Cell,
    Octicon,
    SubscribeAndRetry,
    DisplayLineTextBox,
    Panel,
    Traceback,
    Clickable,
    SingleLineTextBox,
    Span,
    Slot,
    Subscribed,
)
from .children import Children
from math import ceil


class TableColumn(Cell):
    def __init__(self, key, label, filterSlot, sortSlot=None):
        super().__init__()
        self.key = key
        self.label = label
        self.filter_slot = filterSlot
        self.sort_slot = sortSlot

    def recalculate(self):
        octicon = Octicon("search", color="black")
        clear_octicon = Octicon("x", color="red")
        display_line = DisplayLineTextBox(
            self.filter_slot,
            displayText=self.label,
            octicon=octicon,
            clearOcticon=clear_octicon,
            initialValue="",
        )
        self.children["display"] = display_line


class TableColumnSorter(Cell):
    def __init__(self, columnKey, currentSortSlot):
        """currentSortSlot represents a tuple with
        the first element as the key of the column
        that is currently sorted on and the second
        being a direction (ascending/descending)
        If the slot is None there is no sorting anywhere
        """
        super().__init__()
        self.key = columnKey
        self.sort_slot = currentSortSlot

    def recalculate(self):
        sorter = Subscribed(self.getIcon)
        button = Clickable(sorter, self.onClick, makeBold=True)
        self.children["button"] = button

    def onClick(self):
        slot_val = self.sort_slot.get()
        if slot_val and slot_val[0] == self.key:
            self.sort_slot.set([self.key, self.toggleDirectionFrom(slot_val[1])])
        else:
            self.sort_slot.set([self.key, "descending"])

    def getIcon(self):
        slot_val = self.sort_slot.get()
        if slot_val and slot_val[0] == self.key:
            if slot_val[1] == "ascending":
                return Octicon("arrow-down")
            elif slot_val[1] == "descending":
                return Octicon("arrow-up")
        return Octicon("arrow-down", color="gainsboro")

    def toggleDirectionFrom(self, current_direction):
        if current_direction == "ascending":
            return "descending"
        elif current_direction == "descending":
            return "ascending"

        return current_direction


class NewTableHeader(Cell):
    """columns is a list of TableColumn cells"""

    def __init__(self, columns, labelFunc, paginator, sortSlot):
        super().__init__()
        self.columns = columns
        self.label_maker = labelFunc
        self.paginator = paginator
        self.sort_slot = sortSlot

    def makeHeaderCell(self, column_index, column_cell):
        header_name = self.label_maker(column_cell.key)
        column_cell.label = header_name
        sorter = TableColumnSorter(column_cell.key, self.sort_slot)
        return Panel(column_cell >> sorter)

    def recalculate(self):
        new_children_dict = {"headerItems": []}
        for column_index, column in enumerate(self.columns):
            try:
                header_cell = self.makeHeaderCell(column_index, column)
                new_children_dict["headerItems"].append(header_cell)
            except SubscribeAndRetry:
                raise
            except Exception:
                traceback_cell = Traceback(traceback.format_exc())
                new_children_dict["headerItems"].append(traceback_cell)

        new_children_dict["paginator"] = self.paginator
        self.children = Children()
        self.children.addFromDict(new_children_dict)


class TablePaginator(Cell):
    def __init__(self, currentPageSlot, totalPagesSlot):
        super().__init__()
        self.currentPageSlot = currentPageSlot
        self.totalPagesSlot = totalPagesSlot
        self.children = Children()

    def recalculate(self):
        total_pages = int(self.totalPagesSlot.get())
        current_page = int(self.currentPageSlot.get())
        if total_pages <= 1:
            self.children["page"] = Cell.makeCell(Span(str(total_pages)))
        else:
            page_cell = SingleLineTextBox(self.currentPageSlot, pattern="[0-9]+").nowrap()
            self.children["page"] = page_cell
        if current_page == 1:
            left_cell = Octicon("triangle-left", color="lightgray")
            self.children["left"] = left_cell
        else:
            left_cell = Clickable(
                Octicon("triangle-left"), lambda: self.currentPageSlot.set(current_page - 1)
            )
            self.children["left"] = left_cell
        if current_page == total_pages:
            right_cell = Octicon("triangle-right", color="lightgray")
            self.children["right"] = right_cell
        else:
            right_cell = Clickable(
                Octicon("triangle-right"), lambda: self.currentPageSlot.set(current_page + 1)
            )
            self.children["right"] = right_cell
        self.exportData["currentPage"] = current_page
        self.exportData["totalPages"] = total_pages


class TableRow(Cell):
    def __init__(self, index, key, columnKeys, renderer, filterer=None):
        super().__init__()
        self.index = index
        self.key = key
        self.column_keys = columnKeys
        self.filterer = filterer
        self.renderer = renderer
        self.elements_cache = [None] * len(columnKeys)

    def recalculate(self):
        self.children["elements"] = self.allElements()
        self.exportData["index"] = self.index

    def filter(self, filter_terms):
        """Attemps to determine if the current
        row should be matched when each element
        is compared to the filter term for its
        corresponding column
        Attempst to use the set self.filterer,
        if present.
        Otherwise defaults to self.defaultFilter
        """
        if self.filterer:
            return self.filterer(filter_terms, self.elements)
        return self.defaultFilter(filter_terms)

    def defaultFilter(self, filter_terms):
        """Loops through all the elements and filter
        terms and determines if any of the column/filter
        combinations does not match the corresponding
        filter term. If *any* do not match, we return False.
        Otherwise (at least one matched) we return True"""
        assert len(filter_terms) == len(self.elements_cache)
        results = []
        for column_index, filter_term in enumerate(filter_terms):
            # If the incoming filter term is None, this means
            # there is no filter for the column at that index.
            # We simply pass this one
            if filter_term is None:
                pass

            # Get the corresponding element at the column
            # index (same as the element index)
            element = self.getElementAtIndex(column_index)
            element_term = element.sortsAs()
            if element_term is not None:
                element_term = str(element_term)
                results.append(filter_term in element_term)

        return all(results)

    def defaultFilterSingle(self, element_index, filter_term):
        """Returns True when one of the following
        conditions is met:
        1. A given column filter is None, meaning
        there is no filter at all
        Returns False in all other cases
        """
        # TODO: Debugging. Remove
        self._logger.info("\n\nHELLOTHERE\n\n")
        if not filter_term:
            return True
        element = self.getElementAtIndex(element_index)
        element_filter = element.sortsAs()
        if element_filter is None:
            element_filter = ""
        else:
            element_filter = str(element_filter)
        # TODO: Debugging. Remove
        self._logger.info(
            "\n\n [{}][{}]{} ===> {}\n\n".format(
                element.__class__.__name__, element_index, element_filter, filter_term
            )
        )
        if filter_term in element_filter:
            return True

        return False

    def getElementAtIndex(self, index):
        """Attempt to retrieve the created
        Cell at the column index from the
        cache. If the value in the cache is
        None, create the element using the
        renderer function"""
        found = self.elements_cache[index]
        if found is None:
            column_key = self.column_keys[index]
            new_element = Cell.makeCell(self.renderer(self.key, column_key))
            self.elements_cache[index] = new_element
            return new_element

        return found

    def allElements(self):
        """Return a list of all rendered
        elements"""
        result = []
        for index, _ in enumerate(self.column_keys):
            result.append(self.getElementAtIndex(index))
        return result


class TablePage(Cell):
    """Update this comment"""

    def __init__(self, row_getter, columns, page_info, renderer, sort_slot, max_rows):
        super().__init__()
        self.row_getter = row_getter
        self.element_renderer = renderer
        self.rows = []
        self.display_rows = []
        self.columns = columns
        self.current_page = page_info["current_page"]
        self.total_pages = page_info["total_pages"]
        self.sort_slot = sort_slot
        self.max_rows = max_rows

    def recalculate(self):
        with self.view() as v:
            try:
                self.makeRows()
            except SubscribeAndRetry:
                raise
            except Exception:
                self._logger.exception("TablePage makeRows exception:")
                self.rows = []
                self.display_rows = []
            self._resetSubscriptionsToViewReads(v)

        self.makeRows()
        self.calculatePageRows()
        self.updateTotalPagesFor(self.rows)
        self.exportData["maxRows"] = self.max_rows
        self.exportData["rowSize"] = len(self.display_rows)
        self.exportData["pageNum"] = self.current_page.get()
        self.children["rows"] = self.display_rows

    def makeRows(self):
        column_keys = []
        column_filter_terms = []
        for column in self.columns:
            column_keys.append(column.key)
            column_filter_terms.append(column.filter_slot.get())

        row_keys = list(self.row_getter())
        self.rows = []
        for row_index, row_key in enumerate(row_keys):
            self.rows.append(TableRow(row_index, row_key, column_keys, self.element_renderer))
        filtered_rows = self.filterRows(self.rows, column_filter_terms)
        sorted_rows = self.sortRows(filtered_rows)
        self.rows = sorted_rows

    def filterRows(self, rows_to_filter, filter_terms):
        filtered_rows = []
        for row in rows_to_filter:
            row_does_match = row.filter(filter_terms)
            if row_does_match:
                filtered_rows.append(row)

        return filtered_rows

    def sortRows(self, rows_to_sort):
        return [row for row in rows_to_sort]

    def updateTotalPagesFor(self, rows):
        """Determine the total number of pages needed
        to display the number of rows provided, based on
        the max_rows. We pass the new total pages
        value to the current paginator"""
        num_rows = len(rows)
        if num_rows <= self.max_rows:
            self.total_pages.set(1)
        else:
            new_total = ceil(float(num_rows) / float(self.max_rows))
            self.total_pages.set(new_total)

    def calculatePageRows(self):
        """Determine the rows that should actually
        be displayed given the current page number and
        size of each row"""
        # Note we force the page num here to be
        # 0-indexed for easier calculation
        current_page_num = int(self.current_page.get()) - 1
        start_index = current_page_num * self.max_rows
        end_index = start_index + self.max_rows

        # If the total number of rows we have is
        # less than a single page max size, we
        # display all of them and update the page
        # number slots.
        if len(self.rows) <= self.max_rows:
            self.display_rows = self.rows
            self.current_page.set(1)
            self.total_pages.set(1)
        elif end_index >= len(self.rows):
            self.display_rows = self.rows[start_index:]
        else:
            self.display_rows = self.rows[start_index:end_index]


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
            A function that returns a list of row indices (integers)
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
        super().__init__()
        self.column_getter = colFun
        self.row_getter = rowFun
        self.header_mapper = headerFun
        self.element_renderer = rendererFun
        self.max_page_size = maxRowsPerPage

        self.row_keys = []
        self.rows = []
        self.columns = []
        self.filtered_rows = []
        self.sorted_rows = []
        self.column_filters = {}

        # Various slots we will use for composition
        self.sort_slot = Slot([None, None])
        self.page_info = self.getPageInfo()

    def recalculate(self):
        with self.view() as v:
            self.makeColumnCells()
            self._resetSubscriptionsToViewReads(v)

        header_paginator = TablePaginator(
            self.page_info["current_page"], self.page_info["total_pages"]
        )
        header = NewTableHeader(
            self.columns, self.header_mapper, header_paginator, self.sort_slot
        )
        page = TablePage(
            self.row_getter,
            self.columns,
            self.page_info,
            self.element_renderer,
            self.sort_slot,
            self.max_page_size,
        )
        self.children["header"] = header
        self.children["page"] = page

    def makeRowCells(self):
        try:
            row_cells = []
            column_keys = [column.key for column in self.columns]
            self.row_keys = list(self.row_getter())
            for row_index, row_key in enumerate(self.row_keys):
                row_cells.append(
                    TableRow(row_index, row_key, column_keys, self.element_renderer)
                )
            self.rows = row_cells

        except SubscribeAndRetry:
            raise
        except Exception:
            self._logger.exception("Row create function calculation threw exception:")
            self.rows = []

    def makeColumnCells(self):
        try:
            raw_columns = list(self.column_getter())
            self.columns = []
            # If we don't have a filter slot for
            # the given column key yet, go ahead
            # and create a blank one
            for column_key in raw_columns:
                filter_slot = Slot("")
                if column_key not in self.column_filters.keys():
                    self.column_filters[column_key] = filter_slot
                else:
                    filter_slot = self.column_filters[column_key]
                column_label = self.header_mapper(column_key)
                self.columns.append(TableColumn(column_key, column_label, filter_slot))

        except SubscribeAndRetry:
            raise
        except Exception:
            self._logger.exception("Column create function calculation threw exception:")
            self.columns = []

    def getPageInfo(self):
        # We initialize with a current page
        # and total num pages of 1
        return {"current_page": Slot(1), "total_pages": Slot(1)}

    def sort_rows(self, rows_to_sort):
        # Doing nothing for now
        return [row for row in rows_to_sort]

    def filter_rows(self, rows_to_filter):
        # Rows is a list of TableRow Cells
        filtered_rows = []
        for row in rows_to_filter:
            filter_slots = []
            for column in self.columns:
                filter_slot = self.column_filters[column.key]
                filter_slots.append(filter_slot)
            row_does_match = row.filter(filter_slots)
            if row_does_match:
                filtered_rows.append(row)

        return filtered_rows
