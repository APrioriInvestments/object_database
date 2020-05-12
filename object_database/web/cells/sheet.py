#   Copyright 2017-2020 object_database Authors
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
from object_database.web.cells import Cell


class Sheet(Cell):
    def __init__(
        self,
        rowFun,
        totalColumns,
        totalRows,
        colWidth=50,
        rowHeight=30,
        numLockRows=0,
        numLockColumns=0,
        onCellDblClick=None,
    ):
        super().__init__()

        self.rowFun = rowFun
        self.totalColumns = totalColumns
        self.totalRows = totalRows
        self.colWidth = colWidth
        self.rowHeight = rowHeight
        if numLockRows >= totalRows:
            raise "The number of totalRows must be greater than numLockRows."
        self.numLockRows = numLockRows
        self.numLockColumns = numLockColumns
        if numLockColumns >= totalColumns:
            raise "The number of totalColumns must be greater than numLockColumns."

        # TODO: Add double click feature from
        # current old sheet

    def recalculate(self):
        self.exportData["numLockRows"] = self.numLockRows
        self.exportData["numLockColumns"] = self.numLockColumns
        self.exportData["totalColumns"] = self.totalColumns
        self.exportData["totalRows"] = self.totalRows
        self.exportData["colWidth"] = self.colWidth
        self.exportData["rowHeight"] = self.rowHeight

    def onMessage(self, msgFrame):
        if msgFrame["event"] == "sheet_needs_data":
            requested_frames = msgFrame["frames"]
            response_frames = []
            for frame in requested_frames:
                rows_to_send = self.rowFun(
                    # start_row
                    frame["origin"]["y"],
                    # end row
                    frame["corner"]["y"],
                    # start_column
                    frame["origin"]["x"],
                    # end_column
                    frame["corner"]["x"],
                )
                response_frames.append(
                    {
                        "data": rows_to_send,
                        "origin": frame["origin"],
                        "corner": frame["corner"],
                    }
                )

            dataToSend = [{"action": msgFrame["action"], "frames": response_frames}]
            if self.exportData.get("dataInfo") is None:
                self.exportData["dataInfo"] = dataToSend
            else:
                self.exportData["dataInfo"] += dataToSend
            self.wasDataUpdated = True
            self.markDirty()
