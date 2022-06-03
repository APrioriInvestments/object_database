#   Copyright 2017-2019 Nativepython Authors
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


class BasicPanel(CellsTestPage):
    def cell(self):
        return cells.Panel(
            cells.Text("Button in a Panel") + cells.Button("A Button", lambda: None)
        )

    def text(self):
        return (
            "Should see Text and Button Vert Sequence inside of a bordered panel,"
            " taking up greedy space in both dimensions"
        )


class BasicPanelInFlexSequence(CellsTestPage):
    def cell(self):
        outer = cells.Sequence(
            [
                cells.Button("Top Button", lambda: None),
                cells.Flex(cells.Panel(cells.Text("A Flexing Panel"))),
                cells.Button("Bottom Button", lambda: None),
            ]
        )
        return outer

    def text(self):
        return (
            "Should see a flex parent vert sequence where the Panel is flexing as"
            " the child, no longer taking up 100% in both dimensions (since we are flexing)"
        )


class NestedVertFlexPanel(CellsTestPage):
    def cell(self):
        return cells.Panel(
            cells.Text("Button in a Panel") + cells.Button("A Button", lambda: None)
        ) + cells.Flex(cells.Panel(cells.Text("something else")))

    def text(self):
        return (
            "Should see vertical sequence of two panels, the second is "
            "flexed, first is shrinkwrapped vertically, and both expand "
            "fully on horizontal axis"
        )


class NestedVertHorizPanel(CellsTestPage):
    def cell(self):
        return cells.Panel(
            cells.Text("Button in a Panel") + cells.Button("A Button", lambda: None)
        ) >> cells.Flex(cells.Panel(cells.Text("something else")))

    def text(self):
        return (
            "Should see horizontal sequence of two panels, the second is flexed,"
            " first is shrinkwrapped horizontally, and both expand fully on horizontal axis"
        )


class HorizPanelNonWrapSequence(CellsTestPage):
    def cell(self):
        def make_panel(num):
            return cells.Panel(
                cells.Text("Panel {}".format(num))
                + cells.Button("Button {}".format(num), lambda: None)
            )

        panels = [make_panel(i) for i in range(50)]
        return cells.HorizontalSequence(panels, wrap=False)

    def text(self):
        return "Should see 50 panels horizontally across the screen without wrapping"


class HorizPanelDoesWrapSequence(CellsTestPage):
    def cell(self):
        def make_panel(num):
            return cells.Panel(
                cells.Text("Panel {}".format(num))
                + cells.Button("Button {}".format(num), lambda: None)
            )

        panels = [make_panel(i) for i in range(50)]
        return cells.HorizontalSequence(panels)

    def text(self):
        return "Should see 50 panels horizontally across the screen with wrapping"


class PanelSwitchBetweenSequenceAndNonsequence(CellsTestPage):
    def cell(self):
        isSequence = cells.Slot(True)

        return cells.Button("toggle", lambda: isSequence.toggle()) + (
            cells.Panel(
                cells.Subscribed(
                    lambda: cells.Text("One thing")
                    if isSequence.get()
                    else (cells.Text("Thing 1") + cells.Text("Thing 2"))
                )
            )
        )

    def text(self):
        return "Should see a button that toggles a panel between one and two lines."


class PanelAndNestedFlexWithSwitching(CellsTestPage):
    def cell(self):
        isSequence = cells.Slot(False)

        return cells.Button("toggle", lambda: isSequence.toggle()) + (
            cells.ResizablePanel(
                cells.Panel(
                    cells.Text("Some Text")
                    + cells.Flex(
                        cells.Subscribed(
                            lambda: cells.Panel(
                                cells.Subscribed(
                                    lambda: cells.Editor() if isSequence.get() else None
                                )
                            )
                        )
                    )
                ),
                cells.Panel(
                    cells.Text("Some Text")
                    + cells.Flex(
                        cells.Subscribed(
                            lambda: cells.Panel(
                                cells.Subscribed(
                                    lambda: cells.WebglPlot(
                                        lambda: Plot.create([1, 2, 3], [1, 2, 3])
                                    )
                                    if isSequence.get()
                                    else None
                                )
                            )
                        )
                    )
                ),
            )
        )

    def text(self):
        return "Should see a button that toggles a panel between one and two lines."


def test_panel_and_nested_flex_handle_changed_child_size_correctly(headless_browser):
    # Test that we can find the editor and set the first visible row
    # programmatically from the server side
    demo_root = headless_browser.get_demo_root_for(PanelAndNestedFlexWithSwitching)
    assert demo_root

    toggle_btn = headless_browser.find_by_css('[data-cell-type="Button"]')
    toggle_btn.click()

    def codeEditorHasSize(*args):
        code_editor = headless_browser.find_by_css('[data-cell-type="Editor"]')

        return code_editor.size["height"] > 10

    headless_browser.wait(5).until(codeEditorHasSize)
