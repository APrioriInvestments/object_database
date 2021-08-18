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


class Highlights(CellsTestPage):
    def cell(self):
        return (
            # the nesting shows that the size of the div composes correctly
            cells.Highlighted(cells.Highlighted("SomeHighlightedText"))
            + cells.Center("Some Centered Text")
        )

    def text(self):
        return "You should see some highlighted text that doesn't fill the width of the page."


class HighlightsTopRight(CellsTestPage):
    def cell(self):
        return cells.Highlighted(cells.TopRight("SomeHighlightedText")) + cells.TopRight(
            cells.Highlighted("SomeHighlightedText")
        )

    def text(self):
        return "You should see some highlighted text that fills the upper half."


class NestedHighlights(CellsTestPage):
    def cell(self):
        return cells.Padding(10) * cells.Highlighted(
            cells.Padding(30, right=100)
            * cells.Border(right="2px dashed")
            * cells.Highlighted(
                cells.Center(
                    cells.Border()
                    * cells.Highlighted(color="rgba(0,0,0,.15)")
                    * cells.Padding(10)
                    * "SomeText"
                )
            ),
            color="rgba(0,0,0,.15)",
        )

    def text(self):
        return (
            "You should see some centered text with a few different colored boxes around it."
        )
