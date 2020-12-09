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

import pytest

from object_database.web import cells as cells
from object_database.web.CellsTestPage import CellsTestPage


class CodeEditorDemo(CellsTestPage):
    def cell(self):
        isShown = cells.Slot(False)

        return cells.Button(
            "Toggle the editor", lambda: isShown.set(not isShown.get())
        ) + cells.Flex(cells.Subscribed(lambda: cells.CodeEditor() if isShown.get() else None))

    def text(self):
        return "You should see a button that lets you see a text editor."


def test_basic_code_editor_hidden(headless_browser):
    # Ensures we can load the demo page element
    # and that there is NO CodeEditor showing yet
    headless_browser.load_demo_page(CodeEditorDemo)
    query = '{} [data-cell-type="CodeEditor"]'.format(headless_browser.demo_root_selector)
    elements = headless_browser.find_by_css(query, many=True)
    assert len(elements) < 1


def test_basic_code_editor_shown(headless_browser):
    # Click the button, then see if the CodeEditor shows
    button = headless_browser.find_by_css(
        '{} > [data-cell-type="Button"]'.format(headless_browser.demo_root_selector)
    )
    query = '{} [data-cell-type="CodeEditor"]'.format(headless_browser.demo_root_selector)
    location = (headless_browser.by.CSS_SELECTOR, query)
    button.click()
    headless_browser.wait(5).until(
        headless_browser.expect.presence_of_element_located(location)
    )


def test_basic_code_editor_hidden_again(headless_browser):
    # Now ensure that a second click hides the
    # CodeEditor
    button = headless_browser.find_by_css(
        '{} > [data-cell-type="Button"]'.format(headless_browser.demo_root_selector)
    )
    query = '{} [data-cell-type="CodeEditor"]'.format(headless_browser.demo_root_selector)
    location = (headless_browser.by.CSS_SELECTOR, query)
    button.click()
    headless_browser.wait(5).until(
        headless_browser.expect.invisibility_of_element_located(location)
    )


class CodeEditorStashedDemo(CellsTestPage):
    def cell(self):
        isShown = cells.Slot(True)
        textContent = cells.Slot("")
        editor = cells.CodeEditor(
            onTextChange=lambda text, selection: textContent.set(text),
            textToDisplayFunction=lambda: textContent.get(),
        )

        return cells.Button(
            "Toggle the editor", lambda: isShown.set(not isShown.get())
        ) + cells.Flex(cells.Subscribed(lambda: editor if isShown.get() else None))

    def text(self):
        return (
            "You should be able to Toggle a text editor, enter some text,",
            " and have the same text editor re-appear on toggling again",
        )


# WARNING
# These three tests are sequential, and rely on being run one after the other
# becuase they depend on the state they left the system in from the prior test.
# we should fix that. But for the moment, just note that you can't select them
# and run them individuall and expect them to succeed.


def test_stashed_editor_insert_text(headless_browser):
    # Test that we can find the editor and
    # add text to it.
    demo_root = headless_browser.get_demo_root_for(CodeEditorStashedDemo)
    assert demo_root
    code_editor = headless_browser.find_by_css(
        '{} [data-cell-type="CodeEditor"]'.format(headless_browser.demo_root_selector)
    )
    assert code_editor
    script = 'cellHandler.activeComponents["{}"].editor.setValue("{}")'.format(
        code_editor.get_attribute("data-cell-id"), "Hello World"
    )
    headless_browser.webdriver.execute_script(script)
    editor_query = "{} .ace_scroller".format(headless_browser.demo_root_selector)
    editor_content_area = headless_browser.find_by_css(editor_query)
    assert editor_content_area
    assert editor_content_area.text == "Hello World"


