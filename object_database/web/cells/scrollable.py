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
from object_database.web.cells.container import Container


class Scrollable(Container):
    def __init__(self, child=None, vertical=True, horizontal=True, visible=True):
        super().__init__(child)
        self.exportData["vertical"] = vertical
        self.exportData["horizontal"] = horizontal
        self.exportData["visible"] = visible

    def scrollChildIntoView(self, child, valign="nearest", halign="nearest"):
        assert valign in ("start", "center", "end", "nearest")
        assert halign in ("start", "center", "end", "nearest")

        self.scheduleMessage(
            lambda: {
                "event": "scrollChildIntoView",
                "id": child.identity,
                "valign": valign,
                "halign": halign,
            }
        )


class VisibleInParentScrollOnFirstDisplay(Cell):
    def __init__(self, content=None, valign="nearest", halign="nearest"):
        super().__init__()
        self.content = Cell.makeCell(content) if content is not None else None
        self.isCalculated = False
        self.halign = halign
        self.valign = valign

    def cellJavascriptClassName(self):
        return "PassthroughCell"

    def recalculate(self):
        self.children["content"] = self.content if self.content else Cell.makeCell("")

        if not self.isCalculated:
            self.isCalculated = True
            p = self.parent
            while p is not None:
                if isinstance(p, Scrollable):
                    p.scrollChildIntoView(self, self.valign, self.halign)
                    return

                p = p.parent

    def sortsAs(self):
        if isinstance(self.content, Cell):
            return self.content.sortsAs()
        else:
            return self.content

    def __mul__(self, other):
        if self.content is None:
            return VisibleInParentScrollOnFirstDisplay(
                other, valign=self.valign, halign=self.halign
            )
        else:
            return VisibleInParentScrollOnFirstDisplay(
                self.content * other, valign=self.valign, halign=self.halign
            )


def VScrollable(child, visible=True):
    return Scrollable(child, vertical=True, horizontal=False, visible=visible)


def HScrollable(child, visible=True):
    return Scrollable(child, vertical=False, horizontal=True, visible=visible)
