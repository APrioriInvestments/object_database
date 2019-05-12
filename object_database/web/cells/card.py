from object_database.web.cells.cells import Cell
from object_database.web.html.html_gen import HTMLElement, HTMLTextContent

class Card(Cell):
    def __init__(self, body, header=None, padding=None):
        super().__init__()

        self.padding = padding
        self.body = body
        self.header = header

    def recalculate(self):
        self.children = {"____contents__": Cell.makeCell(self.body)}

        other = ""
        if self.padding:
            other += " p-" + str(self.padding)

        body = HTMLElement.div().add_class(
            "card-body").add_class(
                other).add_child(
                    HTMLTextContent(" ____contents__"))
        card = HTMLElement.div().add_class("card")

        if self.header is not None:
            header = HTMLElement.div().add_class(
                "card-header").add_child(
                    HTMLTextContent("____header__")
            )
            self.children['____header__'] = Cell.makeCell(self.header)
            card.add_child(header)

        card.add_child(body)
        card.attributes["style"] = self._divStyle()

        self.contents = str(card)

    def sortsAs(self):
        return self.contents.sortsAs()