def test_stashed_hides_code_editor(headless_browser):
    # Now test that the CodeEditor is hidden by clicking
    # the toggle button
    toggle_btn = headless_browser.find_by_css(
        '{} > [data-cell-type="Button"]'.format(headless_browser.demo_root_selector)
    )
    query = '{} [data-cell-type="CodeEditor"]'.format(headless_browser.demo_root_selector)
    location = (headless_browser.by.CSS_SELECTOR, query)
    toggle_btn.click()
    headless_browser.wait(5).until(
        headless_browser.expect.invisibility_of_element_located(location)
    )


def test_stashed_reloaded_editor_has_text(headless_browser):
    # Now click the button again, revealing the editor
    # and ensure that the editor has the previous text
    # value we assigned to it in
    # test_stashed_editor_insert_text
    toggle_btn = headless_browser.find_by_css(
        '{} > [data-cell-type="Button"]'.format(headless_browser.demo_root_selector)
    )
    query = '{} [data-cell-type="CodeEditor"]'.format(headless_browser.demo_root_selector)
    location = (headless_browser.by.CSS_SELECTOR, query)
    toggle_btn.click()
    headless_browser.wait(15).until(
        headless_browser.expect.presence_of_element_located(location)
    )
    editor_content_area_query = "{} .ace_scroller".format(headless_browser.demo_root_selector)
    editor_content_area = headless_browser.find_by_css(editor_content_area_query)
    assert editor_content_area
    assert editor_content_area.text == "Hello World"


class CodeEditorInHorizSequence(CellsTestPage):
    def cell(self):
        editorShown = cells.Slot(False)
        contentsShown = cells.Slot(False)

        contents = cells.Slot("")

        def onTextChange(buffer, selection):
            contents.set(buffer)

        def toggle(aSlot):
            aSlot.toggle()

        return (
            cells.Button("Show the editor", lambda: toggle(editorShown))
            + cells.Button("Show the editor's contents", lambda: toggle(contentsShown))
            + cells.Flex(
                cells.HorizontalSubscribedSequence(
                    lambda: (["Ed"] if editorShown.get() else [])
                    + (["Contents"] if contentsShown.get() else []),
                    lambda which: cells.CodeEditor(onTextChange=onTextChange)
                    if which == "Ed"
                    else cells.Subscribed(lambda: contents.get())
                    if which == "Contents"
                    else None,
                )
            )
        )

    def text(self):
        return (
            "You should see two buttons that let you turn the editor "
            "on and off, and also see its contents."
        )


class CodeEditorBasicHorizSequence(CellsTestPage):
    def cell(self):
        contents = cells.Slot("No Text Entered Yet!")

        def onTextChange(content, selection):
            contents.set(content)

        return cells.HorizontalSequence(
            [
                cells.CodeEditor(onTextChange=onTextChange),
                cells.Panel(cells.Subscribed(contents.get)),
            ]
        )

    def text(self):
        return (
            "Should see a CodeEditor and its content (in panel) in a "
            "HorizontalSequence that is not a flex parent"
        )


class CodeEditorFirstVisibleRowChange(CellsTestPage):
    def cell(self):
        text = """def cell(self):
        contents = cells.Slot("No Text Entered Yet!")

        textToDisplayFunction = lambda: "some text"

        def onTextChange(content, selection):
            contents.set(content)

        return cells.CodeEditor(
                textToDisplayFunction=textToDisplayFunction,
                onTextChange=onTextChange, firstVisibleRow=5
                )
        """
        text *= 5

        contents = cells.Slot("")

        firstRow = cells.Slot("1")

        def onTextChange(buffer, selection):
            contents.set(buffer)

        def onFirstRowChange(row):
            firstRow.set(str(row))

        return cells.ResizablePanel(
            cells.CodeEditor(
                textToDisplayFunction=lambda: text,
                onTextChange=onTextChange,
                onFirstRowChange=onFirstRowChange,
            ),
            cells.Subscribed(lambda: cells.Text("First visible row is " + firstRow.get())),
        )

    def text(self):
        return "You should see a code editor and a mirror of its contents."


