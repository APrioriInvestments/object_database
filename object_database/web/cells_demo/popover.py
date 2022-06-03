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
import threading


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
    query = '[data-cell-type="Popover"]'
    toggler = headless_browser.find_by_css(query)
    assert toggler


def test_popover_show_on_click(headless_browser):
    # Test that the popover content
    # shows on click
    headless_browser.load_demo_page(SimplePopover)

    button = headless_browser.find_by_css('[data-cell-type="Popover"]')

    assert button
    content_location = (headless_browser.by.CSS_SELECTOR, ".cell-open-popover")
    button.click()
    headless_browser.wait(1).until(
        headless_browser.expect.visibility_of_element_located(content_location)
    )

    # now if we click the content, it should stay open
    content = headless_browser.find_by_css(".cell-open-popover")
    assert content
    content.click()

    content_location = (headless_browser.by.CSS_SELECTOR, ".cell-open-popover")
    headless_browser.wait(1)
    headless_browser.expect.visibility_of_element_located(content_location)

    # now click the backdrop - it should go away
    backdrop = headless_browser.find_by_css(".cell-dropdown-backdrop")
    backdrop.click()

    content_location = (headless_browser.by.CSS_SELECTOR, ".cell-open-popover")
    headless_browser.wait(1).until(
        headless_browser.expect.invisibility_of_element_located(content_location)
    )


class DelayedRemoval(CellsTestPage):
    def cell(self):
        slot = cells.Slot(True)
        text_slot = cells.Slot("On")
        popover = cells.Popover("Outer", "Title", "Inner")
        sub = cells.Subscribed(lambda: popover if slot.get() else cells.Text("empty"))
        text_sub = cells.Subscribed(lambda: cells.Text(text_slot.get()))

        curCells = cells.CellsContext.get()
        import time

        def worker():
            time.sleep(2)
            curCells.scheduleCallback(lambda: slot.set(False))

        def toggle():
            if slot.get():
                event = threading.Event()
                thread = threading.Thread(target=worker, args=(event,))
                thread.start()
                text_slot.set("Off")
            else:
                slot.set(True)
                text_slot.set("On")

        button = cells.Button("Click", toggle)

        return cells.Card((button + text_sub) >> sub)

    def text(self):
        return "The button will make the popover vanish after 2 seconds"


def test_dynamic_popover_exists(headless_browser):
    headless_browser.load_demo_page(DelayedRemoval)
    query = '[data-cell-type="Popover"]'
    toggler = headless_browser.find_by_css(query)
    assert toggler


def test_dynamic_click_and_delay(headless_browser):
    headless_browser.load_demo_page(DelayedRemoval)

    # Find both the popover anchor and the button
    popover_link = headless_browser.find_by_css('[data-cell-type="Popover"]')
    assert popover_link
    button = headless_browser.find_by_css('[data-cell-type="Button"]')
    assert button

    # Now ensure that after the timer (3 seconds)
    # the popover content is not showing in the DOM
    pop_content_location = (headless_browser.by.CSS_SELECTOR, '[role="tooltip"].popover')
    button.click()
    popover_link.click()
    headless_browser.wait(6).until(
        headless_browser.expect.invisibility_of_element_located(pop_content_location)
    )


class NinePopovers(CellsTestPage):
    def cell(self):
        return (
            (
                cells.TopLeft(cells.Popover("summary", "title", "detailed content"))
                >> cells.TopCenter(cells.Popover("summary", "title", "detailed content"))
                >> cells.TopRight(cells.Popover("summary", "title", "detailed content"))
            )
            + (
                cells.LeftCenter(cells.Popover("summary", "title", "detailed content"))
                >> cells.Center(cells.Popover("summary", "title", "detailed content"))
                >> cells.RightCenter(cells.Popover("summary", "title", "detailed content"))
            )
            + (
                cells.BottomLeft(cells.Popover("summary", "title", "detailed content"))
                >> cells.BottomCenter(cells.Popover("summary", "title", "detailed content"))
                >> cells.BottomRight(cells.Popover("summary", "title", "detailed content"))
            )
        )

    def text(self):
        return "you should see four popovers whose popouts show up in the right place."


class ManyPopovers(CellsTestPage):
    def cell(self):
        return cells.SubscribedSequence(
            lambda: list(range(1000)),
            lambda i: cells.Left(
                cells.Popover(
                    f"popover {i}",
                    f"title {i}",
                    cells.SubscribedSequence(
                        lambda: list(range(1000)), lambda j: cells.Text(j)
                    ),
                )
            ),
        )

    def text(self):
        return "a thousand popovers with a thousand things inside."
