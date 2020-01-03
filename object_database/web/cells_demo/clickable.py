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


class ClickableText(CellsTestPage):
    def cell(self):
        slot = cells.Slot(0)

        return cells.Clickable(
            cells.Subscribed(lambda: f"You've clicked on this text {slot.get()} times"),
            lambda: slot.set(slot.get() + 1),
        )

    def text(self):
        return "You should see some text that you can click on to increment a counter."


def test_clickable_displays(headless_browser):
    demo_root = headless_browser.get_demo_root_for(ClickableText)
    assert demo_root
    assert demo_root.get_attribute("data-cell-type") == "Clickable"


def test_clickable_clicking_works(headless_browser):
    demo_root = headless_browser.get_demo_root()
    query = "{} > *".format(headless_browser.demo_root_selector)
    subscribed = headless_browser.find_by_css(query)
    assert subscribed.text == "You've clicked on this text 0 times"
    demo_root.click()
    headless_browser.wait(2).until(
        headless_browser.expect.text_to_be_present_in_element(
            (headless_browser.by.CSS_SELECTOR, query), "You've clicked on this text 1 times"
        )
    )
