from object_database.web.cells.cells import Cell
from object_database.web.html.html_gen import HTMLElement, HTMLTextContent

class Traceback(Cell):
    def __init__(self, traceback):
        super().__init__()
        self.contents = str(
            HTMLElement.div()
            .add_classes(['alert', 'alert-primary'])
            .add_child(
                HTMLElement.pre()
                .add_child(HTMLTextContent('____child__'))
            )
        )
        self.traceback = traceback
        self.children = {"____child__": Cell.makeCell(traceback)}

    def sortsAs(self):
        return self.traceback


