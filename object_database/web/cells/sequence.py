#   Copyright 2017-2021 object_database Authors
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


from object_database.web.cells.cell import Cell


class Sequence(Cell):
    def __init__(self, elements, margin=None):
        """
        Lays out (children) elements in a vertical sequence.

        Parameters:
        -----------
        elements: list of cells
        margin : int
            Bootstrap style margin size for all children elements.

        """
        super().__init__()
        elements = [Cell.makeCell(x) for x in elements]

        self.elements = elements
        self.children["elements"] = elements
        self.margin = margin
        self.exportData["orientation"] = "vertical"
        self._mergedIntoParent = False

    def cellJavascriptClassName(self):
        return "Sequence"

    def __add__(self, other):
        other = Cell.makeCell(other)
        if isinstance(other, Sequence):
            return Sequence(self.elements + other.elements)
        else:
            return Sequence(self.elements + [other])

    def recalculate(self):
        self.children["elements"] = self.elements
        self.exportData["margin"] = self.margin

    def sortsAs(self):
        if self.elements:
            return self.elements[0].sortsAs()
        return None


class HorizontalSequence(Cell):
    def __init__(self, elements, overflow=True, margin=None, wrap=False):
        """
        Lays out (children) elements in a horizontal sequence.

        Parameters:
        ----------
        elements : list of cells
        overflow : bool
            if True will allow the div to overflow in all dimension, i.e.
            effectively setting `overflow: auto` css. Note: the div must be
            bounded for overflow to take action.
        margin : int
            Bootstrap style margin size for all children elements.
        """
        super().__init__()
        elements = [Cell.makeCell(x) for x in elements]
        self.elements = elements
        self.overflow = overflow
        self.margin = margin
        self.wrap = wrap
        self._mergedIntoParent = False
        self.exportData["orientation"] = "horizontal"

    def cellJavascriptClassName(self):
        return "Sequence"

    def __rshift__(self, other):
        other = Cell.makeCell(other)
        if isinstance(other, HorizontalSequence):
            return HorizontalSequence(self.elements + other.elements)
        else:
            return HorizontalSequence(self.elements + [other])

    def recalculate(self):
        self.exportData["margin"] = self.margin
        self.exportData["wrap"] = self.wrap
        self.children["elements"] = self.elements

    def sortsAs(self):
        if self.elements:
            return self.elements[0].sortsAs()
        return None