class CodeEditorDelayedMouseover(CellsTestPage):
    def cell(self):
        text = """def cell(self):
        contents = cells.Slot("No Text Entered Yet!")

        textToDisplayFunction = lambda: "some text"

        def onTextChange(content, selection):
            contents.set(content)

        return cells.CodeEditor(
                textToDisplayFunction=textToDisplayFunction,
                onTextChange=onTextChange, firstVisibleRow=5
                )
        """
        text *= 5

        contents = cells.Slot("")

        row = cells.Slot("")
        column = cells.Slot("")
        line = cells.Slot("")
        token = cells.Slot("")

        def onTextChange(buffer, selection):
            contents.set(buffer)

        def onDelayedMouseover(eventData):
            row.set(str(eventData["row"]))
            column.set(str(eventData["column"]))
            line.set(str(eventData["line"]))
            token.set(str(eventData["token"]))

        return cells.ResizablePanel(
            cells.CodeEditor(
                textToDisplayFunction=lambda: text,
                onTextChange=onTextChange,
                mouseoverTimeout=1000,
                onMouseover=onDelayedMouseover,
            ),
            cells.Sequence(
                [
                    cells.Subscribed(lambda: cells.Text("Hovering over:")),
                    cells.Subscribed(lambda: cells.Text("row: " + row.get())),
                    cells.Subscribed(lambda: cells.Text("column: " + column.get())),
                    cells.Subscribed(lambda: cells.Text("line: " + line.get())),
                    cells.Subscribed(lambda: cells.Text("token: " + token.get())),
                ]
            ),
        )

    def text(self):
        return "You should see a code editor and a mirror of its contents."


class CodeEditorSetFirstVisibleRow(CellsTestPage):
    def cell(self):
        contents = cells.Slot("No Text Entered Yet!")
        text = """def cell(self):
        contents = cells.Slot("No Text Entered Yet!")

        textToDisplayFunction = lambda: "some text"

        def onTextChange(content, selection):
            contents.set(content)

        return cells.CodeEditor(
                textToDisplayFunction=textToDisplayFunction,
                onTextChange=onTextChange, firstVisibleRow=5
                )
        """
        text *= 5

        def onTextChange(content, selection):
            contents.set(content)

        return cells.CodeEditor(
            onTextChange=onTextChange, textToDisplayFunction=lambda: text, firstVisibleRow=5
        )

    def text(self):
        return "Should see a CodeEditor and its content with the first row set to " "5"


def test_set_first_row(headless_browser):
    # Test that we can find the editor and
    # add text to it.
    demo_root = headless_browser.get_demo_root_for(CodeEditorSetFirstVisibleRow)
    assert demo_root
    first_line = headless_browser.find_by_css(".ace_gutter-active-line")
    assert first_line
    assert first_line.text == "5"


class CodeEditorHighlightRows(CellsTestPage):
    def cell(self):
        contents = cells.Slot("No Text Entered Yet!")
        text = """def cell(self):
        contents = cells.Slot("No Text Entered Yet!")

        textToDisplayFunction = lambda: "some text"

        def onTextChange(content, selection):
            contents.set(content)

        return cells.CodeEditor(
                textToDisplayFunction=textToDisplayFunction,
                onTextChange=onTextChange, firstVisibleRow=5
                )
        """
        text *= 5

        def onTextChange(content, selection):
            contents.set(content)

        editor = cells.CodeEditor(
            onTextChange=onTextChange, textToDisplayFunction=lambda: text
        )

        editor.setMarkers([dict(startRow=5, endRow=10)])

        return editor

    def text(self):
        return "Should see a CodeEditor and its content with rows 5-10 " "highlighted"


def test_adding_highlight(headless_browser):
    # Test that we can find the editor and
    # add text to it.
    demo_root = headless_browser.get_demo_root_for(CodeEditorHighlightRows)
    assert demo_root
    marker_line = headless_browser.find_by_css(".ace_active-line")
    assert marker_line
    marker_line = headless_browser.find_by_css(".highlight-red")
    assert marker_line


