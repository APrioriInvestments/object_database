from object_database.web import cells as cells
from object_database.web.CellsTestPage import CellsTestPage


class SingleLineTextBox(CellsTestPage):
    def cell(self):
        slot = cells.Slot("initial text")
        return cells.SingleLineTextBox(slot) + cells.Subscribed(
            lambda: cells.Card(slot.get(), header="Slot Contents")
        )

    def text(self):
        return "A box in which you can edit text."


def test_single_line_text_box(headless_browser):
    headless_browser.load_demo_page(SingleLineTextBox)
    root_selector = "{}".format(headless_browser.demo_root_selector)

    card_header = "Slot Contents\n"
    slot_text = "initial text"

    # Check the initial text of the Card
    card_query = root_selector + ' > [data-cell-type="Card"]'
    card = headless_browser.find_by_css(card_query)
    assert card.text == card_header + slot_text

    # Check the initial text of the SingleLineTextBox
    tb_query = root_selector + ' > [data-cell-type="SingleLineTextBox"]'
    text_box = headless_browser.find_by_css(tb_query)
    assert text_box.get_attribute("value") == slot_text

    # Update the text in the text box and check its new value
    text_box.send_keys(len(slot_text) * "\b" + "final text")
    slot_text = "final text"
    assert text_box.get_attribute("value") == slot_text

    # Click on the card to update the shared slot and the Card itself
    # and check the text was correctly updated
    card.click()
    headless_browser.wait(2).until(
        headless_browser.expect.text_to_be_present_in_element(
            (headless_browser.by.CSS_SELECTOR, card_query), card_header + slot_text
        )
    )
