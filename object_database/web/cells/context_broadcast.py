#   Copyright 2017-2022 object_database Authors
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
from object_database.web.cells.slot import Slot


class ContextReflector(Cell):
    """Allows cells below it to reflect state up higher into the tree.

    Usage:
        Clients can write something like this:

            def A():
                return cell.ContextBroadcast(SomeKey, someValue)

            def B():
                return "FOUND: " + str(context(SomeKey))

            cell.ContextReflector(SomeKey, Subscribed(A) + Subscribed(B))

        which allows 'A' to broadcast a value up the tree and over to 'B'
    """

    def __init__(self, key, content=None):
        super().__init__()
        self.key = key
        self.content = Cell.makeCell(content) if content is not None else None
        self.storage = Slot(())
        self.subcellDict = {}

    def cellJavascriptClassName(self):
        return "PassthroughCell"

    def _addChild(self, child):
        self.subcellDict[child] = child.value
        self.storage.set(tuple(self.subcellDict.values()))

    def _removeChild(self, child):
        self.subcellDict.pop(child)
        self.storage.set(tuple(self.subcellDict.values()))

    def recalculate(self):
        self.children["content"] = self.content

    def sortsAs(self):
        if isinstance(self.content, Cell):
            return self.content.sortsAs()
        else:
            return self.content

    def __mul__(self, other):
        if self.content is None:
            return ContextReflector(other, key=self.key)
        else:
            return ContextReflector(self.content * other, key=self.key)

    def getContext(self, key):
        if key == self.key:
            return self.storage.get()

        return self.parent.getContext(key)


class ContextBroadcast(Cell):
    def __init__(self, key, value):
        super().__init__()
        self.key = key
        self.value = value
        self.isCalculated = False
        self.installedParent = None

    def cellJavascriptClassName(self):
        return "PassthroughCell"

    def recalculate(self):
        if not self.isCalculated:
            p = self.parent
            while p:
                if isinstance(p, ContextReflector) and p.key == self.key:
                    self.installedParent = p
                    self.cells.scheduleCallback(lambda: p._addChild(self))
                    return
                p = p.parent

            self.isCalculated = True

    def onRemovedFromTree(self):
        if self.installedParent:
            self.cells._executeCallback(lambda: self.installedParent._removeChild(self))
