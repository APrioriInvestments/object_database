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


class BasicText(CellsTestPage):
    def cell(self):
        return cells.Text("This is some text")

    def text(self):
        return "You should see some text."


class EmbeddedColoredText(CellsTestPage):
    def cell(self):
        return cells.Card(cells.Text("This is some text", text_color="blue"), padding=0)

    def text(self):
        return "You should see some colored text in a Card."
