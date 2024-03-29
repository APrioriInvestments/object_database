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

from object_database.web import cells as cells
from object_database.web.CellsTestPage import CellsTestPage


class BasicSized(CellsTestPage):
    def cell(self):
        return cells.Highlighted(cells.Sized(cells.Text("Hello"), width=150, height=150))

    def text(self):
        return "You should see a 150x150 Highlighted thing"


class BasicSizedCentered(CellsTestPage):
    def cell(self):
        return cells.Highlighted(
            cells.Sized(cells.Center(cells.Text("Hello")), width=150, height=150)
        )

    def text(self):
        return "You should see a 150x150 Highlighted thing with centered text"


class BasicSizedVCentered(CellsTestPage):
    def cell(self):
        return cells.Highlighted(
            cells.Sized(cells.VCenter(cells.Text("Hello")), height=150)
        ) + cells.Highlighted(cells.Sized(cells.Center(cells.Text("Hello")), height=150))

    def text(self):
        return (
            "You should see a 150 high block of highlighed text with the text in the middle "
            "but where the text is not a box. Below it the same thing but stretch all the "
            "way across."
        )


class BasicSizedVerticalStacked(CellsTestPage):
    def cell(self):
        return (
            cells.Highlighted(cells.Sized(cells.VCenter(cells.Text("Hello")), height=150))
            >> cells.Highlighted(cells.Sized(cells.VCenter(cells.Text("Hello")), height=200))
            >> cells.Flex(
                cells.Highlighted(cells.Sized(cells.Center(cells.Text("Hello")), height=250))
            )
        )

    def text(self):
        return "You should see three 'Hellos' in increasing sized, vertically centered."


class SizedOverflowIsSet(CellsTestPage):
    def cell(self):
        return cells.Highlighted(
            cells.Sized(cells.Center(cells.Text("Hello" * 1000)), height=150, width=150)
        )

    def text(self):
        return (
            "You should see a 150x150 box of cells where the text does not overflow the "
            "highlight."
        )
