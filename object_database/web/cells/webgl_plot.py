#   Copyright 2017-2021 object_database Authors
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

from typed_python import ListOf, Float32, NamedTuple, UInt8, Entrypoint

from object_database.web.cells.cell import Cell
from object_database.web.cells.subscribed import SubscribeAndRetry


import traceback


class Figure:
    pass


Color = NamedTuple(red=UInt8, green=UInt8, blue=UInt8, alpha=UInt8)


class Rectangle(NamedTuple(left=float, bottom=float, right=float, top=float)):
    def union(self, other):
        return Rectangle(
            left=min(self.left, other.left),
            bottom=min(self.bottom, other.bottom),
            top=max(self.top, other.top),
            right=max(self.right, other.right),
        )

    def intersection(self, other):
        return Rectangle(
            left=max(self.left, other.left),
            bottom=max(self.bottom, other.bottom),
            top=min(self.top, other.top),
            right=min(self.right, other.right),
        )


class Packets:
    """Keep track of what data belongs to which packets.

    We want to make sure we never send the same data twice, but we also want to
    ensure that we release packet data once we're no longer using it.

    Clients can call 'resetTouched' before converting an object, and then 'eraseUntouched'
    to clear anything they didn't use in the last pass. Like a mark-sweep garbage collection.
    """

    def __init__(self, cells):
        self.cells = cells
        self.dataToPacketId = {}
        self.packetIdToData = {}
        self.touchedPackets = set()
        self.consumedPacketIds = set()

    def resetTouched(self):
        self.touchedPackets.clear()

    def eraseUntouched(self):
        for p in list(self.packetIdToData):
            if p not in self.touchedPackets:
                self.consumedPacketIds.add(p)
                del self.dataToPacketId[self.packetIdToData[p]]
                del self.packetIdToData[p]

    def getPacketData(self, packetId):
        if packetId not in self.packetIdToData:
            if packetId not in self.consumedPacketIds:
                raise Exception(f"Unknown Packet {packetId}.")
            return b""

        assert packetId in self.packetIdToData, packetId
        assert isinstance(self.packetIdToData[packetId], bytes)
        return self.packetIdToData.get(packetId)

    def getPacketId(self, data):
        if isinstance(data, (ListOf(Float32), ListOf(Color))):
            data = data.toBytes()

        assert isinstance(data, bytes)

        if data in self.dataToPacketId:
            packetId = self.dataToPacketId[data]
            self.touchedPackets.add(packetId)
            return packetId

        packetId = self.cells.getPacketId(self.getPacketData)

        self.dataToPacketId[data] = packetId
        self.packetIdToData[packetId] = data
        self.touchedPackets.add(packetId)

        return packetId

    def encode(self, data):
        if isinstance(data, (float, int)):
            return float(data)

        if data is None:
            return None

        if isinstance(data, Color):
            return [
                float(data.red) / 255.0,
                float(data.green) / 255.0,
                float(data.blue) / 255.0,
                float(data.alpha) / 255.0,
            ]

        if isinstance(data, Rectangle):
            return [float(data.left), float(data.bottom), float(data.right), float(data.top)]

        if isinstance(data, (bytes, ListOf(Float32), ListOf(Color))):
            return {"packetId": self.getPacketId(data)}

        return data.encode(self)


def createRectangle(rect):
    if isinstance(rect, Rectangle):
        return rect

    if isinstance(rect, (tuple, list, ListOf)) and len(rect) == 4:
        return Rectangle(left=rect[0], bottom=rect[1], right=rect[2], top=rect[3])

    raise Exception(f"Can't make a rectangle out of {rect}")


def createColor(color):
    if isinstance(color, Color):
        return color

    if isinstance(color, (tuple, list, ListOf)) and len(color) == 4:
        return Color(
            red=color[0] * 255.0,
            green=color[1] * 255.0,
            blue=color[2] * 255.0,
            alpha=color[3] * 255.0,
        )

    raise Exception(f"Can't make a color out of {color}")


@Entrypoint
def minOf(values):
    if not values:
        return None

    minValue = values[0]

    for v in values:
        if v < minValue:
            minValue = v

    return minValue


