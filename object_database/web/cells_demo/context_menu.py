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


class ContextMenuBasic(CellsTestPage):
    def cell(self):
        slot = cells.Slot(0)

        return cells.ContextMenu(
            cells.Highlighted(
                cells.Center(cells.Subscribed(lambda: f"Incremented {slot.get()} times"))
            ),
            cells.Button("Increment", lambda: slot.set(slot.get() + 1))
            + cells.MenuItem("Increment", lambda: slot.set(slot.get() + 1)),
        )

    def text(self):
        return (
            "You should see some text. You should be able to right-click it to get a button."
            " If you click the button the number should increment and the menu should go away"
        )
