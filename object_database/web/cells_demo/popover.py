#   Copyright 2017-2019 object_database Authors
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


class SimplePopover(CellsTestPage):
    def cell(self):
        return cells.Popover("summary", "title", "detailed content")

    def text(self):
        return (
            "Popover example. The popover should not disappear when you click on it, "
            "for example when you're trying to select detailed text in the Popover "
            "in order to copy it to your clipboard."
        )


def test_popover_toggle_exists(headless_browser):
    headless_browser.load_demo_page(SimplePopover)
    query = '{} [data-toggle="popover"]'.format(headless_browser.demo_root_selector)
    toggler = headless_browser.find_by_css(query)
    assert toggler


def test_popover_show_on_click(headless_browser):
    # Test that the popover content
    # shows on click
    button = headless_browser.find_by_css(
        '{} [data-toggle="popover"]'.format(headless_browser.demo_root_selector)
    )
    assert button
    content_location = (headless_browser.by.CSS_SELECTOR, ".popover")
    button.click()
    headless_browser.wait(1).until(
        headless_browser.expect.visibility_of_element_located(content_location)
    )


def test_popover_not_hide_on_content_click(headless_browser):
    # Test that the popover -- now showing -- does not
    # hide when clicking in the content area
    content = headless_browser.find_by_css(".popover")
    assert content
    content.click()
    content_location = (headless_browser.by.CSS_SELECTOR, ".popover")
    headless_browser.wait(1)
    headless_browser.expect.visibility_of_element_located(content_location)


def test_popover_hides_on_toggle(headless_browser):
    # Test that the popover content hides
    # when the button is clicked
    button = headless_browser.find_by_css(
        '{} [data-toggle="popover"]'.format(headless_browser.demo_root_selector)
    )
    assert button
    button.click()
    content_location = (headless_browser.by.CSS_SELECTOR, ".popover")
    headless_browser.wait(1).until(
        headless_browser.expect.invisibility_of_element_located(content_location)
    )
