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
    Flex,
    Octicon,
    SubscribeAndRetry,
    DisplayLineTextBox,
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
    """
    TableColumn class

    Represents a TableHeader column element, which includes
    the name of the column, the key for the column, and
    slots for dealing with filtering and sorting itself

    Properties
    ----------
    key: str
        The key for identifying the column in its table
        structure
    label: str
        The label to give the column as it appears in
        the user interface
    filter_slot: Slot
        A slot representing the column's filter value.
        This is set in the recalculate method of
        Table (See for more information)
    sort_slot: Slot
        A slot representing the parent Table's current
        sort information. A sortSlot is a tuple of the
        key of the column that is currently being sorted
        on and the direction (ascending/descending).
    """

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
        sorter = TableColumnSorter(self.key, self.sort_slot)
        self.children["display"] = Flex(display_line) >> sorter


class TableColumnSorter(Cell):
    """
    TableColumSorter class

    Represents a Cell structure that contains dynamic
    sort buttons designed for display inside of a
    TableColumn. These buttons are presented as
    toggle direction arrows in the UI of the
    parent column

    Parameters
    ----------
    key: str
        The key of the column for which this
        Cell is a child
    sort_slot: Slot
        A slot containing the current sorting
        information for the parent Table.
        This slot is a tuple of the key for
        the current column being sorted and
        the direction of the sort. See Table
        for more information
    """

    def __init__(self, columnKey, currentSortSlot):
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
            self.sort_slot.set((self.key, not slot_val[1]))
        else:
            self.sort_slot.set((self.key, False))

    def getIcon(self):
        slot_val = self.sort_slot.get()
        sorted_on = slot_val[0]
        is_ascending = slot_val[1]
        if slot_val and sorted_on == self.key:
            if is_ascending:
                return Octicon("arrow-down")
            elif not is_ascending == "descending":
                return Octicon("arrow-up")
        return Octicon("arrow-down", color="gainsboro")


