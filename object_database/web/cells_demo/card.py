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
from object_database.web.cells.webgl_plot import Plot
from object_database.web.CellsTestPage import CellsTestPage


class SingleCard(CellsTestPage):
    def cell(self):
        return cells.Card("This is a card", padding=2)

    def text(self):
        return "You should see a single 'card' with some text in it."


class SingleCardWithHeader(CellsTestPage):
    def cell(self):
        return cells.Card("This is a card", padding=2, header="HI")

    def text(self):
        return "You should see a single 'card' with some text in it."


class CardWithTitle(CellsTestPage):
    def cell(self):
        return cells.Card(
            "This is the card text", header="This is the header text 2", padding=0
        )

    def text(self):
        return "You should see a single 'card' with header text."


class CardWithFlexChildInSequence(CellsTestPage):
    def cell(self):
        return cells.Text("Some text above a card with a resizable panel inside") + cells.Card(
            cells.ResizablePanel(
                cells.Highlighted(cells.Flex(cells.Text("LeftText"))),
                cells.Highlighted(cells.Flex(cells.Text("RightText"))),
            ),
            header="This is the header text 2",
            padding=0,
        )

    def text(self):
        return "You should see some text above a card that contains a resizable panel."


class CardWithPlot(CellsTestPage):
    def cell(self):
        return cells.Text("Some text above a card with a plot inside") + cells.Card(
            cells.WebglPlot(lambda: Plot.create([1, 2, 3], [1, 2, 3])), header="Header text"
        )

    def text(self):
        return (
            "You should see some text above a card that contains"
            " a plot which should fill the available space."
        )


class CardWithPlotInSubscribed(CellsTestPage):
    def cell(self):
        return cells.Text("Some text above a card with a panel inside") + cells.Card(
            cells.Subscribed(
                lambda: cells.WebglPlot(lambda: Plot.create([1, 2, 3], [1, 2, 3]))
            ),
            header="Header text",
        )

    def text(self):
        return (
            "You should see some text above a card that contains"
            " a plot which should fill the available space."
        )


class CardWithPanelAndPlot(CellsTestPage):
    def cell(self):
        return cells.Text("Some text above a card with a panel inside") + cells.Card(
            cells.Panel(cells.WebglPlot(lambda: Plot.create([1, 2, 3], [1, 2, 3])))
        )

    def text(self):
        return "You should see some text above a card that contains a panel."


class CardPassesThroughFlexnessChanges(CellsTestPage):
    def cell(self):
        isPanel = cells.Slot(True)

        return cells.Button("Toggle between plot and text", isPanel.toggle) + cells.Card(
            cells.Subscribed(
                lambda: (
                    cells.WebglPlot(lambda: Plot.create([1, 2, 3], [1, 2, 3]))
                    if isPanel.get()
                    else cells.Card("ACard", header="Header")
                )
            )
        )

    def text(self):
        return "You should be able to toggle between a button and a card"
