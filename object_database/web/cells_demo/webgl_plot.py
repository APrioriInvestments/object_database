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
import time

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


class PlotWithTimeDependency(CellsTestPage):
    def cell(self):
        s = cells.Slot(0)

        t0 = time.time()

        def data():
            return Plot.create([1, 2, 3], [1, s.get(), time.time() - t0])

        return (
            cells.Text("Some text above a card with a plot inside")
            + cells.Card(cells.WebglPlot(data), header="Header text")
            + cells.Button("increment", lambda: s.set(s.get() + 1))
        )

    def text(self):
        return (
            "you should see a plot with a button below it. It shouldn't use 100% CPU. "
            "Pressing the button should change it"
        )


class WebglLinesTightAngles(CellsTestPage):
    def cell(self):
        def getData():
            epsilon = 1e-2
            x = [0.0, 0.5 - epsilon, 0.5, 0.5 + epsilon * 2, 1.0]
            y = [0.0, 0.0, 1.0, 0.3, 0.3]

            return (
                Plot()
                .withLines(x, y, lineWidth=50, color=(1.0, 0.0, 0.0, 0.5))
                .withViewport((-0.5, -0.5, 1.5, 1.5))
            )

        return cells.WebglPlot(getData)

    def text(self):
        return "you should see a line plot. The line should not go off the bottom."


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
            ).withLegend((1.0, 1.0), ["A", "B"] * 100, ["red", "blue"] * 100)

        return cells.WebglPlot(getData)

    def text(self):
        return (
            "you should see a graphic you can scroll around on. You should be able"
            " to scroll the legend contents."
        )


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


class WebglText(CellsTestPage):
    def cell(self):
        def getData():
            return (
                (
                    Plot()
                    .withLines([0.0, 0.5], [0.0, 0.5])
                    .withTextLabels(
                        [0.0, 0.5, 0.25, 0.25, 0.25, 0.25],
                        [0.0, 0.5, 0.25, 0.25, 0.25, 0.25],
                        ["lower-left", "upper-right", "left", "right", "up", "down"],
                        sizes=[10, 25, 12, 12, 12, 12],
                        offsets=((0, 0), (0, 0), (-10, 0), (10, 0), (0, 10), (0, -10)),
                        fractionPositions=[
                            (0.5, 0.5),
                            (0.5, 0.5),
                            (1.0, 0.5),
                            (0.0, 0.5),
                            (0.5, 0.0),
                            (0.5, 1.0),
                        ],
                    )
                )
                .withLeftAxis()
                .withTopAxis()
                .withBottomAxis()
                .withRightAxis()
            )

        return cells.WebglPlot(getData)

    def text(self):
        return "you should see a graphic you can scroll around on"


class WebglAxisLabels(CellsTestPage):
    def cell(self):
        def getData():
            return (
                (Plot().withLines([0.0, 100.0], [0.0, 100.0]))
                .withLeftAxis(labels=[(i, f"left_{i}") for i in range(100)])
                .withTopAxis(labels=[(i, f"top_{i}") for i in range(100)])
                .withBottomAxis(labels=[(i, f"bottom_{i}") for i in range(100)])
                .withRightAxis(labels=[(i, f"right_{i}") for i in range(100)])
            )

        return cells.WebglPlot(getData)

    def text(self):
        return "you should see a graphic you can scroll around on"


class WebglPoints(CellsTestPage):
    def cell(self):
        def getData():
            return (
                Plot()
                .withLines([0.0, 0.5], [0.0, 0.5])
                .withPoints(
                    [0.0, 0.5, 0.25],
                    [0.0, 0.5, 0.25],
                    color=["red", "green", "blue"],
                    pointSize=[5, 15, 30],
                )
            )

        return cells.WebglPlot(getData)

    def text(self):
        return "you should see a graphic you can scroll around on"


class WebglLogscale(CellsTestPage):
    def cell(self):
        def getData():
            return (
                Plot()
                .withLines(
                    [0.0, 1.0, 2.0, 3.0], [math.log(x) for x in [1.0, 10.0, 100.0, 1000.0]]
                )
                .withLeftAxis(isLogscale=True)
            )

        return cells.WebglPlot(getData)

    def text(self):
        return "you should see a graphic you can scroll around on"


class WebglHandlesInf(CellsTestPage):
    def cell(self):
        import math

        def getData():
            return (
                Plot()
                .withLines([0.0, 1.0, 2.0, 3.0], [1, math.inf, math.nan, 2])
                .withLeftAxis()
            )

        return cells.WebglPlot(getData)

    def text(self):
        return "you should see a graphic you can scroll around on"


class WebglImage(CellsTestPage):
    def cell(self):
        def getData():
            colors = ListOf(Plot.Color)()

            for y in range(100):
                for x in range(200):
                    # lower left corner is black. Should be wider than it is
                    # tall.
                    if x < 30 and y < 10:
                        colors.append([0, 0, 0, 0])
                    else:
                        # going 'right' should make it red
                        # going 'up' should make it green
                        colors.append([x / 200.0 * 255, y / 100.0 * 255, 0, 255])

            return (
                Plot()
                .withImage([0.0, 0.0, 1.0, 1.0], colors, 200)
                .withLeftAxis()
                .withBottomAxis()
            )

        return cells.WebglPlot(getData)

    def text(self):
        return "you should see a graphic you can scroll around on"


class WebglMouseover(CellsTestPage):
    def cell(self):
        def getData():
            def mf(x, y, screenRect):
                return [
                    Plot.MouseoverLegend(
                        x=x,
                        y=y,
                        contents=[[Plot.Color(red=255, alpha=255), "right"], ["below"]],
                        orientation="above",
                    ),
                    Plot.MouseoverLegend(
                        x=x + screenRect.width() * 0.1,
                        y=y + screenRect.height() * 0.1,
                        contents=[[Plot.Color(blue=255, alpha=255), "right"], ["below"]],
                    ),
                ]

            return Plot().withLines([0.0, 0.5], [0.0, 0.5]).withMouseoverFunction(mf)

        return cells.WebglPlot(getData)

    def text(self):
        return "you should see a graphic you can scroll around on"


class WebglError(CellsTestPage):
    def cell(self):
        hasError = cells.Slot(False)
        point = cells.Slot(0.5)

        def getData():
            if hasError.get():
                raise Exception("This is an error")

            return Plot().withLines([0.0, 0.5, 1.0], [0.0, 1.0, point.get()])

        res = cells.WebglPlot(getData)

        return (
            cells.Button("Turn on an error", hasError.toggle)
            + cells.Button("increment me", lambda: point.set(point.get() + 1))
            + res
        )

    def text(self):
        return (
            "You should see a graphic. Clicking the 'increment' button should change it. "
            "Clicking 'turn on an error' should toggle an Exception display. You should be "
            "able to switch back and forth between the two displays."
        )
