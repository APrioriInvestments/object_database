#   Coyright 2017-2022 Nativepython Authors
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


class SubscribedOnRemoved(CellsTestPage):
    def cell(self):
        toDisplay = cells.Slot(0)
        timesChanged = cells.Slot(0)

        return (
            cells.Subscribed(
                lambda: cells.Text(f"Button pressed {toDisplay.get()} times")
                + cells.Subscribed(
                    lambda: None, onRemoved=lambda: timesChanged.set(timesChanged.get() + 1)
                )
            )
            + cells.Subscribed(lambda: f"Subscribed replaced {timesChanged.get()} times")
            + cells.Button("Increment", lambda: toDisplay.set(toDisplay.get() + 1))
        )

    def text(self):
        return "You should see two counters that are in sync and a button to increment them"
