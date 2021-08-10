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

from typed_python import ListOf, Float32

from object_database.web.cells.cell import Cell
from object_database.web.cells.subscribed import SubscribeAndRetry


import traceback


class WebglPlot(Cell):
    def __init__(self, plotDataGenerator, xySlot=None):
        """Initialize a line plot.

        plotDataGenerator: a function that produces plot data to pass to plotly.
            the function should return a tuple with two values: (data, layout), where
            'data' contains a list of trace objects to be passed to plotly, and 'layout'
            contains a dictionary of layout values to be merged into the layout we pass
            into plotly.
        """
        super().__init__()

        self.plotDataGenerator = plotDataGenerator
        self.plotData = None

    def calculateErrorAndPlotData(self):
        with self.view() as v:
            try:
                vertices = ListOf(Float32)(self.plotDataGenerator())

                return None, vertices.toBytes()
            except SubscribeAndRetry:
                raise
            except Exception:
                self._logger.exception("Exception in plot recalculation")

                return traceback.format_exc(), None
            finally:
                self._resetSubscriptionsToViewReads(v)

    def recalculate(self):
        error, plotData = self.calculateErrorAndPlotData()

        if error == self.exportData.get("error") and plotData == self.plotData:
            return

        if error != self.exportData.get("error") or plotData != self.plotData:
            self.markDirty()

        self.exportData["error"] = error
        self.exportData["packetId"] = self.cells.getPacketId(self.getPacketData)

        self.plotData = plotData

    def getPacketData(self, packetId):
        """Return the data for 'packetId'

        Because we may fire off several packets in a row, and we only retain data
        for one of them, we return None for any packet that's not the most recent.
        """
        if self.exportData["packetId"] == packetId:
            return self.plotData

        return None
