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

from typed_python import ListOf, TupleOf

from object_database.web.cells.cell import Cell
from object_database.web.cells.slot import Slot
from object_database.web.cells.subscribed import SubscribeAndRetry


import json
import numpy
import traceback


class Plot(Cell):
    """Produce some reactive line plots."""

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
        self.curXYRanges = xySlot or Slot(None)

    def recalculate(self):
        error, plotData = self.calculateErrorAndPlotData()

        if error != self.exportData.get("error") or plotData != self.exportData.get(
            "plotData"
        ):
            self.markDirty()

        self.exportData["error"] = error
        self.exportData["plotData"] = plotData

    def calculateErrorAndPlotData(self):
        with self.view() as v:
            try:
                traces, layout = self.plotDataGenerator()

                # map our traces
                traces = [recursivelyEncodeNumpyArrays(trace) for trace in traces]

                # force any exceptions to show up here, instead of later when we
                # attempt to serialize this.
                json.dumps((traces, layout))

                return None, (traces, layout)
            except SubscribeAndRetry:
                raise
            except Exception:
                self._logger.exception("Exception in plot recalculation")

                return traceback.format_exc(), None
            finally:
                self._resetSubscriptionsToViewReads(v)

    def onMessage(self, msgFrame):
        d = msgFrame["data"]
        curVal = self.curXYRanges.get() or ((None, None), (None, None))

        self.curXYRanges.set(
            (
                (d.get("xaxis.range[0]", curVal[0][0]), d.get("xaxis.range[1]", curVal[0][1])),
                (d.get("yaxis.range[0]", curVal[1][0]), d.get("yaxis.range[1]", curVal[1][1])),
            )
        )

        self.cells._logger.info("User navigated plot to %s", self.curXYRanges.get())

    def setXRange(self, low, high):
        curXY = self.curXYRanges.getWithoutRegisteringDependency()
        self.curXYRanges.set(((low, high), curXY[1] if curXY else (None, None)))

        self.scheduleMessage(
            {"event": "updateXYRange", "lowTimestamp": low, "highTimestamp": high}
        )


def recursivelyEncodeNumpyArrays(trace):
    if isinstance(trace, dict):
        res = {}

        for k, v in trace.items():
            res[k] = recursivelyEncodeNumpyArrays(v)

        return res
    elif isinstance(trace, list):
        res = []
        for v in trace:
            res.append(recursivelyEncodeNumpyArrays(v))

        return res
    elif isinstance(trace, (ListOf, TupleOf)):
        return recursivelyEncodeNumpyArrays(trace.toArray())
    elif isinstance(trace, numpy.ndarray):
        if trace.dtype == numpy.int64:
            traceType = "s64"
        elif trace.dtype == numpy.int32:
            traceType = "s32"
        elif trace.dtype == numpy.int16:
            traceType = "s16"
        elif trace.dtype == numpy.int8:
            traceType = "s08"
        elif trace.dtype == numpy.uint64:
            traceType = "u64"
        elif trace.dtype == numpy.uint32:
            traceType = "u32"
        elif trace.dtype == numpy.uint16:
            traceType = "u16"
        elif trace.dtype == numpy.uint8:
            traceType = "u08"
        elif trace.dtype == numpy.float64:
            traceType = "f64"
        elif trace.dtype == numpy.float32:
            traceType = "f32"
        else:
            trace = trace.astype("float32")
            traceType = "f32"

        return f"__hexencoded_{traceType}__" + trace.tostring().hex()
    else:
        return trace
