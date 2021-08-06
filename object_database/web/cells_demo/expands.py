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


class ExpanderTree(CellsTestPage):
    def cell(self):
        sessionState = cells.sessionState()

        def expander(path):
            def isSelected():
                return sessionState.selectedPath == path

            isSelectedSlot = cells.ComputedSlot(isSelected)

            def onClick():
                sessionState.selectedPath = path

            def inner():
                if isSelectedSlot.get():
                    text = cells.Highlighted(str(path))
                else:
                    text = cells.Clickable(str(path), onClick)

                return cells.HorizontalSequence(
                    [
                        cells.Flex(text),
                        cells.Octicon("primitive-dot"),
                        cells.Octicon("primitive-dot"),
                        cells.Octicon("primitive-dot"),
                        cells.Octicon("primitive-dot"),
                        cells.Octicon("primitive-dot"),
                        cells.Octicon("primitive-dot"),
                        cells.Octicon("primitive-dot"),
                    ]
                )

            def body():
                return cells.Expands(
                    closed=cells.Subscribed(inner),
                    open=cells.Subscribed(inner)
                    + expander(path + (0,))
                    + expander(path + (1,))
                    + expander(path + (2,))
                    + expander(path + (3,))
                    + expander(path + (4,))
                    + expander(path + (5,))
                    + expander(path + (5,))
                    + expander(path + (5,))
                    + expander(path + (5,))
                    + expander(path + (5,))
                    + expander(path + (5,))
                    + expander(path + (5,))
                    + expander(path + (5,))
                    + expander(path + (5,))
                    + expander(path + (5,))
                    + expander(path + (5,))
                    + expander(path + (5,))
                    + expander(path + (5,))
                    + expander(path + (5,))
                    + expander(path + (5,))
                    + expander(path + (5,))
                    + expander(path + (5,))
                    + expander(path + (5,))
                    + expander(path + (5,))
                    + expander(path + (5,))
                    + expander(path + (5,))
                    + expander(path + (5,))
                    + expander(path + (5,))
                    + expander(path + (5,))
                    + expander(path + (5,))
                    + expander(path + (5,))
                    + expander(path + (5,))
                    + expander(path + (5,))
                    + expander(path + (5,))
                    + expander(path + (5,))
                    + expander(path + (5,))
                    + expander(path + (5,))
                    + expander(path + (5,))
                    + expander(path + (5,))
                    + expander(path + (5,))
                    + expander(path + (5,))
                    + expander(path + (5,))
                    + expander(path + (5,))
                    + expander(path + (5,))
                    + expander(path + (5,))
                    + expander(path + (5,))
                    + expander(path + (5,)),
                )

            return cells.Subscribed(body)

        return cells.PageView(
            cells.ResizablePanel(
                cells.Panel(
                    cells.VScrollable(expander(()))
                    + cells.Button("At the bottom", lambda: None)
                ),
                cells.ResizablePanel(
                    cells.Panel(cells.Top(cells.Text("On the right"))),
                    cells.Panel(cells.Top(cells.Text("On the right2"))),
                ),
            ),
            header=cells.Text("THIS IS SOME TEXT AT TOP"),
            footer=cells.Text("THIS IS SOME TEXT AT BOTTOM"),
        )

    def text(self):
        return (
            "You should see an exandable tree. click a node to select it. "
            "The dots should align on the right and move with the panel divider."
        )
