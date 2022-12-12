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
from object_database.web.cells.leaves import Traceback
from object_database.web.cells.children import Children
from object_database.web.cells.util import SubscribeAndRetry
from object_database.web.cells.subscribed import Subscribed, augmentToBeUnique


import traceback


class Grid(Cell):
    # TODO: Do the individual data cells (in grid terms) need to be actual Cell objects?
    # Is there a way to let the Components on the front end handle the updating of the
    # data that gets presented, without having to wrap each datum in a Cell object?
    def __init__(self, colFun, rowFun, headerFun, rowLabelFun, rendererFun):
        super().__init__()
        self.colFun = colFun
        self.rowFun = rowFun
        self.headerFun = headerFun
        self.rowLabelFun = rowLabelFun
        self.rendererFun = rendererFun

        self.existingItems = {}
        self.rows = []
        self.cols = []

    def uninstall(self):
        super().uninstall()
        self.existingItems = {}
        self.rows = []
        self.cols = []

    def recalculate(self):
        oldRows = self.rows
        oldCols = self.cols

        try:
            self.rows = augmentToBeUnique(self.rowFun())
            self.cols = augmentToBeUnique(self.colFun())
        except Exception:
            self.rows = oldRows
            self.cols = oldCols
            raise

        new_named_children = {"headers": [], "rowLabels": [], "dataCells": []}
        seen = set()

        if self.headerFun is not None:
            for col_ix, col in enumerate(self.cols):
                seen.add((None, col))
                if (None, col) in self.existingItems:
                    new_named_children["headers"].append(self.existingItems[(None, col)])
                else:
                    try:
                        headerCell = Subscribed.bind(self.headerFun, col[0])
                        self.existingItems[(None, col)] = headerCell
                        new_named_children["headers"].append(headerCell)
                    except SubscribeAndRetry:
                        raise
                    except Exception:
                        tracebackCell = Traceback(traceback.format_exc())
                        self.existingItems[(None, col)] = tracebackCell
                        new_named_children["headers"].append(tracebackCell)

        if self.rowLabelFun is not None:
            for row_ix, row in enumerate(self.rows):
                seen.add((None, row))
                if (row, None) in self.existingItems:
                    rowLabelCell = self.existingItems[(row, None)]
                    new_named_children["rowLabels"].append(rowLabelCell)
                else:
                    try:
                        rowLabelCell = Subscribed.bind(self.rowLabelFun, row[0])
                        self.existingItems[(row, None)] = rowLabelCell
                        new_named_children["rowLabels"].append(rowLabelCell)
                    except SubscribeAndRetry:
                        raise
                    except Exception:
                        tracebackCell = Traceback(traceback.format_exc())
                        self.existingItems[(row, None)] = tracebackCell
                        new_named_children["rowLabels"].append(tracebackCell)

        seen = set()
        for row_ix, row in enumerate(self.rows):
            new_named_children_column = []
            new_named_children["dataCells"].append(new_named_children_column)
            for col_ix, col in enumerate(self.cols):
                seen.add((row, col))
                if (row, col) in self.existingItems:
                    new_named_children_column.append(self.existingItems[(row, col)])
                else:
                    try:
                        dataCell = Subscribed.bind(self.rendererFun, row[0], col[0])
                        self.existingItems[(row, col)] = dataCell
                        new_named_children_column.append(dataCell)
                    except SubscribeAndRetry:
                        raise
                    except Exception:
                        tracebackCell = Traceback(traceback.format_exc())
                        self.existingItems[(row, col)] = tracebackCell
                        new_named_children_column.append(tracebackCell)

        self.children = Children()
        self.children.addFromDict(new_named_children)

        for i in list(self.existingItems):
            if i not in seen:
                del self.existingItems[i]

        self.exportData["rowNum"] = len(self.rows)
        self.exportData["colNum"] = len(self.cols)
        self.exportData["hasTopHeader"] = self.rowLabelFun is not None