class CodeEditorHighlightRowsInColor(CellsTestPage):
    def cell(self):
        contents = cells.Slot("No Text Entered Yet!")
        text = """def cell(self):
        contents = cells.Slot("No Text Entered Yet!")

        textToDisplayFunction = lambda: "some text"

        def onTextChange(content, selection):
            contents.set(content)

        return cells.CodeEditor(
                textToDisplayFunction=textToDisplayFunction,
                onTextChange=onTextChange, firstVisibleRow=5
                )
        """
        text *= 5

        def onTextChange(content, selection):
            contents.set(content)

        editor = cells.CodeEditor(
            onTextChange=onTextChange, textToDisplayFunction=lambda: text
        )

        editor.setMarkers([dict(startRow=5, endRow=10, color="blue")])

        return editor

    def text(self):
        return "Should see a CodeEditor and its content with rows 5-10 " "highlighted"


def test_adding_highlight_color(headless_browser):
    # Test that we can find the editor and
    # add text to it.
    demo_root = headless_browser.get_demo_root_for(CodeEditorHighlightRowsInColor)
    assert demo_root
    marker_line = headless_browser.find_by_css(".highlight-blue")
    assert marker_line


class CodeEditorInSplitView(CellsTestPage):
    def cell(self):
        contents = cells.Slot("")

        def onTextChange(buffer, selection):
            contents.set(buffer)

        return cells.ResizablePanel(
            cells.CodeEditor(onTextChange=onTextChange),
            cells.Subscribed(lambda: cells.Code(contents.get())),
        )

    def text(self):
        return "You should see a code editor and a mirror of its contents."


class CodeEditorInSplitViewWithHeader(CellsTestPage):
    def cell(self):
        contents = cells.Slot("")

        def onTextChange(buffer, selection):
            contents.set(buffer)

        return cells.ResizablePanel(
            cells.Text("This is an editor:") + cells.CodeEditor(onTextChange=onTextChange),
            cells.Text("This should show what's in the editor")
            + cells.Subscribed(lambda: cells.Code(contents.get())),
        )

    def text(self):
        return "You should see a code editor and a mirror of its contents."


class ServerSideSetFirstVisibleRow(CellsTestPage):
    def cell(self):
        contents = cells.Slot("")
        text = """def cell(self):
        contents = cells.Slot("No Text Entered Yet!")

        textToDisplayFunction = lambda: "some text"

        def onTextChange(content, selection):
            contents.set(content)

        return cells.CodeEditor(
            textToDisplayFunction=textToDisplayFunction,
            onTextChange=onTextChange,
            firstVisibleRow=5
        )
        """
        text *= 5

        def onTextChange(buffer, selection):
            contents.set(buffer)

        codeEditor = cells.CodeEditor(
            onTextChange=onTextChange, textToDisplayFunction=lambda: text
        )

        return cells.ResizablePanel(
            cells.WSMessageTester(codeEditor.setFirstVisibleRow, rowNum=10), codeEditor
        )

    def text(self):
        return "By clicking 'Go!' you should see the code editor scroll down."


@pytest.mark.skip(reason="fails inexplicably after socket code overhaul")
def test_set_first_row_serverside(headless_browser):
    # Test that we can find the editor and set the first visible row
    # programmatically from the server side
    demo_root = headless_browser.get_demo_root_for(ServerSideSetFirstVisibleRow)
    assert demo_root
    first_line = headless_browser.find_by_css(".ace_gutter-active-line")
    assert first_line
    assert first_line.text == "1"
    toggle_btn = headless_browser.find_by_css('[data-cell-type="WSTesterButton"]')
    toggle_btn.click()

    def textIsTen(*args):
        first_line = headless_browser.find_by_css(".ace_gutter-active-line")
        if not first_line:
            return False

        return first_line.text == "10"

    headless_browser.wait(10).until(textIsTen)
    assert textIsTen()
