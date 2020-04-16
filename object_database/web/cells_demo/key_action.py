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


class PressCtrlT(CellsTestPage):
    def cell(self):
        import datetime

        lastKeystroke = cells.Slot()
        subCell = cells.Subscribed(lambda: lastKeystroke.get())
        card = cells.Card(
            subCell, cells.Text("Press ctrlKey+t to update timestamp from browser")
        )

        return cells.Sequence(
            [
                card,
                cells.KeyAction(
                    "ctrlKey+t", lambda x: lastKeystroke.set(str(datetime.datetime.now()))
                ),
            ]
        )

    def text(self):
        return "Should print the current timestamp when pushing ctrl+t"
