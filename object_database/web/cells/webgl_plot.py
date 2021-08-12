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

from typed_python import ListOf, Float32, NamedTuple, UInt8

from object_database.web.cells.cell import Cell
from object_database.web.cells.subscribed import SubscribeAndRetry


import traceback


class Figure:
    pass


Color = NamedTuple(red=UInt8, green=UInt8, blue=UInt8, alpha=UInt8)


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

        if isinstance(data, (bytes, ListOf(Float32), ListOf(Color))):
            return {"packetId": self.getPacketId(data)}

        return data.encode(self)


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
            if isinstance(color, (tuple, list, ListOf)) and len(color) == 4:
                color = Color(
                    red=color[0] * 255.0,
                    green=color[1] * 255.0,
                    blue=color[2] * 255.0,
                    alpha=color[3] * 255.0,
                )
            else:
                assert isinstance(color, ListOf(Color))
        else:
            color = Color(blue=255, alpha=255)

        return LineFigure(ListOf(Float32)(x), ListOf(Float32)(y), lineWidth, color)


class Plot:
    def __init__(self, figures, backgroundColor=None):
        """Create a plot:

        Args:
            figures - a list of Figure objects
            backgroundColor - None or a tuple (red, green, blue, alpha) for the color of the
                plot canvas
        """
        self.figures = figures
        self.backgroundColor = backgroundColor

    def encode(self, packets):
        return {
            "figures": [packets.encode(f) for f in self.figures],
            "backgroundColor": packets.encode(self.backgroundColor),
        }

    @staticmethod
    def create(x, y, lineWidth=1.0, color=None):
        return Plot([LineFigure.create(x=x, y=y, lineWidth=lineWidth, color=color)])

    def __add__(self, other):
        if not isinstance(other, Plot):
            return NotImplemented

        return Plot(
            self.figures + other.figures, other.backgroundColor or self.backgroundColor
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
