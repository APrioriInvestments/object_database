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


class HeaderWithResizerAndPlots(CellsTestPage):
    def cell(self):
        return cells.HeaderBar(
            [cells.Text("Left")], [cells.Text("Middle")], [cells.Text("Right")]
        ) + cells.ResizablePanel(
            cells.Plot(lambda: ([{"x": [1, 2, 3], "y": [1, 2, 3]}], {})),
            cells.Plot(lambda: ([{"x": [1, 2, 3], "y": [1, 2, 3]}], {})),
        )

    def text(self):
        return "You should see a header bar and two plots. Space should be filled."


class PageViewWithResizerAndPlots(CellsTestPage):
    def cell(self):
        return cells.PageView(
            cells.ResizablePanel(
                cells.Plot(lambda: ([{"x": [1, 2, 3], "y": [1, 2, 3]}], {})),
                cells.Plot(lambda: ([{"x": [1, 2, 3], "y": [1, 2, 3]}], {})),
            ),
            header=cells.HeaderBar(
                [cells.Text("Left Head")],
                [cells.Text("Middle Head")],
                [cells.Text("Right Head")],
            ),
            footer=cells.HeaderBar(
                [cells.Text("Left Foot")],
                [cells.Text("Middle Foot")],
                [cells.Text("Right Foot")],
            ),
        )

    def text(self):
        return "You should see a header bar, two plots, and a footer. Space should be filled."
