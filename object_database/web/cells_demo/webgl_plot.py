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

import math
from object_database.web import cells as cells
from object_database.web.cells.webgl_plot import Plot
from object_database.web.CellsTestPage import CellsTestPage
from typed_python import ListOf, Float32, Entrypoint


@Entrypoint
def generateData(ct):
    x = ListOf(Float32)()
    y = ListOf(Float32)()
    for i in range(0, ct + 1):
        x.append(i / ct)
        y.append(math.sin(i / ct ** 0.5))

    return x, y


class BasicWebglPlot(CellsTestPage):
    def cell(self):
        s = cells.Slot(2)

        def getData():
            x, y = generateData(s.get())

            return Plot.create(x, y, lineWidth=30, color=(0.5, 1.0, 0.0, 0.5))

        return cells.Button(
            cells.Subscribed(lambda: f"Currently {s.get()}"), lambda: s.set(s.get() * 2)
        ) >> cells.WebglPlot(getData)

    def text(self):
        return (
            "you should see a graphic you can scroll around on. "
            "Pressing the button should change it"
        )


class WebglBackgroundColor(CellsTestPage):
    def cell(self):
        def getData():
            return (
                Plot.create(
                    [0.0, 0.5, 1.0],
                    [0.0, 0.5, 0.0],
                    lineWidth=30,
                    color=(0.0, 1.0, 1.0, 1.0),
                    backgroundColor=(0.0, 0.0, 0.0, 0.0),
                )
                .withBottomAxis(label="bottom")
                .withLeftAxis(label="top")
                .withTopAxis(label="right")
                .withRightAxis(label="left")
            )

        return cells.WebglPlot(getData)

    def text(self):
        return "you should see a graphic you can scroll around on"


class WebglTimestampDisplay(CellsTestPage):
    def cell(self):
        def getData():
            return (
                Plot.create(
                    [x * 86400 for x in range(1000)],
                    [math.sin(x / 20.0) for x in range(1000)],
                    lineWidth=10,
                    color=(0.0, 0.0, 0.0, 1.0),
                    backgroundColor=(0.0, 0.0, 0.0, 0.0),
                )
                .withBottomAxis(label="timestamp", isTimestamp=True)
                .withLeftAxis()
            )

        return cells.WebglPlot(getData)

    def text(self):
        return "you should see a graphic you can scroll around on"


class WebglLegend(CellsTestPage):
    def cell(self):
        def getData():
            return Plot.create(
                [x * 86400 for x in range(1000)],
                [math.sin(x / 20.0) for x in range(1000)],
                lineWidth=10,
                color=(0.0, 0.0, 0.0, 1.0),
                backgroundColor=(0.0, 0.0, 0.0, 0.0),
            ).withLegend((1.0, 1.0), ["A", "B"], ["red", "blue"])

        return cells.WebglPlot(getData)

    def text(self):
        return "you should see a graphic you can scroll around on"


class WebglLinesAndTriangles(CellsTestPage):
    def cell(self):
        def getData():
            return (
                Plot()
                .withTriangles([0.0, 0.6, 0.3], [0.0, 0.0, 0.5], ["red", "blue", "red"])
                .withLines([0.0, 0.5], [0.0, 0.5])
            )

        return cells.WebglPlot(getData)

    def text(self):
        return "you should see a graphic you can scroll around on"
