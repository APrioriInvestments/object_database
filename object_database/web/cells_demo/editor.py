#   Coyright 2017-2022 Nativepython Authors
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

import re
import time
from object_database.web import cells as cells
from object_database.web.CellsTestPage import CellsTestPage


class EditorDemo(CellsTestPage):
    def cell(self):
        sequenceCell = cells.Slot(0)

        edState = cells.SlotEditorState()

        e1 = cells.Editor(editorState=edState, commitDelay=2000, username="A")

        def makeEd2():
            ed2 = cells.Editor(
                editorState=edState, commitDelay=1000, username="B" + str(sequenceCell.get())
            )

            return ed2 + cells.KeyAction(
                "ctrlKey+2",
                lambda event: ed2.focus(),
                stopPropagation=True,
                preventDefault=True,
            )

        e2 = cells.Subscribed(makeEd2)

        return (
            (e1 >> e2)
            + cells.KeyAction(
                "ctrlKey+1",
                lambda event: e1.focus(),
                stopPropagation=True,
                preventDefault=True,
            )
            + cells.Button("Rebuild Ed 2", lambda: sequenceCell.set(sequenceCell.get() + 1))
            + cells.Button(
                "Add a line at top",
                lambda: e1.setContents("line at top\n" + e1.getCurrentContents()),
            )
            + cells.Button(
                "Add a line at bottom",
                lambda: e1.setContents(e1.getCurrentContents() + "\nline at bottom"),
            )
        )

    def text(self):
        return (
            "You should see two text editors each of which has a 'commitDelay'. You should "
            "be able to type in either of them and get consistent results despite the delay."
        )


class EditorSectionDemo(CellsTestPage):
    def cell(self):
        slotState = cells.Slot(0)

        edState = cells.SlotEditorState("# - asdf\n\n# - bsdf\n\n")

        def sectionDisplayFun(sectionName, sectionNumber):
            if slotState.get() % 3 == 0:
                return cells.Text(sectionName + ", " + str(sectionNumber))
            if slotState.get() % 3 == 1:
                return None
            return slotState.get()

        return cells.Editor(
            editorState=edState, username="A", sectionDisplayFun=sectionDisplayFun
        ) + cells.Button(
            "change the section headers", lambda: slotState.set(slotState.get() + 1)
        )

    def text(self):
        return (
            "You should see a text editor with a 'sections' display to the right. "
            "There should be a section for every line starting with '# - '."
        )


class EditorOverlayDisplay(CellsTestPage):
    def cell(self):
        slotState = cells.Slot(0)

        edState = cells.SlotEditorState("# - asdf\n\n# - bsdf\n\n")

        def overlayDisplayFun():
            return (
                cells.Text("Some Text")
                + cells.Text("Some selectable text", selectable=True)
                + cells.Code("Some Code\n\nSome More Code")
            )

        return cells.Editor(
            editorState=edState, username="A", overlayDisplayFun=overlayDisplayFun
        ) + cells.Button(
            "change the section headers", lambda: slotState.set(slotState.get() + 1)
        )

    def text(self):
        return (
            "You should see a text editor with a 'sections' display to the right. "
            "There should be a section for every line starting with '# - '."
        )


class PrefocusedEditor(CellsTestPage):
    def cell(self):
        slotState = cells.Slot(False)

        def editor():
            if slotState.get():
                ed = cells.Editor()
                ed.focus()
                return ed

        return cells.Button("Show editor", slotState.toggle) + cells.Subscribed(editor)

    def text(self):
        return (
            "You should see a button that brings up a text editor. It should have "
            "focus when it pops up."
        )


class EditorWithAutocomplete(CellsTestPage):
    def cell(self):
        return cells.Editor(
            autocompleteFunction=lambda request: request.complete(
                [
                    dict(completion="A", docstring='a really great letter is "A"'),
                    "abcdef",
                    "abcDEF",
                    "acbDEF",
                    dict(completion="B", docstring="dont use A use B"),
                ]
            )
        )

    def text(self):
        return "You should see an editor with autocompletion available."


class EditorWithNeverResolvedAutocomplete(CellsTestPage):
    def cell(self):
        return cells.Editor(autocompleteFunction=lambda request: None)

    def text(self):
        return "You should see an editor with autocompletion available."


