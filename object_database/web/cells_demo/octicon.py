#   Coyright 2017-2019 Nativepython Authors
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


class BasicOcticon(CellsTestPage):
    def cell(self):
        return cells.Card(cells.Octicon("shield", color="green"), padding=4)

    def text(self):
        return "You should see a single octicon."


class MultiOcticon(CellsTestPage):
    def cell(self):
        return cells.Card(
            cells.HorizontalSequence(
                [
                    cells.Octicon("shield", color="green"),
                    cells.Octicon("stop", color="red"),
                    cells.Octicon("alert", color="yellow"),
                ]
            ),
            padding=4,
        )

    def text(self):
        return "You should see a single octicon."


class ReusedOcticon(CellsTestPage):
    def cell(self):
        slot = cells.Slot(0)
        o = cells.Octicon("shield")

        return cells.Button("Add", lambda: slot.set(slot.get() + 1)) + cells.Subscribed(
            lambda: cells.Text(f"Its {slot.get()}") + o
        )

    def text(self):
        return "You should see an octicon. Clicking on the button shouldn't crash us."
