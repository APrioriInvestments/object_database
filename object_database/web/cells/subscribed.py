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
from object_database.web.cells.cells import SubscribeAndRetry
from object_database.web.cells.leaves import Traceback

import traceback
import logging


def augmentToBeUnique(listOfItems):
    """ Given a list that may include duplicates, return a list of unique items

    Returns a list of [(x,index)] for each 'x' in listOfItems,
    where index is the number of times we've seen 'x' before.
    """
    counts = {}
    output = []
    for x in listOfItems:
        counts[x] = counts.setdefault(x, 0) + 1
        output.append((x, counts[x] - 1))

    return output


class Subscribed(Cell):
    def __init__(self, cellFactory, childIdentity=0, onRemoved=None):
        super().__init__()

        # a function of no arguments that proces a cell.
        # we call it and watch which view values it reads to know
        # when to recalculate the element.
        self.cellFactory = cellFactory
        self.childIdentity = childIdentity
        self.onRemovedCallback = onRemoved

    def onRemovedFromTree(self):
        if self.onRemovedCallback is not None:
            try:
                self.onRemovedCallback()
            except Exception:
                logging.exception("Subscribed onRemoved callback failed.")

    def identityOfChild(self, child):
        return self.childIdentity

    def prepareForReuse(self):
        if not self.garbageCollected:
            return False
        self._clearSubscriptions()
        return super().prepareForReuse()

    def __repr__(self):
        return f"Subscribed(id={self._identity}, factory={self.cellFactory})"

    def applyCellDecorator(self, decorator):
        """Return a new cell which applies the function 'decorator' to 'self'.

        By default we just call the function. But some subclasses may want to apply
        the decorator to child cells instead.
        """
        cellFactory = self.cellFactory

        # produce a new cellFactory that applies the decorator to the interior.
        newCellFactory = lambda: Cell.makeCell(cellFactory()).applyCellDecorator(decorator)

        return Subscribed(newCellFactory)

    def sortsAs(self):
        for c in self.children.allChildren:
            return c.sortsAs()

        return Cell.makeCell(self.cellFactory()).sortsAs()

    def recalculate(self):
        with self.view() as v:
            try:
                newCell = Cell.makeCell(self.cellFactory())

                if newCell.cells is not None:
                    newCell.prepareForReuse()

                self.children["content"] = newCell

            except SubscribeAndRetry:
                raise
            except Exception:
                tracebackCell = Traceback(traceback.format_exc())
                self.children["content"] = tracebackCell
                self._logger.exception("Subscribed inner function threw exception:")

            self._resetSubscriptionsToViewReads(v)


class SubscribedSequence(Cell):
    """SubscribedSequence Cell

    This Cell acts like a Sequence, but each of its elements
    will be wrapped in a `Subscribed`. See constructor
    comments for more information.

    Properties
    ----------
    itemsFun: func
        A function that will be called each cycle
        that returns a list of Tuples, each containing
        an object we would like to have as a subscribed
        sequence element.
    rendererFun: func
        A function that takes a single item from the
        itemsFun results, turns its object into a Cell,
        and wraps that in a `Subscribed`.
    items: list
        A stored version that is the current result
        of calling itemsFun
    existingItems: dict
        A dictionary that maps items as keys to
        any composed Cells of that item that have
        already been made. This way we don't have
        to re-create Cells every cycle.
    orientation: str
        The axis along which this SubscribedSequence
        should lay itself out.
    """

    def __init__(self, itemsFun, rendererFun, orientation="vertical"):
        """
        Parameters
        ----------
        itemsFun: func
            A function that will return a list
            of Tuples that contain the objects
            to be transformed into element Cells.
        rendererFun: func
            A function that will take an item as
            retrieved from `itemsFunc`, turn it into
            a Cell object, and wrap that in a `Subscribed`.
        orientation: str
            Tells the Cell which direction it should have as
            a sequence. Can be 'vertical' or 'horizontal'.
            Defaults to 'vertical'
        """
        super().__init__()

        self.itemsFun = itemsFun
        self.rendererFun = rendererFun
        self.existingItems = {}
        self.items = []

        assert orientation in ("horizontal", "vertical")

        self.orientation = orientation
        self._mergedIntoParent = False

    def cellJavascriptClassName(self):
        return "Sequence"

    def makeCell(self, item):
        """Makes a Cell instance from an object.
        Note that we also wrap this in a
        `Subscribed` instance.

        Parameters
        ----------
        item: object
            An item that will be turned into a Cell

        Returns
        -------
        A Cell instance
        """
        return Cell.makeCell(self.rendererFun(item))

    def recalculate(self):
        with self.view() as v:
            self._getItems()
            self._resetSubscriptionsToViewReads(v)
            self._updateExistingItems()
            self._updateChildren()

            self.exportData["orientation"] = self.orientation

    def _updateChildren(self):
        """Updates the stored children and namedChildren

        Notes
        -----
        First we check to ensure that any new item
        hasn't already been made into a Cell via
        the existingItems cache.
        Otherwise we use makeCell to create a new
        instance.
        """
        new_children = []
        current_child = None
        for item in self.items:
            if item in self.existingItems:
                current_child = self.existingItems[item]
            else:
                try:
                    # the items in 'existingItems' are pairs of (key, timesKeySeen)
                    # which we created using 'augmentToBeUnique', so that we have a separate
                    # unique key for each cell we create (since the 'itemsFun' might produce
                    # duplicate values.)
                    current_child = self.makeCell(item[0])
                    self.existingItems[item] = current_child
                except SubscribeAndRetry:
                    raise
                except Exception:
                    current_child = Traceback(traceback.format_exc())

            new_children.append(current_child)

        self.children["elements"] = new_children

    def sortAs(self):
        if len(self.children["elements"]):
            return self.children["elements"][0].sortAs()

    def _getItems(self):
        """Retrieves the items using itemsFunc
        and updates this object's internal items
        list"""
        try:
            self.items = augmentToBeUnique(self.itemsFun())
        except SubscribeAndRetry:
            raise
        except Exception:
            self._logger.exception("SubscribedSequence itemsFun threw exception:")
            self.items = []

    def _updateExistingItems(self):
        """Updates the dict storing cached
        Cells that were already created.
        Note that we might need to remove
        some entries that no longer apply"""
        itemSet = set(self.items)
        for item in list(self.existingItems):
            if item not in itemSet:
                del self.existingItems[item]


def HorizontalSubscribedSequence(itemsFun, rendererFun):
    return SubscribedSequence(itemsFun, rendererFun, orientation="horizontal")


HSubscribedSequence = HorizontalSubscribedSequence


def VSubscribedSequence(itemsFun, rendererFun):
    return SubscribedSequence(itemsFun, rendererFun)
