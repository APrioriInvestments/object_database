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

TEST_TEXT = (
    "Line 1\n"
    " Line 2 with a leading space\n"
    "Line 3 with a trailing space \n"
    " Line 4 with a leading and a trailing space \n"
    "Line 5 which is the last line with text\n"
)
TEST_TEXT_LENGTH = len(TEST_TEXT.split("\n"))
EDITOR_LINE_QUERY = "//*[@class='editor-line']"
EDITOR_SELECTION_HIGHLIGHT_QUERY = "//*[@class='editor-selection-highlight']"
EDITOR_SELECTION_HIGHLIGHT_BASIC_QUERY = "//*[@class='editor-selection-highlight-basic']"
CHARACTER_WIDTH = 7
CHARACTER_HEIGHT = 14
TEXT_LEFT_PIXEL_OFFSET = 50
TEXT_TOP_PIXEL_OFFSET = 2


class BaseEditor(CellsTestPage):
    def cell(self):
        return cells.Editor()

    def text(self):
        return "You should see an editor without any modifications"


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


def get_start_space_count(string):
    return len(string) - len(string.lstrip())


def type_letters(element, text, delay=0.1):
    for c in text:
        element.send_keys(c)
        time.sleep(delay)


def send_keys(element, *args, times=1, delay=0.1):
    if args:
        for i in range(times):
            element.send_keys(*args)
            time.sleep(delay)


def condition(headless_browser, n, query):
    return lambda browser: len(browser.find_elements(headless_browser.by.XPATH, query)) >= n


def line_condition(headless_browser, text_length):
    return condition(headless_browser, text_length, EDITOR_LINE_QUERY)


def highlight_condition(headless_browser, selection_length):
    return condition(headless_browser, selection_length, EDITOR_SELECTION_HIGHLIGHT_QUERY)


def cursor_location(headless_browser):
    editor_cursor = headless_browser.find_by_xpath("//*[@class='editor-cursor']")
    result = re.search(
        r"left:\s*(-?\d+)px;\s*top:\s*(-?\d+)px", editor_cursor.get_attribute("style")
    )
    assert result
    x = (int(result.group(1)) - TEXT_LEFT_PIXEL_OFFSET + 1) / CHARACTER_WIDTH
    y = int(result.group(2)) / CHARACTER_HEIGHT
    return x, y


def highlight_location(editor_selection_highlight):
    result = re.search(
        r"left:\s*(-?\d+)px;\s*top:\s*(-?\d+)px;.*width:\s*(-?\d*\.?\d+|-?\d+)px",
        editor_selection_highlight.get_attribute("style"),
    )
    assert result
    x = (int(result.group(1)) - TEXT_LEFT_PIXEL_OFFSET) / CHARACTER_WIDTH
    y = (int(result.group(2)) - TEXT_TOP_PIXEL_OFFSET) / CHARACTER_HEIGHT
    width = float(result.group(3)) / CHARACTER_WIDTH
    return x, y, width


