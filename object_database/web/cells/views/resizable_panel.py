"""ResizablePanel Cell

This Cell takes two child Cells as arguments and will
display them in a split view that has an adjustable
bar along the provided split axis
"""
from ..cells import Cell


class ResizablePanel(Cell):
    def __init__(self, first, second, split="vertical", ratio=0.5):
        """
        Parameters
        ----------
        first (Cell) - The first child Cell to display,
                left or top depending on axis
        second (Cell) - The second child Cell to
                display, right or bottom dep. on axis
        split - Along which axis to split the view.
                defaults to vertical
        ratio - The ratio for the *first* child item.
                Note that the ratio for the second item
                will be calc(1 - ratio)
        """
        super().__init__()
        self.first = first
        self.second = second
        self.split = split
        self.ratio = ratio
        self.exportData["split"] = split
        self.updateNamedChildren()

    def recalculate(self):
        self.updateNamedChildren()
        self.exportData["split"] = self.split
        self.exportData["ratio"] = self.ratio

    def updateNamedChildren(self):
        self.children.addFromDict(
            {"first": Cell.makeCell(self.first), "second": Cell.makeCell(self.second)}
        )
