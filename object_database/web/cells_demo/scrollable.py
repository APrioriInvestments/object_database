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


class basicScrollable(CellsTestPage):
    def cell(self):
        return cells.Scrollable(
            cells.Sequence([cells.Card("This is a card", padding=2) for index in range(20)])
        )

    def text(self):
        return "You should see some scrollable content."


class multiScrollable(CellsTestPage):
    def cell(self):
        return cells.SplitView(
            [
                (
                    cells.Card(
                        cells.Scrollable(
                            cells.Sequence(
                                [cells.Card("Row %s of 20" % (item + 1)) for item in range(20)]
                            )
                        ),
                        padding=10,
                    ),
                    1,
                ),
                (
                    cells.Card(
                        cells.Scrollable(
                            cells.Sequence(
                                [cells.Card("Row %s of 10" % (item + 1)) for item in range(10)]
                            )
                        ),
                        padding=10,
                    ),
                    10,
                ),
            ]
        )

    def text(self):
        return "You should see some scrollable content."


class CodeEditorNextToScrollable(CellsTestPage):
    def cell(self):
        contents = cells.Slot("Text\n" * 100)

        def onTextChange(content, selection):
            contents.set(content)

        return cells.HorizontalSequence(
            [
                cells.CodeEditor(
                    onTextChange=onTextChange, textToDisplayFunction=contents.get
                ),
                cells.Panel(cells.Scrollable(cells.Code(cells.Subscribed(contents.get)))),
            ]
        )

    def text(self):
        return (
            "Should see a CodeEditor and its content "
            "next to it. If you have to much content, it should scroll."
        )


class ScrollableWithSeveralPlots(CellsTestPage):
    def cell(self):
        return cells.Scrollable(
            (
                cells.Plot(lambda: ([{"x": [1, 2, 3], "y": [1, 2, 3]}], {}))
                >> cells.Plot(lambda: ([{"x": [1, 2, 3], "y": [1, 2, 3]}], {}))
                >> cells.Plot(lambda: ([{"x": [1, 2, 3], "y": [1, 2, 3]}], {}))
            )
            + (
                cells.Plot(lambda: ([{"x": [1, 2, 3], "y": [1, 2, 3]}], {}))
                >> cells.Plot(lambda: ([{"x": [1, 2, 3], "y": [1, 2, 3]}], {}))
                >> cells.Plot(lambda: ([{"x": [1, 2, 3], "y": [1, 2, 3]}], {}))
            )
            + (
                cells.Plot(lambda: ([{"x": [1, 2, 3], "y": [1, 2, 3]}], {}))
                >> cells.Plot(lambda: ([{"x": [1, 2, 3], "y": [1, 2, 3]}], {}))
                >> cells.Plot(lambda: ([{"x": [1, 2, 3], "y": [1, 2, 3]}], {}))
            )
        )

    def text(self):
        return "Should see four plots that can be scrolled over, arranged" " in a square."


class ScrollableHWithSeveralPlots(CellsTestPage):
    def cell(self):
        return cells.HScrollable(
            cells.Plot(lambda: ([{"x": [1, 2, 3], "y": [1, 2, 3]}], {}))
            >> cells.Plot(lambda: ([{"x": [1, 2, 3], "y": [1, 2, 3]}], {}))
            >> cells.Plot(lambda: ([{"x": [1, 2, 3], "y": [1, 2, 3]}], {}))
            >> cells.Plot(lambda: ([{"x": [1, 2, 3], "y": [1, 2, 3]}], {}))
            >> cells.Plot(lambda: ([{"x": [1, 2, 3], "y": [1, 2, 3]}], {}))
        )

    def text(self):
        return "Should see several plots stacked horizontally."


class ScrollableVWithSeveralPlots(CellsTestPage):
    def cell(self):
        return cells.VScrollable(
            cells.Plot(lambda: ([{"x": [1, 2, 3], "y": [1, 2, 3]}], {}))
            + cells.Plot(lambda: ([{"x": [1, 2, 3], "y": [1, 2, 3]}], {}))
            + cells.Plot(lambda: ([{"x": [1, 2, 3], "y": [1, 2, 3]}], {}))
            + cells.Plot(lambda: ([{"x": [1, 2, 3], "y": [1, 2, 3]}], {}))
            + cells.Plot(lambda: ([{"x": [1, 2, 3], "y": [1, 2, 3]}], {}))
        )

    def text(self):
        return "Should see several plots stacked horizontally."


class ScrollableWithSeveralCodeEditors(CellsTestPage):
    def cell(self):
        return cells.Scrollable(
            (cells.CodeEditor() >> cells.CodeEditor() >> cells.CodeEditor())
            + (cells.CodeEditor() >> cells.CodeEditor() >> cells.CodeEditor())
            + (cells.CodeEditor() >> cells.CodeEditor() >> cells.CodeEditor())
        )

    def text(self):
        return "Should see four plots that can be scrolled over, arranged" " in a square."


class ScrollableHWithSeveralCodeEditors(CellsTestPage):
    def cell(self):
        return cells.HScrollable(
            cells.CodeEditor()
            >> cells.CodeEditor()
            >> cells.CodeEditor()
            >> cells.CodeEditor()
            >> cells.CodeEditor()
        )

    def text(self):
        return "Should see several plots stacked horizontally."


class ScrollableVWithSeveralCodeEditors(CellsTestPage):
    def cell(self):
        return cells.VScrollable(
            cells.CodeEditor()
            + cells.CodeEditor()
            + cells.CodeEditor()
            + cells.CodeEditor()
            + cells.CodeEditor()
        )

    def text(self):
        return "Should see several plots stacked horizontally."


class ScrollableScrollChildToView(CellsTestPage):
    def cell(self):
        children = [cells.Text(i) for i in range(1000)]

        def change(x):
            scrollable.scrollChildIntoView(children[int(x)])

        scrollable = cells.VScrollable(cells.Sequence(children), visible=False)

        return cells.SingleLineTextBox(onTextChanged=change) + scrollable

    def text(self):
        return "Should see several plots stacked horizontally."