@Entrypoint
def maxOf(values):
    if not values:
        return None

    maxValue = values[0]

    for v in values:
        if v > maxValue:
            maxValue = v

    return maxValue


class LineFigure(Figure):
    def __init__(self, xs, ys, lineWidths=1.0, colors=Color(blue=255, alpha=255)):
        assert isinstance(lineWidths, (float, int, ListOf(Float32))), type(lineWidths)
        assert isinstance(xs, ListOf(Float32)), type(xs)
        assert isinstance(ys, ListOf(Float32)), type(ys)
        assert isinstance(colors, (Color, ListOf(Color))), type(colors)

        self.xs = xs
        self.ys = ys
        self.lineWidths = lineWidths
        self.colors = colors

    def extent(self):
        if not self.xs:
            return Rectangle()

        return Rectangle(
            left=minOf(self.xs),
            bottom=minOf(self.ys),
            right=maxOf(self.xs),
            top=maxOf(self.ys),
        )

    def encode(self, packets):
        return {
            "type": "LineFigure",
            "x": packets.encode(self.xs),
            "y": packets.encode(self.ys),
            "lineWidth": packets.encode(self.lineWidths),
            "color": packets.encode(self.colors),
        }

    @staticmethod
    def create(x, y, lineWidth, color=None):
        if not isinstance(lineWidth, (float, int)):
            lineWidth = ListOf(Float32)(lineWidth)

        if color is not None:
            if not isinstance(color, ListOf(Color)):
                color = createColor(color)
        else:
            color = Color(blue=255, alpha=255)

        return LineFigure(ListOf(Float32)(x), ListOf(Float32)(y), lineWidth, color)


class Axis:
    """A method for labeling points in an axis."""

    def __init__(
        self,
        space=0.0,
        isTimestamp=False,
        isLogscale=False,
        offset=0.0,
        scale=1.0,
        color=createColor((0, 0, 0, 1)),
        zeroColor=createColor((0, 0, 0, 1)),
        ticklineColor=createColor((0, 0, 0, 0.1)),
        allowExpand=True,
        label=None,
    ):
        """Each point in the space 'x' gets mapped to 'x * scale + offset' to produce a label.

        If 'isLogscale', the resulting value is then exponentiated.

        If 'isTimestamp', the resulting value is considered a posix timestamp and displayed
        in NYC time.

        Space describes the number of pixels we want available to show the axis. If zero, then
        we don't show an axis.

        color - the color of the axis and text display.
        zeroColor - the color of the 'zero' line to draw
        ticklineColor - the color of the tickline to draw across
        """
        if label is not None:
            assert isinstance(label, str)

        self.space = space
        self.color = color
        self.isTimestamp = isTimestamp
        self.isLogscale = isLogscale
        self.offset = offset
        self.scale = scale
        self.color = createColor(color)
        self.zeroColor = createColor(zeroColor)
        self.ticklineColor = createColor(ticklineColor)
        self.allowExpand = allowExpand
        self.label = label

    def encode(self, packets):
        return {
            "color": packets.encode(self.color),
            "zeroColor": packets.encode(self.zeroColor),
            "ticklineColor": packets.encode(self.ticklineColor),
            "space": self.space,
            "isTimestamp": self.isTimestamp,
            "isLogscale": self.isLogscale,
            "offset": self.offset,
            "scale": self.scale,
            "allowExpand": self.allowExpand,
            "label": self.label,
        }


class Axes:
    def __init__(self, top=None, left=None, bottom=None, right=None):
        self.top = top
        self.left = left
        self.bottom = bottom
        self.right = right

    def encode(self, packets):
        return {
            "top": self.top.encode(packets) if self.top is not None else None,
            "bottom": self.bottom.encode(packets) if self.bottom is not None else None,
            "left": self.left.encode(packets) if self.left is not None else None,
            "right": self.right.encode(packets) if self.right is not None else None,
        }

    def __add__(self, other):
        return Axes(
            other.top or self.top,
            other.left or self.left,
            other.bottom or self.bottom,
            other.right or self.right,
        )