class TableHeader(Cell):
    """
    TableHeader class

    Represents the top control row of the parent Table.
    Is a collection of TableColumns that provide interactive
    pagination, sorting, and filtering on the Table.

    Properties
    ----------
    columns: list
        A list of TableColumns that will be displayed
        in the UI of the table header
    label_maker: Function
        A function for making the labels for each column.
        The function takes the a column key as its param
    paginator: TablePaginator
        A TablePaginator cell for dealing with the pagination
        slot interaction
    sort_slot: Slot
        The parent Table's current sorting information.
        Note that this slot is a tuple of the key of
        the current column being sorted and the direction
        of the sort
    """

    def __init__(self, columns, labelFunc, paginator, sortSlot):
        super().__init__()
        self.columns = columns
        self.label_maker = labelFunc
        self.paginator = paginator
        self.sort_slot = sortSlot

    def makeHeaderCell(self, column_index, column_cell):
        header_name = self.label_maker(column_cell.key)
        column_cell.label = header_name
        return column_cell

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
    """
    TablePaginator class

    Represents an interactive cell that displays and allows
    the user to cycle through the current pages on the table.
    Creates the appropriate buttons and reactive inputs that
    will update the provided slots.

    Is designed to be used primarily in TableHeader, but
    can be inserted in other places via Slot composition.

    Properties
    ----------
    currentPageSlot: Slot
        A slot holding the current page being viewed
        in the table.
    totalPagesSlot: Slot
        A slot holding the current number of
        total pages
    """

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
    """
    TableRow class

    Represents a row of data values (Cells) in a Table.

    A TableRow handles the rendering and filtering of
    its values, and holds information about the column
    in which each data element appears.

    NOTE: Important aspects of filtering occur in this
    object.

    Properties
    ----------
    index: int
        The index of the row in its parent table
    key: str or int
        The key for the given row of data
    column_keys: list
        An ordered list of keys for the corresponding
        Table's columns. These are used to match up the
        data elements
    filterer: Function
        A function that handles filtering of a given data
        element. Implementors can pass in an optional
        value for this property in the constructor. The
        function expects a list of filter terms equal
        in size to the num of columns, with a term or
        None for each column. See `defaultFilter` for
        the default implementation.
    renderer: Function
        A function that takes a row key and column key
        as the params and returns a rendered Cell object
        for the data element in this row.
    elements_cache: list
        A cached collection of rendered data elements
    """

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

        Parameters
        ----------
        filter_terms: list
            A list equal in size to the parent Table's
            number of columns, each element being a
            string to filter on or None
        """
        if self.filterer:
            return self.filterer(filter_terms, self.elements)
        return self.defaultFilter(filter_terms)

    def defaultFilter(self, filter_terms):
        """Loops through all the elements and filter
        terms and determines if any of the column/filter
        combinations does not match the corresponding
        filter term. If *any* do not match, we return False.
        Otherwise (at least one matched) we return True

        Parameters
        ----------
        filter_terms: list
            A list equal in size to the parent Table's
            number of columns, each element being a
            string to filter on or None
        """
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

    def getElementAtIndex(self, index):
        """Attempt to retrieve the created
        Cell at the column index from the
        cache. If the value in the cache is
        None, create the element using the
        renderer function

        Parameters
        ----------
        index: int
            The index of the element to attempt
            to retrieve in the row of data cells.

        Returns
        -------
        Cell: A rendered Cell corresponding to
            the data element at the index
            position
        """
        found = self.elements_cache[index]
        if found is None:
            column_key = self.column_keys[index]
            new_element = Cell.makeCell(self.renderer(self.key, column_key))
            self.elements_cache[index] = new_element
            return new_element

        return found

    def getElementAtColumnKey(self, key):
        """Attempt to return this TableRow's
        element that is present at the given
        column key. If we cannot find the column
        or the element, returns None

        Parameters
        ----------
        key: str or int
            The given column key at which we want to
            find a rendered data Cell from this row.

        Returns
        -------
        Cell or None
        """
        column_index = self.column_keys.index(key)
        if column_index:
            return self.getElementAtIndex(column_index)
        return None

    def allElements(self):
        """Return a list of all rendered
        elements

        Returns
        -------
        list: A collection of rendered data Cell
            elements that is in the order of columns
            for the parent Table
        """
        result = []
        for index, _ in enumerate(self.column_keys):
            result.append(self.getElementAtIndex(index))
        return result


class TablePage(Cell):
    """
    TablePage cell

    Represents a single page of TableRows that is currently being
    displayed for the parent Table.

    TablePage handles updating the currently displayed rows
    whenever the pagination slots change. It will also update
    those slots based on any change to the underlying row data,
    meaning that if the size of the data changes due to filtering,
    the pagination values will also change.

    TablePage handles sorting. It sorts the underlying TableRows and
    also maps which rows to then re-display for the given pagination
    information.

    This class contains most of the more complex interaction
    of the Table Cell structure.

    Properties
    ----------
    row_getter: Function
        A functiont that returns a collection of keys
        for each row
    element_renderer: Function
        A function that composes a data Cell object
        based upon the row key and column key for each
        element. Note that this is passed directly to
        the TableRow constructor when composing rows,
        and is not used directly.
    rows: list
        A list of composed TableRow instances
    display_rows: list
        A list of the composed TableRow instances
        that are currently being displayed in the
        active page
    columns: list
        A collection of TableColumn objects
    current_page: Slot
        A slot holding the current page value (int)
    total_pages: Slot
        A slot holding the total pages value (int)
    sort_slot: Slot
        A slot holding sort information for the
        parent Table. Note that this slot is a tuple
        of the key for the current sort column and
        the direction of the sort
    max_rows: int
        The maximum number of rows to display for each page
    """

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
        sort_info = self.sort_slot.get()
        column_key = sort_info[0]
        is_ascending = sort_info[1]

        # If no column is set to be sort, then
        # we just return the original list
        if column_key is None:
            return rows_to_sort

        # Otherwise, for each row we get the element
        # it has at the column index and sort by
        # its sortsAs value
        sort_term_rows = []  # A tuple of sortsAs values and TableRow
        for row in rows_to_sort:
            sort_val = None
            element = row.getElementAtColumnKey(column_key)
            if element:
                sort_val = element.sortsAs()
            if sort_val is None:
                sort_val = 0

            sort_term_rows.append((sort_val, row))

        sort_term_rows.sort(key=lambda tup: tup[0], reverse=(not is_ascending))
        return [tup[1] for tup in sort_term_rows]

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

    def prepareForReuse(self):
        if not self.garbageCollected:
            return False
        self._clearSubscriptions()
        self.rows = []
        self.display_ows = []
        super().prepareForReuse()


class NewTable(Cell):
    """Table Cell

    This acts as a reactive table of rows, complete with
    pagination, sorting, and filtering

    Properties
    ----------
    column_getter: Function
            A function that returns a list of keys for each column
    header_mapper: Function
            A function that will return a Cell that corrsponds to each
            column header. Takes each result of the colFun as the main
            argument
    row_getter: Function
            A function that returns a list of row indices (integers)
    element_renderer: Function
            A function that returns a Cell for each combination of
            row key and column key. Takes the row key and column key
            as the two arguments. Note that these are created by the
            rowFun and colFun respectively
    max_page_size: int
            The maximum number of rows to show for each page
    row_keys: list
            A collection of keys for the row data
    columns: list
            A collection of initialized TableColumn cells
            according to the current sorting criteria
    column_filters: list
            A list of Slots for filtering each column
    sort_slot: Slot
            A slot containing the current sorting information.
            Note that this slow is a tuple of the key for the
            current column being sorted and the direction of
            the sort. Initializes to (None, None) meaning
            there is no sorting
    page_info: dict of Slots
            A dictionary containing two slots, one for
            the current (current_page) and another for
            the total number of pages (total_pages)
    """

    def __init__(self, colFun, rowFun, headerFun, rendererFun, maxRowsPerPage=20):
        super().__init__()
        self.column_getter = colFun
        self.row_getter = rowFun
        self.header_mapper = headerFun
        self.element_renderer = rendererFun
        self.max_page_size = maxRowsPerPage

        self.columns = []
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
        header = TableHeader(
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
                self.columns.append(
                    TableColumn(column_key, column_label, filter_slot, self.sort_slot)
                )

        except SubscribeAndRetry:
            raise
        except Exception:
            self._logger.exception("Column create function calculation threw exception:")
            self.columns = []

    def getPageInfo(self):
        # We initialize with a current page
        # and total num pages of 1
        return {"current_page": Slot(1), "total_pages": Slot(1)}
