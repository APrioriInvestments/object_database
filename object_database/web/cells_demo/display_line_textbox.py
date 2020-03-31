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


class BasicDisplayTextBox(CellsTestPage):
    def cell(self):
        slot = cells.Slot("")
        octicon = cells.Octicon("search", color="black")
        clear_octicon = cells.Octicon("x", color="red")
        result = cells.Subscribed(lambda: cells.Text(slot.get()))
        textinput = cells.DisplayLineTextBox(
            slot, displayText="HELLO!", octicon=octicon, clearOcticon=clear_octicon
        )
        return textinput + result

    def text(self):
        return (
            "You should see an input that displays ",
            "'HELLO!' until clicked on, and typing and ",
            "then hitting Enter should update slot. Input ",
            "should return to saying 'HELLO!' when blurred",
        )