class Plot:
    def __init__(self, figures, backgroundColor=None, defaultViewport=None, axes=None):
        """Create a plot:

        Args:
            figures - a list of Figure objects
            backgroundColor - None or a Color/color tuple
            defaultViewport - None, or a Rect/rect tuple indicating where the plot will
                be centered by default. If None, then we'll ask each figure for an "extent".
        """
        self.figures = figures
        assert isinstance(backgroundColor, Color) or backgroundColor is None

        if defaultViewport is None:
            if not figures:
                defaultViewport = Rectangle()
            else:
                defaultViewport = figures[0].extent()
                for f in figures[1:]:
                    defaultViewport = defaultViewport.union(f.extent())
        else:
            defaultViewport = createRectangle(defaultViewport)

        self.backgroundColor = backgroundColor
        self.defaultViewport = defaultViewport

        if axes is not None:
            assert isinstance(axes, Axes)
        else:
            axes = Axes()

        self.axes = axes

    def encode(self, packets):
        return {
            "figures": [packets.encode(f) for f in self.figures],
            "backgroundColor": packets.encode(self.backgroundColor),
            "defaultViewport": packets.encode(self.defaultViewport),
            "axes": packets.encode(self.axes),
        }

    @staticmethod
    def create(
        x, y, lineWidth=1.0, color=None, backgroundColor=None, defaultViewport=None, axes=None
    ):
        return Plot(
            [LineFigure.create(x=x, y=y, lineWidth=lineWidth, color=color)],
            backgroundColor=createColor(backgroundColor),
            defaultViewport=defaultViewport,
            axes=axes,
        )

    def withLeftAxis(self, **kwargs):
        return Plot(
            self.figures,
            self.backgroundColor,
            self.defaultViewport,
            self.axes + Axes(left=Axis(**kwargs)),
        )

    def withBottomAxis(self, **kwargs):
        return Plot(
            self.figures,
            self.backgroundColor,
            self.defaultViewport,
            self.axes + Axes(bottom=Axis(**kwargs)),
        )

    def withTopAxis(self, **kwargs):
        return Plot(
            self.figures,
            self.backgroundColor,
            self.defaultViewport,
            self.axes + Axes(top=Axis(**kwargs)),
        )

    def withRightAxis(self, **kwargs):
        return Plot(
            self.figures,
            self.backgroundColor,
            self.defaultViewport,
            self.axes + Axes(right=Axis(**kwargs)),
        )

    def __add__(self, other):
        if not isinstance(other, Plot):
            return NotImplemented

        return Plot(
            self.figures + other.figures,
            other.backgroundColor or self.backgroundColor,
            other.defaultViewport or self.defaultViewport,
            other.axes + self.axes,
        )


class WebglPlot(Cell):
    def __init__(self, plotDataGenerator):
        """Initialize a line plot.

        plotDataGenerator: a function that produces plot data to pass to plotly.
            the function should return a tuple with two values: (data, layout), where
            'data' contains a list of trace objects to be passed to plotly, and 'layout'
            contains a dictionary of layout values to be merged into the layout we pass
            into plotly.
        """
        super().__init__()

        self.plotDataGenerator = plotDataGenerator
        self.packets = None

    def calculateErrorAndPlotData(self):
        with self.view() as v:
            try:
                plot = self.plotDataGenerator()

                if not isinstance(plot, Plot):
                    return f"plotDataGenerator returned {type(plot)}, not Plot"

                self.packets.resetTouched()

                response = self.packets.encode(plot)
                self.packets.eraseUntouched()

                return None, response
            except SubscribeAndRetry:
                raise
            except Exception:
                self._logger.exception("Exception in plot recalculation")

                return traceback.format_exc(), None
            finally:
                self._resetSubscriptionsToViewReads(v)

    def recalculate(self):
        if self.packets is None:
            self.packets = Packets(self.cells)

        error, plotData = self.calculateErrorAndPlotData()

        if error == self.exportData.get("error") and plotData == self.exportData.get(
            "plotData"
        ):
            return

        if error != self.exportData.get("error") or plotData != self.exportData.get(
            "plotData"
        ):
            self.markDirty()

        self.exportData["error"] = error
        self.exportData["plotData"] = plotData
