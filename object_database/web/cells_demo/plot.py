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


class BasicPlot(CellsTestPage):
    def cell(self):
        data = {"x": [1, 2, 3, 4, 5, 6, 7, 8, 9, 10], "y": [5, 4, 3, 2, 1, 2, 3, 4, 5, 6]}
        slot = cells.Slot(data)

        def getData():
            d = slot.get()
            return {"data": d}

        def updateData():
            d = slot.get()
            nextData = {"x": [], "y": []}
            for dim, array in d.items():
                nextNums = [i + 1 for i in array]
                nextData[dim] = nextNums
            slot.set(nextData)

        button = cells.Button("Increment", updateData)

        return button >> cells.Flex(cells.Plot(getData))

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
            d = slot.get()
            return {"data": d}

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
