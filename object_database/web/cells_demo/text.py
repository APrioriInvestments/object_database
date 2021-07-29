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


class BasicText(CellsTestPage):
    def cell(self):
        return cells.Text("This is some text")

    def text(self):
        return "You should see some text."


class EmbeddedColoredText(CellsTestPage):
    def cell(self):
        return cells.Card(cells.Text("This is some text", text_color="blue"), padding=0)

    def text(self):
        return "You should see some colored text in a Card."


class TextUpdates(CellsTestPage):
    def cell(self):
        counter = cells.Slot(0)

        return cells.Subscribed(lambda: cells.Text(f"Count: {counter.get()}")) + cells.Button(
            "Update", lambda: counter.set(counter.get() + 1)
        )

    def text(self):
        return (
            "You should see some text and a button that says Update "
            "that increments the counter"
        )


def test_text_rendering(headless_browser):
    headless_browser.load_demo_page(BasicText)

    query = '[data-cell-type="Text"]'

    elements = headless_browser.find_by_css(query, many=True)
    assert len(elements) == 1

    assert elements[0].text == "This is some text"


def test_text_replaceable(headless_browser):
    headless_browser.load_demo_page(TextUpdates)

    query = '[data-cell-type="Text"]'

    elements = headless_browser.find_by_css(query, many=True)

    # should see 'Update' and 'Count: 0'
    assert sorted([e.text for e in elements]) == ["Count: 0", "Update"]

    buttons_query = '[data-tag="demo_root"] > [data-cell-type="Button"]'
    buttons = headless_browser.find_by_css(buttons_query, many=True)

    assert len(buttons) == 1

    buttons[0].click()

    def textIsUpdated(*args):
        elements = headless_browser.find_by_css(query, many=True)

        return sorted([e.text for e in elements]) == ["Count: 1", "Update"]

    headless_browser.wait(2).until(textIsUpdated)

    assert textIsUpdated()
