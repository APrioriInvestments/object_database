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
from object_database.web.cells.webgl_plot import Plot


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
        edState = cells.SlotEditorState("Text\n" * 100)

        return cells.HorizontalSequence(
            [
                cells.Editor(edState),
                cells.Panel(
                    cells.Scrollable(cells.Code(cells.Subscribed(edState.getCurrentState)))
                ),
            ]
        )

    def text(self):
        return (
            "Should see an Editor and its content "
            "next to it. If you have too much content, it should scroll."
        )


class ScrollableWithSeveralPlots(CellsTestPage):
    def cell(self):
        return cells.Scrollable(
            (
                cells.WebglPlot(lambda: Plot.create([1, 2, 3], [1, 2, 3]))
                >> cells.WebglPlot(lambda: Plot.create([1, 2, 3], [1, 2, 3]))
                >> cells.WebglPlot(lambda: Plot.create([1, 2, 3], [1, 2, 3]))
            )
            + (
                cells.WebglPlot(lambda: Plot.create([1, 2, 3], [1, 2, 3]))
                >> cells.WebglPlot(lambda: Plot.create([1, 2, 3], [1, 2, 3]))
                >> cells.WebglPlot(lambda: Plot.create([1, 2, 3], [1, 2, 3]))
            )
            + (
                cells.WebglPlot(lambda: Plot.create([1, 2, 3], [1, 2, 3]))
                >> cells.WebglPlot(lambda: Plot.create([1, 2, 3], [1, 2, 3]))
                >> cells.WebglPlot(lambda: Plot.create([1, 2, 3], [1, 2, 3]))
            )
        )

    def text(self):
        return "Should see four plots that can be scrolled over, arranged" " in a square."


class ScrollableHWithSeveralPlots(CellsTestPage):
    def cell(self):
        return cells.HScrollable(
            cells.WebglPlot(lambda: Plot.create([1, 2, 3], [1, 2, 3]))
            >> cells.WebglPlot(lambda: Plot.create([1, 2, 3], [1, 2, 3]))
            >> cells.WebglPlot(lambda: Plot.create([1, 2, 3], [1, 2, 3]))
            >> cells.WebglPlot(lambda: Plot.create([1, 2, 3], [1, 2, 3]))
            >> cells.WebglPlot(lambda: Plot.create([1, 2, 3], [1, 2, 3]))
        )

    def text(self):
        return "Should see several plots stacked horizontally."


class ScrollableVWithSeveralPlots(CellsTestPage):
    def cell(self):
        return cells.VScrollable(
            cells.WebglPlot(lambda: Plot.create([1, 2, 3], [1, 2, 3]))
            + cells.WebglPlot(lambda: Plot.create([1, 2, 3], [1, 2, 3]))
            + cells.WebglPlot(lambda: Plot.create([1, 2, 3], [1, 2, 3]))
            + cells.WebglPlot(lambda: Plot.create([1, 2, 3], [1, 2, 3]))
            + cells.WebglPlot(lambda: Plot.create([1, 2, 3], [1, 2, 3]))
        )

    def text(self):
        return "Should see several plots stacked horizontally."


class ScrollableWithSeveralCodeEditors(CellsTestPage):
    def cell(self):
        return cells.Scrollable(
            (cells.Editor() >> cells.Editor() >> cells.Editor())
            + (cells.Editor() >> cells.Editor() >> cells.Editor())
            + (cells.Editor() >> cells.Editor() >> cells.Editor())
        )

    def text(self):
        return "Should see four plots that can be scrolled over, arranged" " in a square."


class ScrollableHWithSeveralCodeEditors(CellsTestPage):
    def cell(self):
        return cells.HScrollable(
            cells.Editor()
            >> cells.Editor()
            >> cells.Editor()
            >> cells.Editor()
            >> cells.Editor()
        )

    def text(self):
        return "Should see several plots stacked horizontally."


class ScrollableVWithSeveralCodeEditors(CellsTestPage):
    def cell(self):
        return cells.VScrollable(
            cells.Editor() + cells.Editor() + cells.Editor() + cells.Editor() + cells.Editor()
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
        return (
            "Should see a text editor and a bunch of numbers. Whatever number you "
            "type into the editor should get scrolled into view."
        )


class ScrollableSequenceOfCardAndPlot(CellsTestPage):
    def cell(self):
        return cells.Scrollable(
            cells.Sequence(
                [
                    cells.WebglPlot(lambda: Plot.create([1, 2, 3], [1, 2, 1])),
                    cells.Card("A card shrinkwraps"),
                    cells.WebglPlot(lambda: Plot.create([1, 2, 3], [1, 2, 1])),
                    cells.Card("A card shrinkwraps"),
                    cells.WebglPlot(lambda: Plot.create([1, 2, 3], [1, 2, 1])),
                ]
            )
        )

    def text(self):
        return "Should see a Card between each plot."


class ScrollableSequenceOfCardAndTabs(CellsTestPage):
    def cell(self):
        txtA = (
            "Tab Card A, longer than the default Tabs width, causing it to wrap once "
            "we exceed said width, which happens about now."
        )
        txtB = "Tab Card B"

        return cells.Scrollable(
            cells.Sequence(
                [
                    cells.Tabs(a=cells.Card(txtA), b=cells.Card(txtB)),
                    cells.Card("A card shrinkwraps"),
                    cells.Tabs(a=cells.Card(txtA), b=cells.Card(txtB)),
                    cells.Card("A card shrinkwraps"),
                    cells.Tabs(a=cells.Card(txtA), b=cells.Card(txtB)),
                ]
            )
        )

    def text(self):
        return "Should see a Card between each plot and Card in Tab A should not wrap."


class ScrollIntoViewOnFirstVisible(CellsTestPage):
    def cell(self):
        topVisible = cells.Slot(0)
        bottomVisible = cells.Slot()

        return (
            cells.Button("Toggle top", topVisible.toggle)
            + cells.Button("Toggle bottom", bottomVisible.toggle)
            + cells.Scrollable(
                cells.Sequence(
                    [
                        cells.Subscribed(
                            lambda: None
                            if not topVisible.get()
                            else cells.VisibleInParentScrollOnFirstDisplay()
                            * cells.Text("Should be at the top")
                        )
                        + cells.Sized(height=5000) * cells.VCenter(cells.Text("middle"))
                        + cells.Subscribed(
                            lambda: None
                            if not bottomVisible.get()
                            else cells.VisibleInParentScrollOnFirstDisplay()
                            * cells.Text("Should be at the bottom")
                        )
                    ]
                )
            )
        )

    def text(self):
        return (
            "Should see two buttons that turn off/on two pieces of text. when they come on"
            "you should scroll so that piece of content is visible."
        )
