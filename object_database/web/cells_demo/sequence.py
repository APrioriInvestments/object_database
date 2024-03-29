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


class SplitSequence(CellsTestPage):
    def cell(self):
        return cells.Sequence(
            [
                cells.Card(cells.Text("item 1", text_color="red")),
                cells.Card(cells.Text("item 2", text_color="blue")),
            ]
        )

    def text(self):
        return "You should see a vertically split sequence of text."


class HorizontalSplitSequence(CellsTestPage):
    def cell(self):
        return cells.HorizontalSequence(
            [
                cells.Card(cells.Text("item 1", text_color="red")),
                cells.Card(cells.Text("item 2", text_color="blue")),
            ]
        )

    def text(self):
        return "You should see a horizontally split sequence of text."


class HorizontalSequenceNextToVerticalSequence(CellsTestPage):
    def cell(self):
        def first():
            return cells.Subscribed(lambda: None) + cells.HorizontalSubscribedSequence(
                lambda: [1, 2, 3], lambda i: cells.Text("i = " + str(i))
            )

        def second():
            return cells.Text("ASDF")

        return cells.Subscribed(first) + cells.Subscribed(second)

    def text(self):
        return "You should see a horizontally split sequence of text."
