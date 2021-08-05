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


class Panel(Cell):
    """Panel Cell

    This cell acts as a generic, bordered container.
    It has a single child Cell element.

    Properties
    ----------
    content: Cell
        A child cell that will be displayed within
        the bordered Panel area.
    """

    def __init__(self, content, border=True):
        """
        Parameters
        ----------
        content: Cell
            A child cell that will be displyed
            within the bordered Panel area.
            Will be set on instance as `content`
            property.
        border: bool
            If True, produce a border and padding. Otherwise, just use this as a grouping
            element in the display.
        """
        super().__init__()

        self.content = Cell.makeCell(content)
        self.applyBorder = border

    def recalculate(self):
        self.exportData["applyBorder"] = self.applyBorder
        self.children["content"] = Cell.makeCell(self.content)


class CollapsiblePanel(Cell):
    def __init__(self, panel, content, isExpanded):
        super().__init__()
        self.panel = panel
        self.content = content
        self.isExpanded = isExpanded

    def sortsAs(self):
        return self.content.sortsAs()

    def recalculate(self):
        expanded = self.evaluateWithDependencies(self.isExpanded)
        self.exportData["isExpanded"] = expanded
        self.children["content"] = self.content
        if expanded:
            self.children["panel"] = self.panel