def test_ctrl_shift_left_right_arrow(headless_browser):
    keys = headless_browser.keys
    demo_root = headless_browser.get_demo_root_for(BaseEditor)
    assert demo_root
    assert demo_root.get_attribute("data-cell-type") == "Editor"

    def get_nth_word_length(string, n):
        result = re.findall(r"\w+", string)
        try:
            return len(result[n])
        except IndexError:
            return 0

    def check_highlight(editor_selection_highlight, expected_x, expected_y, expected_width):
        x, y, width = highlight_location(editor_selection_highlight)
        assert x == expected_x
        assert y == expected_y
        assert width == expected_width

    def check_cursor(expected_x, expected_y):
        x, y = cursor_location(headless_browser)
        assert x == expected_x
        assert y == expected_y

    def send(*args, expected_number=1, times=1, delay=0.1):
        send_keys(demo_root, *args, times=times, delay=delay)
        headless_browser.wait().until(highlight_condition(headless_browser, expected_number))
        editor_selection_highlights = headless_browser.find_by_xpath(
            EDITOR_SELECTION_HIGHLIGHT_QUERY, many=True
        )
        assert len(editor_selection_highlights) == expected_number
        return editor_selection_highlights

    lines = TEST_TEXT.split("\n")
    start_space_count = 0
    for line in lines:
        start_space_count += get_start_space_count(line)

    type_letters(demo_root, TEST_TEXT)
    headless_browser.wait().until(line_condition(headless_browser, TEST_TEXT_LENGTH))
    send()

    # Highlight the spaces in the last line
    highlights = send(keys.CONTROL, keys.SHIFT, keys.ARROW_LEFT, expected_number=2)
    check_highlight(highlights[1], 0, TEST_TEXT_LENGTH - 1, start_space_count)
    check_cursor(0, TEST_TEXT_LENGTH - 1)

    line = " " * start_space_count + lines[-2]
    line_length = len(line)
    line_index = TEST_TEXT_LENGTH - 2
    line_trailing_space_count = get_start_space_count(line[::-1])

    # Highlight the last line and the end of the previous line
    highlights = send(keys.CONTROL, keys.SHIFT, keys.ARROW_LEFT, expected_number=3)
    check_highlight(
        highlights[1],
        line_length,
        line_index,
        line_trailing_space_count + 0.5,
    )
    check_highlight(highlights[2], 0, line_index + 1, start_space_count)
    check_cursor(line_length, line_index)

    last_word_length = get_nth_word_length(line, -1)

    # Highlight the last word and the last line
    highlights = send(keys.CONTROL, keys.SHIFT, keys.ARROW_LEFT, expected_number=3)
    check_highlight(
        highlights[1],
        line_length - last_word_length,
        line_index,
        last_word_length + line_trailing_space_count + 0.5,
    )
    check_cursor(line_length - last_word_length, line_index)

    line_slice = line.rstrip()[:-last_word_length]
    line_slice_length = len(line_slice)
    second_last_word_length = get_nth_word_length(line, -2)
    line_slice_trailing_space_count = get_start_space_count(line_slice[::-1])

    # Highlight the second to last word and the trailing spaces
    send(keys.ARROW_LEFT)
    highlights = send(keys.CONTROL, keys.SHIFT, keys.ARROW_LEFT, expected_number=2)
    highlight_length = second_last_word_length + line_slice_trailing_space_count
    check_highlight(
        highlights[1],
        line_slice_length - highlight_length,
        line_index,
        highlight_length,
    )
    check_cursor(line_slice_length - highlight_length, line_index)

    # Highlight the second to last word
    send(keys.ARROW_LEFT)
    highlights = send(keys.CONTROL, keys.SHIFT, keys.ARROW_RIGHT, expected_number=2)
    check_highlight(
        highlights[1],
        line_slice_length - line_slice_trailing_space_count - second_last_word_length,
        line_index,
        second_last_word_length,
    )
    check_cursor(line_slice_length - line_slice_trailing_space_count, line_index)

    # Highlight the last word and the leading spaces
    send(keys.ARROW_RIGHT)
    highlights = send(keys.CONTROL, keys.SHIFT, keys.ARROW_RIGHT, expected_number=2)
    check_highlight(
        highlights[1],
        line_slice_length - line_slice_trailing_space_count,
        line_index,
        last_word_length + line_slice_trailing_space_count,
    )
    check_cursor(line_length - line_trailing_space_count, line_index)

    slice_amount = 2

    # Highlight first part of the last word
    send(keys.ARROW_RIGHT)
    send(keys.ARROW_LEFT, times=slice_amount)
    highlights = send(keys.CONTROL, keys.SHIFT, keys.ARROW_LEFT, expected_number=2)
    check_highlight(
        highlights[1], line_slice_length, line_index, last_word_length - slice_amount
    )
    check_cursor(line_slice_length, line_index)

    # Highlight second part of the last word
    send(keys.ARROW_RIGHT)
    highlights = send(keys.CONTROL, keys.SHIFT, keys.ARROW_RIGHT, expected_number=2)
    check_highlight(
        highlights[1],
        line_slice_length + (last_word_length - slice_amount),
        line_index,
        slice_amount,
    )
    check_cursor(line_length - line_trailing_space_count, line_index)


