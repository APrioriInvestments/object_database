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
