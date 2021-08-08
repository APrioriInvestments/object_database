#   Copyright 2017-2019 Nativepython Authors
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


class DropdownGoesAway(CellsTestPage):
    def cell(self):
        slot = cells.Slot(0)

        return cells.KeyAction("altKey+t", lambda x: slot.set(slot.get() + 1)) + (
            cells.Subscribed(
                lambda: cells.Dropdown(
                    "You picked " + str(slot.get()),
                    [i for i in range(100)],
                    lambda i: slot.set(i),
                )
            )
        )

    def text(self):
        return (
            "You should see a dropdown. Opening it and pressing 'alt-t' should "
            "make it go away. It shouldn't get orphaned."
        )


class DropdownWithManyItems(CellsTestPage):
    def cell(self):
        slot = cells.Slot(0)

        return cells.Subscribed(
            lambda: (
                cells.Dropdown(
                    "You picked " + str(slot.get()),
                    [i for i in range(100)],
                    lambda i: slot.set(i),
                )
                >> cells.TopRight(
                    cells.Dropdown(
                        "You picked " + str(slot.get()),
                        [i for i in range(100)],
                        lambda i: slot.set(i),
                    )
                )
            )
            + (
                cells.Dropdown(
                    "You picked " + str(slot.get()),
                    [i for i in range(100)],
                    lambda i: slot.set(i),
                )
                >> cells.BottomRight(
                    cells.Dropdown(
                        "You picked " + str(slot.get()),
                        [i for i in range(100)],
                        lambda i: slot.set(i),
                    )
                )
            )
        )

    def text(self):
        return "You should see a dropdown with 100 items"


class BasicDropdownDrawer(CellsTestPage):
    def cell(self):
        return cells.DropdownDrawer("Click Me", cells.Text("Result"))

    def text(self):
        return "You should see a basic DropdownDrawer with 'Result' as text child"
