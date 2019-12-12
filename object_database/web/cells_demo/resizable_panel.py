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


class BasicHResizePanel(CellsTestPage):
    def cell(self):
        return cells.ResizablePanel(
            cells.Card(cells.Text("First")), cells.Card(cells.Text("Second"))
        )

    def text(self):
        return "You should see a vertically-split resizable panel of two cards"


class BasicVResizePanel(CellsTestPage):
    def cell(self):
        return cells.ResizablePanel(
            cells.Card(cells.Text("First")),
            cells.Card(cells.Text("Second")),
            split="horizontal",
        )

    def text(self):
        return "You should see a horizontally-plit resizable panel of two cards"


class InVertSequence(CellsTestPage):
    def cell(self):
        return cells.ResizablePanel(
            cells.Card(cells.Text("First")), cells.Card(cells.Text("Second"))
        ) + cells.Text("boo")

    def text(self):
        return "Should see ResizablePanel in a Sequence with text at bottom"


class InVertSequenceFlexed(CellsTestPage):
    def cell(self):
        return cells.Flex(
            cells.ResizablePanel(
                cells.Card(cells.Text("First")), cells.Card(cells.Text("Second"))
            )
        ) + cells.Text("boo")

    def text(self):
        return "Should see ResizablePanel flexed in Sequence with text"


class ResizePanelWithButtons(CellsTestPage):
    def text(self):
        return (
            "Should see three ResizablePanels with a button bar to control them. "
            "You should be able to turn them all of, then all back on, and that should work."
        )

    def cell(self):
        ss = cells.sessionState()

        ss.setdefault("showFirst", True)
        ss.setdefault("showSecond", True)
        ss.setdefault("showThird", True)

        def firstDisplay():
            return cells.Panel("First display")

        def secondDisplay():
            return cells.Panel("Second display")

        def thirdDisplay():
            return cells.Panel("Third display")

        def toggles():
            def toggler(which):
                return lambda: ss.toggle(f"show{which}")

            return cells.Subscribed(
                lambda: cells.ButtonGroup(
                    [
                        cells.Button(which, toggler(which), active=getattr(ss, f"show{which}"))
                        for which in ["First", "Second", "Third"]
                    ]
                )
            )

        def toggledSecondAndThird():
            if (
                cells.sessionState().showSecond is True
                and cells.sessionState().showThird is True
            ):
                return cells.ResizablePanel(
                    cells.Subscribed(secondDisplay), cells.Subscribed(thirdDisplay)
                )
            elif cells.sessionState().showSecond is True:
                return cells.Subscribed(secondDisplay)
            elif cells.sessionState().showThird is True:
                return cells.Subscribed(thirdDisplay)
            else:
                return cells.Panel(cells.Span("Nothing to see here"))

        return toggles() + cells.Flex(
            cells.Subscribed(
                lambda: cells.ResizablePanel(
                    cells.Subscribed(firstDisplay),
                    cells.Subscribed(toggledSecondAndThird),
                    ratio=0.20,
                )
                if ss.showFirst
                else cells.Subscribed(toggledSecondAndThird)
            )
        )
