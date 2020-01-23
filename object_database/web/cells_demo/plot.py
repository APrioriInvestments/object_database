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
from object_database.web.cells.util import Flex
import random


class BasicPlot(CellsTestPage):
    def cell(self):
        data = {"x": [1, 2, 3, 4, 5, 6, 7, 8, 9, 10], "y": [5, 4, 3, 2, 1, 2, 3, 4, 5, 6]}
        slot = cells.Slot(data)

        def getData():
            return [dict(slot.get())], {}

        def updateData():
            d = slot.get()
            nextData = {"x": [], "y": []}
            for dim, array in d.items():
                nextNums = [i + 1 for i in array]
                nextData[dim] = nextNums
            slot.set(nextData)

        button = cells.Button("Increment", updateData)

        return button >> Flex(cells.Plot(getData))

    def text(self):
        return (
            "You should see a basic plot with fake data.",
            "\nIncrement X and Y values by pusing button",
        )


class TogglePlot(CellsTestPage):
    def cell(self):
        show = cells.Slot(True)
        slot = cells.Slot({"x": [1, 2, 3, 4, 5], "y": [5, 4, 3, 2, 1]})

        def getData():
            return [dict(slot.get())], {}

        def updateData():
            d = slot.get()
            nextData = {"x": [], "y": []}
            for dim, array in d.items():
                nextNums = [i + 1 for i in array]
                nextData[dim] = nextNums
            slot.set(nextData)

        def togglePlot():
            show.set(not show.get())

        incrementBtn = cells.Button("Increment", updateData)
        toggleBtn = cells.Button("Toggle Plot", togglePlot)
        plot = cells.Plot(getData)
        placeholder = cells.Panel(cells.Text("Empty!"))

        leftPane = cells.Panel(cells.Margin(15, incrementBtn) + cells.Margin(15, toggleBtn))
        rightPane = cells.Subscribed(lambda: plot if show.get() else placeholder)

        return leftPane >> rightPane

    def text(self):
        return ("You should be able to toggle the Plot and ", "have the Plot re-appear")


class InSubscribedSequence(CellsTestPage):
    def cell(self):
        def getRandomPlotData():
            x = [random.randint(0, 100) for i in range(20)]
            y = [random.randint(0, 100) for i in range(20)]
            coords = {"x": x, "y": y}
            return [coords], {}

        first_slot = cells.Slot(getRandomPlotData())
        second_slot = cells.Slot(getRandomPlotData())
        third_slot = cells.Slot(getRandomPlotData())

        first_plot = cells.Plot(lambda: first_slot.get())
        second_plot = cells.Plot(lambda: second_slot.get())
        third_plot = cells.Plot(lambda: third_slot.get())

        show_first = cells.Slot(True)
        show_second = cells.Slot(True)
        show_third = cells.Slot(True)

        toggle_buttons = [
            cells.Button("Toggle First", lambda: show_first.set(not show_first.get())),
            cells.Button("Toggle Second", lambda: show_second.set(not show_second.get())),
            cells.Button("Toggle Third", lambda: show_third.set(not show_third.get())),
        ]

        update_buttons = [
            cells.Button("Update First", lambda: first_slot.set(getRandomPlotData())),
            cells.Button("Update Second", lambda: second_slot.set(getRandomPlotData())),
            cells.Button("Update Third", lambda: third_slot.set(getRandomPlotData())),
        ]

        def itemsFun():
            plots = []
            if show_first.get():
                plots.append(first_plot)
            if show_second.get():
                plots.append(second_plot)
            if show_third.get():
                plots.append(third_plot)
            return tuple(plots)

        sub_seq = cells.SubscribedSequence(
            itemsFun, lambda c: Flex(c), orientation="horizontal"
        )

        togglers = [Flex(c) for c in toggle_buttons]
        updaters = [Flex(c) for c in update_buttons]
        panel_seqs = cells.Panel(cells.Sequence(togglers) + cells.Sequence(updaters))
        return panel_seqs >> Flex(sub_seq)

    def text(self):
        pass
