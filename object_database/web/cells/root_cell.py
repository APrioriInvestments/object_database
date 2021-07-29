from object_database.web.cells.container import Container


class RootCell(Container):
    def __init__(self, child=None):
        super().__init__(child)
        self.isRoot = True

    @property
    def identity(self):
        return "page_root"

    def setChild(self, child):
        self.setContents("", child)
