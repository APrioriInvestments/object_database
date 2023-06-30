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
import os
from object_database.web import cells as cells
from object_database.web.CellsTestPage import CellsTestPage


class BasicOcticon(CellsTestPage):
    def cell(self):
        return cells.Card(cells.Octicon("shield", color="green"), padding=4)

    def text(self):
        return "You should see a single octicon."


class MultiOcticon(CellsTestPage):
    def cell(self):
        return cells.Card(
            cells.HorizontalSequence(
                [
                    cells.Octicon("shield", color="green"),
                    cells.Octicon("stop", color="red"),
                    cells.Octicon("alert", color="yellow"),
                ]
            ),
            padding=4,
        )

    def text(self):
        return "You should see a single octicon."


class ReusedOcticon(CellsTestPage):
    def cell(self):
        slot = cells.Slot(0)
        o = cells.Octicon("shield")

        return cells.Button("Add", lambda: slot.set(slot.get() + 1)) + cells.Subscribed(
            lambda: cells.Text(f"Its {slot.get()}") + o
        )

    def text(self):
        return "You should see an octicon. Clicking on the button shouldn't crash us."


class AllOcticons(CellsTestPage):
    def cell(self):
        # Open CSS file and find the octicons we know about. Their names are between
        # the following two "anchors"
        leftAnchor = ".octicon-"
        rightAnchor = ":before{content"

        ownDir = os.path.dirname(os.path.abspath(__file__))
        octiconCssPath = os.path.abspath(
            os.path.join(
                ownDir, "..", "..", "web", "content", "dependencies", "octicons.min.css"
            )
        )
        with open(octiconCssPath, "r") as fd:
            octiconCssText = fd.read()

        octiconCells = []
        for octiconText in octiconCssText.split(leftAnchor)[1:]:
            if rightAnchor in octiconText:
                octicon = octiconText.split(rightAnchor)[0]
                octiconCells.append(
                    cells.HorizontalSequence(
                        [
                            # cells.Sized(height=100, width=100) *
                            cells.Octicon(
                                octicon, color="black", hoverText=octicon, small=True
                            ),
                            cells.Padding(padding=10),
                            # cells.Sized(height=100, width=100) *
                            # cells.Text(octicon, fontSize=20),
                            cells.Text(octicon),
                        ]
                    )
                )

        # Arrange sequence of octicons into a grid iterating "vertically" one column at a time
        columnWidth = 8

        rowCount = len(octiconCells) // columnWidth
        if len(octiconCells) % columnWidth != 0:
            rowCount += 1

        rows = [[] for _ in range(rowCount)]

        rowIx = 0
        colIx = 0
        for octiconCell in octiconCells:
            rows[rowIx].append(octiconCell)
            rowIx += 1
            if rowIx == rowCount:
                rowIx = 0
                colIx += 1

        while rowIx < rowCount:
            rows[rowIx].append(None)
            rowIx += 1
            if rowIx == rowCount:
                colIx += 1

        assert colIx == columnWidth, (colIx, columnWidth)

        rows = [tuple(row) for row in rows]

        table = cells.Table(
            colFun=lambda: list(range(columnWidth)),
            rowFun=lambda: rows,
            headerFun=lambda x: x,
            rendererFun=lambda row, col: row[col],
            maxRowsPerPage=1000,
        )

        return cells.Scrollable(table)

    def text(self):
        return "You should see ALL known octicons."
