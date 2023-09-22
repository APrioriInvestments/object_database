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

from selenium.webdriver import ActionChains
from selenium.webdriver.common.keys import Keys


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
    demo_root = headless_browser.get_demo_root_for(ClickableText)
    query = "{} > *".format(headless_browser.demo_root_selector)
    subscribed = headless_browser.find_by_css(query)
    assert subscribed.text == "You've clicked on this text 0 times"
    demo_root.click()
    headless_browser.wait(2).until(
        headless_browser.expect.text_to_be_present_in_element(
            (headless_browser.by.CSS_SELECTOR, query),
            "You've clicked on this text 1 times",
        )
    )


class LinkText(CellsTestPage):
    def cell(self):
        return cells.Clickable(
            "www.google.com", lambda: "https://www.google.com", aTarget="_blank"
        )

    def text(self):
        return "You should see some link-text that opens in a new tab or window."


def test_linktext_displays(headless_browser):
    demo_root = headless_browser.get_demo_root_for(LinkText)
    assert demo_root
    assert demo_root.get_attribute("data-cell-type") == "Clickable"
    query = "{} > *".format(headless_browser.demo_root_selector)
    link = headless_browser.find_by_css(query)
    assert link.text == "www.google.com"
    assert len(headless_browser.window_handles) == 1

    link.click()
    headless_browser.wait(10).until(headless_browser.expect.number_of_windows_to_be(2))
    assert len(headless_browser.window_handles) == 2
    headless_browser.switch_to_window(headless_browser.window_handles[1])
    assert headless_browser.current_url == "https://www.google.com/"


class ClickableOverFlex(CellsTestPage):
    def cell(self):
        slot = cells.Slot(0)

        return cells.Clickable(
            cells.Highlighted(
                cells.Flex(
                    cells.Subscribed(lambda: f"You've clicked on this text {slot.get()} times")
                )
            ),
            lambda: slot.set(slot.get() + 1),
        )

    def text(self):
        return "You should see a clickable with highlighted text under it."


class LinkTextCtrlClick(CellsTestPage):
    def cell(self):
        slot = cells.Slot(0)
        return cells.Clickable(
            "www.google.com", lambda: "https://www.google.com"
        ) + cells.Button(
            cells.Subscribed(lambda: f"Clicked {slot.get()} times"),
            lambda: slot.set(slot.get() + 1),
        )

    def text(self):
        return (
            "You should see some link-text that opens in the same tab. Clicking "
            + "while holding the CTRL key will open the link in a new tab. "
            + "Control-clicking the button will work as normal."
        )


def test_click_opens_in_new_tab(headless_browser):
    # Close all other windows
    for window in headless_browser.window_handles[1:]:
        headless_browser.switch_to_window(window)
        headless_browser.close()
    headless_browser.switch_to_window(headless_browser.window_handles[0])
    assert len(headless_browser.window_handles) == 1

    # clicking opens in the same tab
    demo_root = headless_browser.get_demo_root_for(LinkTextCtrlClick)
    assert demo_root
    assert demo_root.get_attribute("data-cell-type") == "Sequence"
    query = "[data-cell-type='Clickable']"
    link = headless_browser.find_by_css(query)
    assert link.text == "www.google.com"
    assert len(headless_browser.window_handles) == 1
    link.click()
    headless_browser.wait(10).until(headless_browser.expect.number_of_windows_to_be(1))
    assert len(headless_browser.window_handles) == 1
    assert headless_browser.current_url == "https://www.google.com/"

    # ctrl clicking opens in a new tab
    demo_root = headless_browser.get_demo_root_for(LinkTextCtrlClick)
    assert demo_root
    assert demo_root.get_attribute("data-cell-type") == "Sequence"
    query = "[data-cell-type='Clickable']"
    link = headless_browser.find_by_css(query)
    assert link.text == "www.google.com"
    action = ActionChains(headless_browser.webdriver)
    action.key_down(Keys.CONTROL).click(link).key_up(Keys.CONTROL).perform()
    headless_browser.wait(10).until(headless_browser.expect.number_of_windows_to_be(2))
    assert len(headless_browser.window_handles) == 2
    headless_browser.switch_to_window(headless_browser.window_handles[1])
    assert headless_browser.current_url == "https://www.google.com/"

    # cleanup
    for window in headless_browser.window_handles[1:]:
        headless_browser.switch_to_window(window)
        headless_browser.close()
    headless_browser.switch_to_window(headless_browser.window_handles[0])
    assert len(headless_browser.window_handles) == 1


def test_control_click_doesnt_affect_buttons(headless_browser):
    """control-clicking bumps the slot, but doesn't open new tabs."""
    query = "[data-cell-type='Button']"

    button = headless_browser.find_by_css(query)
    assert button.text == "Clicked 0 times"

    # ctrl+click
    action = ActionChains(headless_browser.webdriver)
    action.key_down(Keys.CONTROL).click(button).key_up(Keys.CONTROL).perform()

    headless_browser.wait(2).until(
        headless_browser.expect.text_to_be_present_in_element(
            (headless_browser.by.CSS_SELECTOR, query), "Clicked 1 times"
        )
    )

    # no new tab generated
    assert len(headless_browser.window_handles) == 1