def test_triple_click(headless_browser):
    def triple_click(element, delay=0.1):
        headless_browser.action.move_to_element(element).click().perform()
        time.sleep(delay)
        headless_browser.action.move_to_element(element).click().perform()
        time.sleep(delay)
        headless_browser.action.move_to_element(element).click().perform()

    demo_root = headless_browser.get_demo_root_for(EditorWithTripleClick)
    assert demo_root
    assert demo_root.get_attribute("data-cell-type") == "Editor"
    editor_lines = headless_browser.find_by_xpath(EDITOR_LINE_QUERY, many=True)
    assert len(editor_lines) == 1
    editor_selection_highlights = headless_browser.find_by_xpath(
        EDITOR_SELECTION_HIGHLIGHT_QUERY, many=True
    )
    assert len(editor_selection_highlights) == 1

    type_letters(demo_root, TEST_TEXT)
    text_length = len(TEST_TEXT.split("\n"))

    headless_browser.wait().until(line_condition(headless_browser, text_length))
    editor_lines = headless_browser.find_by_xpath(EDITOR_LINE_QUERY, many=True)
    lines = [editor_line.text for editor_line in editor_lines]
    assert len(lines) == text_length

    line_index = 4
    triple_click(editor_lines[line_index])
    text_length += 1
    lines.append(str(text_length) + lines[line_index].replace("\n", "")[1:])

    headless_browser.wait().until(line_condition(headless_browser, text_length))
    editor_lines = headless_browser.find_by_xpath(EDITOR_LINE_QUERY, many=True)
    assert len(editor_lines) == len(lines)

    for i, editor_line in enumerate(editor_lines):
        assert editor_line.text == lines[i]

    editor_selection_highlights = headless_browser.find_by_xpath(
        EDITOR_SELECTION_HIGHLIGHT_QUERY, many=True
    )
    assert len(editor_selection_highlights) == 3
    x, y, width = highlight_location(editor_selection_highlights[1])
    assert x == 0
    assert y == line_index
    assert width == len(lines[line_index]) - 2.5


def test_highlights(headless_browser):
    keys = headless_browser.keys
    demo_root = headless_browser.get_demo_root_for(BaseEditor)
    assert demo_root
    assert demo_root.get_attribute("data-cell-type") == "Editor"

    type_letters(demo_root, TEST_TEXT)
    headless_browser.wait().until(line_condition(headless_browser, TEST_TEXT_LENGTH))

    start_text = ""
    lines = []
    for line in TEST_TEXT.split("\n"):
        lines.append(start_text + line)
        start_text += " " * get_start_space_count(line)

    line_index = 2
    word_index = 2

    send_keys(demo_root, keys.CONTROL, keys.HOME)
    send_keys(demo_root, keys.ARROW_DOWN, times=line_index)
    send_keys(demo_root, keys.CONTROL, keys.ARROW_RIGHT, times=word_index + 1)
    send_keys(demo_root, keys.CONTROL, keys.SHIFT, keys.ARROW_LEFT)

    result = re.findall(r"\w+", lines[line_index])
    word = result[word_index]

    indices = []
    for i, line in enumerate(lines):
        added_gutter = False

        for j in range(len(line)):
            if line[j:].startswith(word):
                if not added_gutter:
                    indices.append((i, -10))
                    added_gutter = True

                indices.append((i, j))

    headless_browser.wait().until(
        condition(headless_browser, len(indices), EDITOR_SELECTION_HIGHLIGHT_BASIC_QUERY)
    )
    editor_selection_highlight_basics = headless_browser.find_by_xpath(
        EDITOR_SELECTION_HIGHLIGHT_BASIC_QUERY, many=True
    )
    assert len(editor_selection_highlight_basics) == len(indices)

    for k, indice in enumerate(indices):
        x, y, width = highlight_location(editor_selection_highlight_basics[k])
        assert x == indice[1]
        assert y == indice[0]
        if x < 0:
            assert width == 9
        else:
            assert width == len(word)