class EditorWithDoubleClick(CellsTestPage):
    def cell(self):
        editor = cells.Editor(
            onDoubleClick=lambda *args: editor.setContents(
                editor.getCurrentContents() + "\n\n" + str(args)
            )
        )

        return editor

    def text(self):
        return (
            "You should see an editor which appends some line and column info if you "
            "double-click any of its text"
        )


class EditorWithTripleClick(CellsTestPage):
    def cell(self):
        def addHighlightedLine(editor, *args):
            currentContents = editor.getCurrentContents()
            lines = currentContents.split("\n")
            editor.setContents(f"{currentContents}\n{lines[min(args[0], len(lines) - 1)]}")

        editor = cells.Editor(onTripleClick=lambda *args: addHighlightedLine(editor, *args))

        return editor

    def text(self):
        return (
            "You should see an editor which appends the highlighted line if you "
            "triple-click any of its text"
        )


def test_editor_with_triple_click(headless_browser):
    def triple_click(element, delay=0.1):
        headless_browser.action.move_to_element(element).click().perform()
        time.sleep(delay)
        headless_browser.action.move_to_element(element).click().perform()
        time.sleep(delay)
        headless_browser.action.move_to_element(element).click().perform()

    def type_letters(element, text, delay=0.1):
        for c in text:
            element.send_keys(c)
            time.sleep(delay)

    demo_root = headless_browser.get_demo_root_for(EditorWithTripleClick)
    assert demo_root
    assert demo_root.get_attribute("data-cell-type") == "Editor"
    editor_line_layer = demo_root.find_element(
        headless_browser.by.XPATH, ".//*[@class='editor-line-layer']"
    )
    assert editor_line_layer
    editor_line_query = "//*[@class='editor-line']"
    editor_lines = editor_line_layer.find_elements(
        headless_browser.by.XPATH, editor_line_query
    )
    assert len(editor_lines) == 1
    editor_selection_highlight_query = "//*[@class='editor-selection-highlight']"
    editor_selection_highlights = demo_root.find_elements(
        headless_browser.by.XPATH, editor_selection_highlight_query
    )
    assert len(editor_selection_highlights) == 1

    test_text = (
        "Line 1\n"
        " Line 2 with a leading space\n"
        "Line 3 with a trailing space\n"
        " Line 4 with a leading and a trailing space \n"
        "Line 5 which is the last line with text\n"
    )

    text_length = len(test_text.split("\n"))

    def line_condition(browser, text_length):
        return (
            len(browser.find_elements(headless_browser.by.XPATH, editor_line_query))
            >= text_length
        )

    type_letters(demo_root, test_text)

    headless_browser.wait().until(lambda browser: line_condition(browser, text_length))
    editor_lines = editor_line_layer.find_elements(
        headless_browser.by.XPATH, editor_line_query
    )
    lines = [editor_line.text for editor_line in editor_lines]
    assert len(lines) == text_length

    line_index = 4
    result = re.search(r"top:\s*(-?\d+)px", editor_lines[line_index].get_attribute("style"))
    assert result
    assert len(result.groups()) == 1
    line_top = int(result.group(1))
    triple_click(editor_lines[line_index])
    text_length += 1
    lines.append(str(text_length) + lines[line_index].replace("\n", "")[1:])

    headless_browser.wait().until(lambda browser: line_condition(browser, text_length))
    editor_lines = editor_line_layer.find_elements(
        headless_browser.by.XPATH, editor_line_query
    )
    assert len(editor_lines) == len(lines)

    for i, editor_line in enumerate(editor_lines):
        assert editor_line.text == lines[i]

    editor_selection_highlights = demo_root.find_elements(
        headless_browser.by.XPATH, editor_selection_highlight_query
    )
    assert len(editor_selection_highlights) == 2
    value = editor_selection_highlights[1].get_attribute("style")
    result = re.search(r"left:\s*(-?\d+)px;\s*top:\s*(-?\d+)px", value)
    assert result
    assert len(result.groups()) == 2
    selection_left = int(result.group(1))
    selection_top = int(result.group(2))
    assert selection_left == 50
    assert abs(selection_top - line_top) < 5
