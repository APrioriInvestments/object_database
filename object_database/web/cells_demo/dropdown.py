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
from time import sleep


class BasicAsyncDropdown(CellsTestPage):
    def cell(self):
        return cells.AsyncDropdown("Click Me", lambda: cells.Text("Result"))

    def text(self):
        return "You should see a basic AsyncDropdown with 'Result' as text child"


class DelayedAsyncDropdown(CellsTestPage):
    def cell(self):
        def renderFun():
            sleep(3)
            return cells.Text("Done!")

        return cells.AsyncDropdown("Click And Wait", renderFun)

    def text(self):
        return "You should see an AsyncDropdown whose content appears after 3 sec"


def test_content_area_loads(headless_browser):
    root = headless_browser.get_demo_root_for(DelayedAsyncDropdown)
    assert root
    dd_query = '{} [data-cell-type="AsyncDropdownContent"]'.format(
        headless_browser.demo_root_selector
    )
    dd_content = headless_browser.find_by_css(dd_query)
    assert dd_content
    loader_query = (
        '{} [data-cell-type="AsyncDropdownContent"]'
        ' [data-cell-type="CircleLoader"]'.format(headless_browser.demo_root_selector)
    )
    dd_loader = headless_browser.find_by_css(loader_query)
    assert dd_loader


def test_content_after_click_delay(headless_browser):
    btn_query = "{} button".format(headless_browser.demo_root_selector)
    btn = headless_browser.find_by_css(btn_query)
    assert btn
    btn.click()
    content_query = '{} [data-cell-type="AsyncDropdownContent"]'.format(
        headless_browser.demo_root_selector
    )
    location = (headless_browser.by.CSS_SELECTOR, content_query)
    headless_browser.wait(4).until(
        headless_browser.expect.text_to_be_present_in_element(location, "Done!")
    )
