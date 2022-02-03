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
from object_database.web.cells.cell import FocusableCell


class Sheet(FocusableCell):
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
            raise Exception("The number of totalRows must be greater than numLockRows.")

        if numLockColumns >= totalColumns:
            raise Exception("The number of totalColumns must be greater than numLockColumns.")

        self.numLockRows = numLockRows
        self.numLockColumns = numLockColumns

    def recalculate(self):
        self.exportData["numLockRows"] = self.numLockRows
        self.exportData["numLockColumns"] = self.numLockColumns
        self.exportData["totalColumns"] = self.totalColumns
        self.exportData["totalRows"] = self.totalRows
        self.exportData["colWidth"] = self.colWidth
        self.exportData["rowHeight"] = self.rowHeight

    def onMessage(self, msgFrame):
        if msgFrame["event"] == "sheet_needs_data":
            rng = msgFrame.get("range")

            rows_to_send = self.rowFun(
                # start_row
                rng[0][1],
                # end row
                rng[1][1],
                # start_column
                rng[0][0],
                # end_column
                rng[1][0],
            )

            response = {"data": rows_to_send, "range": rng, "reason": msgFrame.get('reason')}

            self.scheduleMessage(response)
