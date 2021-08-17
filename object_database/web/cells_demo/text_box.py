from object_database.web import cells as cells
from object_database.web.CellsTestPage import CellsTestPage
from object_database.web.cells.computing_cell_context import ComputingCellContext


class SingleLineTextBox(CellsTestPage):
    def cell(self):
        committedText = cells.Slot("<nothing committed yet>")

        def onEsc():
            box.currentText.set(committedText.get())

        def onEnter():
            committedText.set(box.currentText.get())

        box = cells.SingleLineTextBox(
            "some small monospaced text",
            onEsc=onEsc,
            onEnter=onEnter,
            pattern="[a-z]*",
            font='Monaco,Menlo,"Ubuntu Mono",Consolas,source-code-pro,monospace',
            textSize=28,
        )

        return box + cells.Subscribed(
            lambda: cells.Card(lambda: box.currentText.get(), header="Text Contents")
            >> cells.Card(lambda: committedText.get(), header="Committed Contents")
        )

    def text(self):
        return "A box in which you can edit text."


class MultifocusTextBox(CellsTestPage):
    def cell(self):
        box1 = cells.SingleLineTextBox("box1", textSize=28)
        box2 = cells.SingleLineTextBox("box2", textSize=28)
        box3 = cells.SingleLineTextBox("box3", textSize=28)

        def currentlyShowing():
            focusedCell = ComputingCellContext.get().cells.focusedCell

            if focusedCell.get() is None:
                return "Nothing Focused"

            if isinstance(focusedCell.get(), cells.SingleLineTextBox):
                return "SingleLineTextBox holding " + focusedCell.get().currentText.get()

            if isinstance(focusedCell.get(), cells.CodeEditor):
                return "CodeEditor"

        box1Showing = cells.Slot(True)
        box2Showing = cells.Slot(True)
        box3Showing = cells.Slot(True)

        def boxAndButtons(box, showing):
            return (
                cells.Subscribed(lambda: box if showing.get() else None)
                >> cells.Button("focus", lambda: box.focus())
                >> cells.Button("showing", lambda: showing.toggle())
            )

        return (
            boxAndButtons(box1, box1Showing)
            + boxAndButtons(box2, box2Showing)
            + boxAndButtons(box3, box3Showing)
            + currentlyShowing
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
