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
from object_database.web.cells.slot import Slot
from object_database.web.cells.subscribed import Subscribed


class AsyncDropdown(Cell):
    """A Bootstrap-styled Dropdown Cell

    whose dropdown-menu contents can be loaded
    asynchronously each time the dropdown is opened.

    Example
    -------
    The following dropdown will display a
    Text cell that displays "LOADING" for
    a second before switching to a different
    Text cell that says "NOW CONTENT HAS LOADED"::
        def someDisplayMethod():
            def delayAndDisplay():
                time.sleep(1)
                return Text('NOW CONTENT HAS LOADED')

            return Card(
                AsyncDropdown(delayAndDisplay)
            )

    """

    def __init__(self, labelText, contentCellFunc, loadingIndicatorCell=None):
        """
        Parameters
        ----------
        labelText: str
            A label for the dropdown
        contentCellFunc: Function or Lambda
            A lambda or function that will
            return a Cell to display asynchronously.
            Usually some computation that takes time
            is performed first, then the Cell gets
            returned
        loadingIndicatorCell: Cell
            A cell that will be displayed while
            the content of the contentCellFunc is
            loading. Defaults to CircleLoader.
        """
        super().__init__()
        self.slot = Slot(False)
        self.labelText = labelText
        self.exportData["labelText"] = self.labelText

        if not loadingIndicatorCell:
            loadingIndicatorCell = CircleLoader()

        self.contentCell = Cell.makeCell(
            AsyncDropdownContent(self.slot, contentCellFunc, loadingIndicatorCell)
        )
        self.children["content"] = Cell.makeCell(self.contentCell)

    def onMessage(self, messageFrame):
        """On `dropdown` events sent to this
        Cell over the socket, we will be told
        whether the dropdown menu is open or not
        """
        print("GOT ", messageFrame)

        if messageFrame["event"] == "dropdown":
            print("SETTING IT!")
            self.slot.set(not messageFrame["isOpen"])


class AsyncDropdownContent(Cell):
    """A dynamic content cell designed for use

    inside of a parent `AsyncDropdown` Cell.

    Notes
    -----
    This Cell should only be used by `AsyncDropdown`.

    Because of the nature of slots and rendering,
    we needed to decompose the actual Cell that
    is dynamically updated using `Subscribed` into
    a separate unit from `AsyncDropdown`.

    Without this separate decomposition,
    the entire Cell would be replaced on
    the front-end, meaning the drawer would never open
    or close since Dropdowns render closed initially.
    """

    def __init__(self, slot, contentFunc, loadingIndicatorCell):
        """
        Parameters
        ----------
        slot: Slot
            A slot that contains a Boolean value
            that tells this cell whether it is in
            the open or closed state on the front
            end. Changes are used to update the
            loading of dynamic Cells to display
            on open.
        contentFunc: Function or Lambda
            A function or lambda that will return
            a Cell to display. Will be called whenever
            the Dropdown is opened. This gets passed
            from the parent `AsyncDropdown`
        loadingIndicatorCell: Cell
            A Cell that will be displayed while
            the content from contentFunc is loading
        """
        super().__init__()
        self.slot = slot
        self.contentFunc = contentFunc
        self.loadingCell = loadingIndicatorCell
        self.contentCell = Subscribed(self.changeHandler)
        self.children.addFromDict({"content": self.contentCell})

    def changeHandler(self):
        """If the slot is true, the
        dropdown is open and we call the
        `contentFunc` to get something to
        display. Until then, we show the
        Loading message.
        """
        slotState = self.slot.get()
        if slotState:
            return self.contentFunc()
        else:
            return Cell.makeCell(self.loadingCell)


class CircleLoader(Cell):
    """A simple circular loading indicator
    """

    def __init__(self):
        super().__init__()
