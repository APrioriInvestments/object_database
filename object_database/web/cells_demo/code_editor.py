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

import time

from object_database.web import cells as cells
from object_database.web.CellsTestPage import CellsTestPage


class CodeEditorDemo(CellsTestPage):
    def cell(self):
        isShown = cells.Slot(False)

        return cells.Button(
            "Toggle the editor", lambda: isShown.set(not isShown.get())
        ) + cells.Subscribed(lambda: cells.CodeEditor() if isShown.get() else None)

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

        def textToDisplayFunction():
            return textContent.get()

        def onTextChange(text, selection):
            textContent.set(text)

        editor = cells.CodeEditor(
            onTextChange=onTextChange, textToDisplayFunction=textToDisplayFunction
        )

        return cells.Button(
            "Toggle the editor", lambda: isShown.set(not isShown.get())
        ) + cells.Subscribed(lambda: editor if isShown.get() else None)

    def text(self):
        return (
            "You should be able to Toggle a text editor, enter some text,",
            " and have the same text editor re-appear on toggling again",
        )


def test_stashed_editor_insert_text(headless_browser):
    # Test that we can find the editor and add text to it.
    demo_root = headless_browser.get_demo_root_for(CodeEditorStashedDemo)
    assert demo_root
    code_editor = headless_browser.find_by_css(
        '{} [data-cell-type="CodeEditor"]'.format(headless_browser.demo_root_selector)
    )
    assert code_editor
    script = 'cellHandler.activeCells["{}"].editor.setValue("{}")'.format(
        code_editor.get_attribute("data-cell-id"), "Hello World"
    )
    headless_browser.webdriver.execute_script(script)
    editor_query = "{} .ace_scroller".format(headless_browser.demo_root_selector)
    editor_content_area = headless_browser.find_by_css(editor_query)
    assert editor_content_area

    def textIsHelloWorld(*args):
        editor_content_area = headless_browser.find_by_css(editor_query)
        return editor_content_area.text == "Hello World"

    headless_browser.wait(5).until(textIsHelloWorld)


def test_stashed_hides_code_editor(headless_browser):
    # Test that we can hide the editor
    demo_root = headless_browser.get_demo_root_for(CodeEditorStashedDemo)
    assert demo_root

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
    # Test that hiding and bringing it back preserves its state.

    demo_root = headless_browser.get_demo_root_for(CodeEditorStashedDemo)
    assert demo_root

    query = '{} [data-cell-type="CodeEditor"]'.format(headless_browser.demo_root_selector)
    location = (headless_browser.by.CSS_SELECTOR, query)

    code_editor = headless_browser.find_by_css(
        '{} [data-cell-type="CodeEditor"]'.format(headless_browser.demo_root_selector)
    )

    # wait for the editor to show up
    headless_browser.wait(15).until(
        headless_browser.expect.presence_of_element_located(location)
    )

    # insert some text
    script = 'cellHandler.activeCells["{}"].editor.setValue("{}")'.format(
        code_editor.get_attribute("data-cell-id"), "Hello World"
    )
    headless_browser.webdriver.execute_script(script)

    # wait for the text to be 'hello world'
    def textIsHelloWorld(*args):
        editor_content_area_query = "{} .ace_scroller".format(
            headless_browser.demo_root_selector
        )

        editor_content_area = headless_browser.find_by_css(editor_content_area_query)
        if not editor_content_area:
            return False

        return editor_content_area.text == "Hello World"

    # sleep for one second. The code editor compresses updates
    # that it sends to the backend. If it goes away too quickly, it won't send
    time.sleep(1.0)

    # hit the button
    toggle_btn = headless_browser.find_by_css(
        '{} > [data-cell-type="Button"]'.format(headless_browser.demo_root_selector)
    )
    toggle_btn.click()

    # wait for the editor to go away
    headless_browser.wait(15).until(
        headless_browser.expect.invisibility_of_element_located(location)
    )

    # hit the button again
    toggle_btn.click()

    # wait for the editor to come back
    headless_browser.wait(15).until(
        headless_browser.expect.presence_of_element_located(location)
    )

    # text is still Hello World
    headless_browser.wait(15).until(textIsHelloWorld)


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
            + (
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


class JoinedCodeEditors(CellsTestPage):
    def cell(self):
        contents = cells.Slot("")

        def onTextChange(buffer, selection):
            if contents.getWithoutRegisteringDependency() != buffer:
                contents.set(buffer)

        codeEditor1 = cells.CodeEditor(
            onTextChange=onTextChange, textToDisplayFunction=contents.get
        ).tagged("ed1")
        codeEditor2 = cells.CodeEditor(
            onTextChange=onTextChange, textToDisplayFunction=contents.get
        ).tagged("ed2")

        return cells.ResizablePanel(codeEditor1, codeEditor2)

    def text(self):
        return "You should see two code editors that have to show the same text."


def test_text_mirrors_correctly(headless_browser):
    headless_browser.load_demo_page(JoinedCodeEditors)

    code_editor1 = headless_browser.find_by_css('[data-tag="ed1"]')

    script = 'cellHandler.activeCells["{}"].editor.setValue("{}")'.format(
        code_editor1.get_attribute("data-cell-id"), "Hello World"
    )

    headless_browser.webdriver.execute_script(script)

    def textIsHelloWorld(*args):
        code_editor2 = headless_browser.find_by_css('[data-tag="ed2"] .ace_scroller')

        if not code_editor2:
            return False

        return code_editor2.text == "Hello World"

    headless_browser.wait(5).until(textIsHelloWorld)


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
            cells.Button("Go!", lambda: codeEditor.setFirstVisibleRow(10)), codeEditor
        )

    def text(self):
        return "By clicking 'Go!' you should see the code editor scroll down."


def test_set_first_row_serverside(headless_browser):
    # Test that we can find the editor and set the first visible row
    # programmatically from the server side
    demo_root = headless_browser.get_demo_root_for(ServerSideSetFirstVisibleRow)
    assert demo_root

    toggle_btn = headless_browser.find_by_css('[data-cell-type="Button"]')
    toggle_btn.click()

    def gutterLineIsTen(*args):
        gutterLine = headless_browser.find_by_css(".ace_gutter-active-line")
        if not gutterLine:
            return False

        return gutterLine.text == "10"

    headless_browser.wait(10).until(gutterLineIsTen)

    assert gutterLineIsTen()
