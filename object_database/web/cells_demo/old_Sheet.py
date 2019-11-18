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


class BasicOldSheet(CellsTestPage):
    def cell(self):
        headers = ["ONE", "TWO", "THREE"]

        def getRow(row_index):
            return [row_index + 0, row_index + 1, row_index + 2]

        sheet = (
            cells.OldSheet(headers, 100, getRow)
            .width("calc(100vw - 70px)")
            .height("calc(100vh - 150px)")
        )

        return sheet

    def text(self):
        return "You should see a plain sheet with initial data"


class ToggleOldSheet(CellsTestPage):
    def cell(self):
        is_showing = cells.Slot(True)
        headers = ["ONE", "TWO", "THREE"]

        def getRow(row_index):
            return [row_index + 0, row_index + 1, row_index + 2]

        sheet = (
            cells.OldSheet(headers, 100, getRow)
            .width("calc(100vw - 70px)")
            .height("calc(100vh - 150px)")
        )

        toggle_btn = cells.Button("Toggle", lambda: is_showing.set(not is_showing.get()))
        empty_area = cells.Text("Hidden!")
        subscribed = cells.Subscribed(lambda: sheet if is_showing.get() else empty_area)

        return cells.Margin(25, toggle_btn) >> subscribed

    def text(self):
        return ("You should see a sheet with initial data that ", "you can toggle for show")


class UpdateOldSheet(CellsTestPage):
    def cell(self):
        data = cells.Slot(0)

        def sheetPanel():
            return cells.SubscribedSequence(
                lambda: list(range(max(0, data.get()))),
                lambda which: cells.Panel(
                    cells.OldSheet(
                        ["A", "B", "C" + str(which)], 100, lambda rowIx: ["(%s) ts" % rowIx]
                    )
                    .width("800px")
                    .height("100px")
                ),
            )

        return (
            cells.Button("more", lambda: data.set(data.get() + 1))
            + cells.Button("fewer", lambda: data.set(data.get() - 1))
            + cells.Subscribed(lambda: data.get())
            + cells.Subscribed(sheetPanel)
        )

    def text(self):
        pass
