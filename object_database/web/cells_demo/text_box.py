from object_database.web import cells as cells
from object_database.web.CellsTestPage import CellsTestPage
from object_database.web.cells.cells_context import CellsContext


class SingleLineTextBox(CellsTestPage):
    def cell(self):
        committedText = cells.Slot("<nothing committed yet>")

        def onEsc():
            box.currentText.set(committedText.get())

        def onEnter(text):
            committedText.set(text)

        box = cells.SingleLineTextBox(
            "some small monospaced text",
            onEsc=onEsc,
            onEnter=onEnter,
            font='"Ubuntu Mono"',
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
            focusedCell = CellsContext.get().focusedCell

            if focusedCell.get() is None:
                return "Nothing Focused"

            if isinstance(focusedCell.get(), cells.SingleLineTextBox):
                return "SingleLineTextBox holding " + focusedCell.get().currentText.get()

            if isinstance(focusedCell.get(), cells.Editor):
                return "Editor"

        box1Showing = cells.Slot(True)
        box2Showing = cells.Slot(True)
        box3Showing = cells.Slot(True)

        def boxAndButtons(box, showing):
            return (
                cells.Subscribed(lambda: box if showing.get() else None)
                >> cells.Button("focus", lambda: box.focus())
                >> cells.Button("selectAll", lambda: box.selectAll())
                >> cells.Button("showing", lambda: showing.toggle())
            )

        return (
            boxAndButtons(box1, box1Showing)
            + boxAndButtons(box2, box2Showing)
            + boxAndButtons(box3, box3Showing)
            + cells.Subscribed(currentlyShowing)
        )

    def text(self):
        return "A box in which you can edit text."
