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
from object_database.web.cells.session_state import sessionState
from object_database.web.cells.computed_slot import ComputedSlot

import threading


class RowsPromise:
    """Clients can return this object, in lieu of actual rows.

    Then can fill out the result when data becomes available."""

    def __init__(self):
        self.results = None
        self.sheet = None
        self.reason = None
        self.range = None
        self.lock = threading.RLock()

    def setResult(self, rows):
        with self.lock:
            self.results = rows
            if self.sheet is not None:
                self.sheet.cells.scheduleCallback(self.sendData)

    def setSheet(self, sheet, range, reason):
        with self.lock:
            self.sheet = sheet
            self.reason = reason
            self.range = range

            if self.results:
                self.sheet.cells.scheduleCallback(self.sendData)

    def sendData(self):
        return self.sheet.scheduleMessage(
            {"data": self.results, "range": self.range, "reason": self.reason}
        )


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
        self.everCalculated = False

        self.uiStateSlot = None

    def getPromise(self):
        return RowsPromise()

    def recalculate(self):
        self.exportData["numLockRows"] = self.numLockRows
        self.exportData["numLockColumns"] = self.numLockColumns
        self.exportData["totalColumns"] = self.totalColumns
        self.exportData["totalRows"] = self.totalRows
        self.exportData["colWidth"] = self.colWidth
        self.exportData["rowHeight"] = self.rowHeight

        if not self.everCalculated:
            self.everCalculated = True

            # holds a dict {
            #   'visibleCorner': (float, float),
            #   'selection': ((x0,y0), (x1,y1))
            # }
            self.uiStateSlot = ComputedSlot(
                sessionState().slotFor(self.identityPath + ("SheetUiState",)).get,
                sessionState().slotFor(self.identityPath + ("SheetUiState",)).set,
            )

            curUiState = self.uiStateSlot.get()
            if curUiState is None:
                self.exportData["initVisibleCorner"] = (0.0, 0.0)
                self.exportData["initSelection"] = ((0, 0), (0, 0))
            else:
                self.exportData["initVisibleCorner"] = curUiState["visibleCorner"]
                self.exportData["initSelection"] = curUiState["selection"]

            with self.view():
                rows = self.rowFun(0, 99, 0, 30)

            if isinstance(rows, RowsPromise):
                if rows.results is not None:
                    self.exportData["initialState"] = rows.results
                else:
                    self.exportData["initialState"] = None
            elif rows is not None:
                assert isinstance(rows, list), type(rows)
                self.exportData["initialState"] = rows
            else:
                self.exportData["initialState"] = None

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

            if isinstance(rows_to_send, RowsPromise):
                rows_to_send.setSheet(self, rng, msgFrame.get("reason"))
            else:
                response = {
                    "data": rows_to_send,
                    "range": rng,
                    "reason": msgFrame.get("reason"),
                }

                self.scheduleMessage(response)

        if msgFrame["event"] == "ui_state_changed":
            newState = msgFrame["uiState"]

            assert "visibleCorner" in newState
            assert "selection" in newState

            self.uiStateSlot.set(newState, reason="client update")
