#   Copyright 2017-2019 object_database Authors
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

import queue
import html
import time
import traceback
import logging
import threading
import numpy

from object_database.web.cells import Messenger
from object_database.web.cells.children import Children
from object_database import MaskView
from object_database.view import RevisionConflictException
from object_database.view import current_transaction
from object_database.util import Timer

MAX_TIMEOUT = 1.0
MAX_TRIES = 10


_cur_computing_cell = threading.local()


class ComputingCellContext:
    def __init__(self, cell, isProcessingMessage=False):
        self.cell = cell
        self.isProcessingMessage = isProcessingMessage
        self.prior = None

    @staticmethod
    def get():
        return getattr(_cur_computing_cell, "cell", None)

    @staticmethod
    def isProcessingMessage():
        return getattr(_cur_computing_cell, "isProcessingMessage", None)

    def __enter__(self):
        self.prior = (
            getattr(_cur_computing_cell, "cell", None),
            getattr(_cur_computing_cell, "isProcessingMessage", None),
        )

        _cur_computing_cell.cell = self.cell
        _cur_computing_cell.isProcessingMessage = self.isProcessingMessage

    def __exit__(self, *args):
        _cur_computing_cell.cell = self.prior[0]
        _cur_computing_cell.isProcessingMessage = self.prior[1]


def registerDisplay(type, **context):
    """Register a display function for any instances of a given type. For instance

    @registerDisplay(MyType, size="small")
    def display(value):
        return cells.Text("For small values")

    @registerDisplay(MyType)
    def display(value):
        return cells.Text("For any other kinds of values")

    Arguments:
        type - the type object to display. Instances of _exactly_ this type
            will match this if we don't have a display for the object already.
        context - a dict from str->value. we'll only use this display if this context
            is exactly matched in the parent cell. We'll check contexts in the
            order in which they were registered.
    """

    def registrar(displayFunc):
        ContextualDisplay._typeToDisplay.setdefault(type, []).append(
            (ContextualDisplay.ContextMatcher(context), displayFunc)
        )

        return displayFunc

    return registrar


def context(contextKey):
    """During cell evaluation, lookup context from our parent cell by name."""
    if ComputingCellContext.get() is None:
        raise Exception("Please call 'context' from within a message or cell update function.")

    return ComputingCellContext.get().getContext(contextKey)


def quoteForJs(string, quoteType):
    if quoteType == "'":
        return string.replace("\\", "\\\\").replace("'", "\\'").replace("\n", "\\n")
    else:
        return string.replace("\\", "\\\\").replace('"', '\\"').replace("\n", "\\n")


def wrapCallback(callback):
    """Make a version of callback that will run on the main cells ui thread when invoked.

    This must be called from within a 'cell' or message update.
    """
    cells = ComputingCellContext.get().cells

    def realCallback(*args, **kwargs):
        cells.scheduleCallback(lambda: callback(*args, **kwargs))

    realCallback.__name__ = callback.__name__

    return realCallback


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


class Cells:
    def __init__(self, db):
        self.db = db

        self._eventHasTransactions = queue.Queue()

        self.db.registerOnTransactionHandler(self._onTransaction)

        # map: Cell.identity ->  Cell
        self._cells = {}

        # map: Cell.identity -> set(Cell)
        self._cellsKnownChildren = {}

        # set(Cell)
        self._dirtyNodes = set()

        # set(Cell)
        self._nodesToBroadcast = set()

        # set(Cell)
        self._nodesToDataUpdate = set()

        # set(Cell)
        self._nodesToDataRequest = set()

        # set(Cell)
        self._nodesToDiscard = set()

        self._transactionQueue = queue.Queue()

        # set(Slot) containing slots that have been dirtied but whose
        # values have not been updated yet.
        self._dirtySlots = set()

        # map: db.key -> set(Cell)
        self._subscribedCells = {}

        self._pendingPostscripts = []

        # used by _newID to generate unique identifiers
        self._id = 0

        # a list of pending callbacks that want to run on the main thread
        self._callbacks = queue.Queue()

        self._logger = logging.getLogger(__name__)

        # Testing. Remove.
        self.updatedCellTypes = set()

        self._root = RootCell()

        self._shouldStopProcessingTasks = threading.Event()

        self._addCell(self._root, parent=None)

        self._dirtyComputedSlots = set()

    def cleanupCells(self):
        """Walk down the tree calling 'onRemovedFromTree' so that our cells can GC any
        outstanding threads or downloaders they have sitting around."""

        def walk(cell):
            cell.onRemovedFromTree()
            for child in cell.children.allChildren:
                walk(child)

        walk(self._root)

    def _processCallbacks(self):
        """Execute any callbacks that have been scheduled to run on the main UI thread."""
        try:
            while True:
                callback = self._callbacks.get(block=False)

                try:
                    callback()
                except Exception:
                    self._logger.exception(
                        "Callback %s threw an unexpected exception:", callback
                    )
        except queue.Empty:
            return

    def scheduleCallback(self, callback):
        """Schedule a callback to execute on the main cells thread as soon as possible.

        Code in other threads shouldn't modify cells or slots.
        Cells that want to trigger asynchronous work can do so and then push
        content back into Slot objects using these callbacks.
        """
        self._callbacks.put(callback)
        self._eventHasTransactions.put(1)

    def withRoot(self, root_cell, session_state=None):
        self._root.setChild(root_cell)
        self._root.setContext(
            SessionState,
            session_state
            or self._root.context.get(SessionState)
            or SessionState()._reset(self),
        )
        return self

    def __contains__(self, cell_or_id):
        if isinstance(cell_or_id, Cell):
            return cell_or_id.identity in self._cells
        else:
            return cell_or_id in self._cells

    def __len__(self):
        return len(self._cells)

    def __getitem__(self, ix):
        return self._cells.get(ix)

    def _newID(self):
        self._id += 1
        return str(self._id)

    def triggerIfHasDirty(self):
        if self._dirtyNodes:
            self._eventHasTransactions.put(1)

    def wait(self):
        self._eventHasTransactions.get()

        # drain the queue
        try:
            while True:
                self._eventHasTransactions.get_nowait()
        except queue.Empty:
            pass

    def _onTransaction(self, *trans):
        self._transactionQueue.put(trans)
        self._eventHasTransactions.put(1)

    def _handleTransaction(self, key_value, set_adds, set_removes, transactionId):
        """ Given the updates coming from a transaction, update self._subscribedCells. """
        for k in list(key_value) + list(set_adds) + list(set_removes):
            if k in self._subscribedCells:
                self._subscribedCells[k] = set(
                    cell for cell in self._subscribedCells[k] if not cell.garbageCollected
                )

                toTrigger = list(self._subscribedCells[k])

                for cell in toTrigger:
                    cell.subscribedOdbValueChanged(k)

                if not self._subscribedCells[k]:
                    del self._subscribedCells[k]

    def _addCell(self, cell, parent):
        if not isinstance(cell, Cell):
            raise Exception(
                f"Can't add a cell of type {type(cell)} which isn't a subclass of Cell."
            )

        if cell.cells is not None:
            raise Exception(
                f"Cell {cell} is already installed as a child of {cell.parent}."
                f" We can't add it to {parent}"
            )

        cell.install(self, parent, self._newID())

        assert cell.identity not in self._cellsKnownChildren
        self._cellsKnownChildren[cell.identity] = set()

        assert cell.identity not in self._cells
        self._cells[cell.identity] = cell

    def _cellOutOfScope(self, cell):
        for c in cell.children.allChildren:
            self._cellOutOfScope(c)
        cell.wasCreated = False
        cell.wasUpdated = False
        self.markToDiscard(cell)

        if cell.cells is not None:
            assert cell.cells == self
            del self._cells[cell.identity]
            del self._cellsKnownChildren[cell.identity]
            for sub in cell.subscriptions:
                self.unsubscribeCell(cell, sub)

        cell.garbageCollected = True

    def subscribeCell(self, cell, subscription):
        self._subscribedCells.setdefault(subscription, set()).add(cell)

    def unsubscribeCell(self, cell, subscription):
        if subscription in self._subscribedCells:
            self._subscribedCells[subscription].discard(cell)
            if not self._subscribedCells[subscription]:
                del self._subscribedCells[subscription]

    def markDirty(self, cell):
        assert not cell.garbageCollected, (cell, cell.text if isinstance(cell, Text) else "")
        self._dirtyNodes.add(cell)

    def computedSlotDirty(self, slot):
        self._dirtyComputedSlots.add(slot)
        self._eventHasTransactions.put(1)

    def markToDiscard(self, cell):
        assert not cell.garbageCollected, (cell, cell.text if isinstance(cell, Text) else "")

        self._nodesToDiscard.add(cell)
        # TODO: lifecycle attribute; see cell.updateLifecycleState()
        cell.wasRemoved = True

        cell.onRemovedFromTree()

    def markToBroadcast(self, node):
        assert node.cells is self

        self._nodesToBroadcast.add(node)

    def markToDataUpdate(self, node):
        assert node.cells is self

        self._nodesToDataUpdate.add(node)

    def markToDataRequest(self, node):
        assert node.cells is self

        self._nodesToDataRequest.add(node)

    def findStableParent(self, cell):
        while True:
            if not cell.parent:
                return cell

            if cell.parent.wasUpdated or cell.parent.wasCreated or cell.isMergedIntoParent():
                cell = cell.parent

            else:
                return cell

    def dumpTree(self, cell=None, indent=0):
        print(" " * indent + str(cell))
        for child in cell.children.allChildren:
            self.dumpTree(child, indent + 2)

    def renderMessages(self):
        self._processCallbacks()
        self._recalculateCells()
        # self._processDataUpdates()

        res = []

        # Make messages for updated
        createdAndUpdated = []
        for node in self._nodesToBroadcast:
            if node.wasUpdated or node.wasCreated:
                createdAndUpdated.append(node)

        updatedNodesToSend = set()
        for node in createdAndUpdated:
            stableParent = node.stableParent()
            updatedNodesToSend.add(stableParent)

        for nodeToSend in list(updatedNodesToSend):
            res.append(Messenger.cellUpdated(nodeToSend))

        # make messages for data updated nodes
        for node in self._nodesToDataUpdate:
            res.append(Messenger.cellDataUpdated(node))
            node.updateLifecycleState()

        # make messages for data updated nodes
        for node in self._nodesToDataRequest:
            res.append(Messenger.cellDataRequested(node))
            node.updateLifecycleState()

        # Make the compound message
        # listing all the nodes that
        # will be discarded
        finalNodesToDiscard = []
        for node in self._nodesToDiscard:
            if node.cells is not None:
                assert node.cells == self
                finalNodesToDiscard.append(node)
                # TODO: in the future this should integrated into a more
                # structured server side lifecycle management framework
                node.updateLifecycleState()
        if len(finalNodesToDiscard):
            res.append(Messenger.cellsDiscarded(finalNodesToDiscard))

        # the client reverses the order of postscripts because it wants
        # to do parent nodes before child nodes. We want our postscripts
        # here to happen in order, because they're triggered by messages,
        # so we have to reverse the order in which we append them, and
        # put them on the front.
        postScriptMsgs = []
        for js in reversed(self._pendingPostscripts):
            msg = Messenger.appendPostscript(js)
            postScriptMsgs.append(msg)
        res = postScriptMsgs + res

        self._pendingPostscripts.clear()

        # We need to reset the wasUpdated
        # and/or wasCreated properties
        # on all the _nodesToBroadcast
        for node in self._nodesToBroadcast:
            node.updateLifecycleState()

        self._nodesToBroadcast = set()
        self._nodesToDataUpdate = set()
        self._nodesToDataRequest = set()
        self._nodesToDiscard = set()

        return res

    def _processDataUpdates(self):
        """ Handle all data updates. """
        # TODO we should not be going through all the cells here
        for node in self._cells:
            if node.wasDataUpdated:
                self.markToDataUpdate(node)
            if node.wasDataRequested:
                self.markToDataRequest(node)

    def _recalculateComputedSlots(self):
        t0 = time.time()

        slotsComputed = set()
        while self._dirtyComputedSlots:
            slot = self._dirtyComputedSlots.pop()
            slotsComputed.add(slot)
            slot.cells = self
            slot.ensureCalculated()

        if slotsComputed:
            logging.info(
                "Recomputed %s ComputedSlots in %s", len(slotsComputed), time.time() - t0
            )

        return slotsComputed

    def _recalculateCells(self):
        # handle all the transactions so far
        old_queue = self._transactionQueue
        self._transactionQueue = queue.Queue()

        try:
            while True:
                self._handleTransaction(*old_queue.get_nowait())
        except queue.Empty:
            pass

        slotsRecomputed = self._recalculateComputedSlots()

        while self._dirtyNodes:
            cellsByLevel = {}
            for node in self._dirtyNodes:
                if not node.garbageCollected:
                    cellsByLevel.setdefault(node.level, []).append(node)
            self._dirtyNodes.clear()

            for level, nodesAtThisLevel in sorted(cellsByLevel.items()):
                for node in nodesAtThisLevel:
                    if not node.garbageCollected:
                        self._recalculateSingleCell(node)

        # walk all the computed slots and drop any that
        # no longer have anybody looking at them so that we don't keep
        # recomputing them.
        orphanedAny = True
        orphanedCount = 0
        while orphanedAny:
            orphanedAny = False

            for s in list(slotsRecomputed):
                if s.orphanSelfIfUnused():
                    slotsRecomputed.discard(s)
                    orphanedCount += 1
                    orphanedAny = True

        if orphanedCount:
            logging.info("GC'd %s ComputedSlot objects", orphanedCount)

    def _recalculateSingleCell(self, node):
        if node.wasDataUpdated:
            self.markToDataUpdate(node)
            # TODO this should be cleaned up
            return
        if node.wasDataRequested:
            self.markToDataRequest(node)
            # TODO this should be cleaned up
            return

        origChildren = self._cellsKnownChildren.get(node.identity, set())

        with ComputingCellContext(node):
            try:
                while True:
                    try:
                        node.prepare()
                        node.recalculate()

                        if not node.wasCreated:
                            # if a cell is marked to broadcast it is either new or has
                            # been updated. Hence, if it's not new here that means it's
                            # to be updated.
                            node.wasUpdated = True
                        break
                    except SubscribeAndRetry as e:
                        e.callback(self.db)

                for child_cell in node.children.allChildren:
                    # TODO: We are going to have to update this
                    # to deal with namedChildren structures (as opposed
                    # to plain children dicts) in the near future.
                    if not isinstance(child_cell, Cell):
                        childname = node.children.findNameFor(child_cell)
                        raise Exception(
                            "Cell of type %s had a non-cell child %s of type %s != Cell."
                            % (type(node), childname, type(child_cell))
                        )

                    if child_cell.cells:
                        # ensure all new children that were garbage collected get marked for
                        # re-use so that we can add them back in.
                        child_cell.prepareForReuse()
                        # TODO: lifecycle attribute; see cell.updateLifecycleState()
                        child_cell.wasRemoved = False

            except Exception:
                self._logger.exception("Node %s had exception during recalculation:", node)
                self._logger.exception("Subscribed cell threw an exception:")
                tracebackCell = Traceback(traceback.format_exc())
                node.children["content"] = tracebackCell

        self.markToBroadcast(node.rootMergeNode())
        nodeToBroadCast = node.rootMergeNode()
        nodeToBroadCast.wasUpdated = True

        newChildren = set(node.children.allChildren)

        for child in newChildren.difference(origChildren):
            self._addCell(child, node)
            self._recalculateSingleCell(child)

        for child in origChildren.difference(newChildren):
            self._cellOutOfScope(child)

        self._cellsKnownChildren[node.identity] = newChildren

    def childrenWithExceptions(self):
        return self._root.findChildrenMatching(lambda cell: isinstance(cell, Traceback))

    def findChildrenByTag(self, tag, stopSearchingAtFoundTag=True):
        return self._root.findChildrenByTag(
            tag, stopSearchingAtFoundTag=stopSearchingAtFoundTag
        )

    def findChildrenMatching(self, filtr):
        return self._root.findChildrenMatching(filtr)


class Slot:
    """Represents a piece of session-specific interface state. Any cells
    that call 'get' will be recalculated if the value changes. UX is allowed
    to change the state (say, because of a button call), thereby causing any
    cells that depend on the Slot to recalculate.

    For the most part, slots are specific to a particular part of a UX tree,
    so they don't have memory. Eventually, it would be good to give them a
    specific name based on where they are in the UX, so that we don't lose
    UX state when we navigate away. We could also keep this in ODB so that
    the state is preserved when we bounce the page.
    """

    def __init__(self, value=None):
        self._value = value
        self._subscribedCells = set()

    def setter(self, val):
        return lambda: self.set(val)

    def onWatchingSlot(self, slot):
        pass

    def slotGoingAway(self, subSlot):
        self._subscribedCells.discard(subSlot)

    def getWithoutRegisteringDependency(self):
        return self._value

    def get(self):
        """Get the value of the Slot, and register a dependency on the calling cell."""

        # we can only create a dependency if we're being read
        # as part of a cell's state recalculation.
        curCell = ComputingCellContext.get()

        if curCell is not None and not ComputingCellContext.isProcessingMessage():
            self._subscribedCells.add(curCell)
            curCell.onWatchingSlot(self)

        return self._value

    def set(self, val):
        """Write to a slot.

        If the outside context is a Task, this gets placed on a 'pendingValue' and
        the primary value gets updated between Task cycles. Otherwise, the write
        is synchronous.
        """
        if val == self._value:
            return

        self._value = val

        self._triggerListeners()

    def _triggerListeners(self):
        toTrigger = self._subscribedCells
        self._subscribedCells = set()

        for c in toTrigger:
            c.subscribedSlotChanged(self)

    def toggle(self):
        self.set(not self.get())


class ComputedSlot(Slot):
    """Models a value that's computed from other Slot and ODB values.

    This lets us stash expensive computations in the Slot and re-use them
    in many places in the UI. It also allows us to break update chains caused
    by computations reading from many different slots.

    Usage:
        # create a computed slot
        x = ComputedSlot(lambda: someCalc)

        # this reads the value of the computed slot and registers
        # a dependency on it. If the slot recomputes but the value doesn't
        # change, then you won't redeploy.
        x.get()

    Optionally you can add a 'setter' to it, and get a callback that lets you
    push the 'set' operation into some other slot or ODB value.
    """

    def __init__(self, valueFunction, onSet=None):
        self._valueFunction = valueFunction
        self._onSet = onSet
        self._value = None
        self._valueUpToDate = False
        self._subscribedCells = set()
        self._slotsWatching = set()
        self.subscriptions = set()
        self.cells = None
        self.garbageCollected = False

    def getWithoutRegisteringDependency(self):
        self.ensureCalculated()

        return self._value

    def onWatchingSlot(self, slot):
        self._slotsWatching.add(slot)

    def orphanSelfIfUnused(self):
        """Check if nobody is using us and if so, mark ourselves as 'garbageCollected'

        In this case, we also unhook ourselves from our subscriptions so that we don't
        recalculate.

        This should only get called _after_ the graph has settled down fully, so that
        we know everything is OK.
        """
        if not self._subscribedCells:
            self.garbageCollected = True

            for s in self.subscriptions:
                self.cells.unsubscribeCell(self, s)
            self.subscriptions = set()

            for s in self._slotsWatching:
                s.slotGoingAway(self)

            return True

    def get(self):
        if self.cells is None and ComputingCellContext.get():
            self.cells = ComputingCellContext.get().cells

        self.ensureCalculated()

        return super().get()

    def set(self, val):
        if not self._onSet:
            raise Exception("This ComputedSlot is not settable.")

        self._onSet(val)

    def subscribedOdbValueChanged(self, key):
        self._valueUpToDate = False

        if self._subscribedCells:
            self.cells.computedSlotDirty(self)

    def subscribedSlotChanged(self, slot):
        self._valueUpToDate = False

        if self._subscribedCells:
            self.cells.computedSlotDirty(self)

    def ensureCalculated(self):
        if self.cells is None and ComputingCellContext.get():
            self.cells = ComputingCellContext.get().cells

        if self._valueUpToDate:
            return

        self._slotsWatching = set()

        while True:
            try:
                with ComputingCellContext(self):
                    with MaskView():
                        with self.cells.db.view() as v:
                            oldValue = self._value

                            try:
                                self._value = self._valueFunction()
                            except SubscribeAndRetry:
                                raise
                            except Exception:
                                logging.warn(
                                    "Computed slot threw an exception: %s",
                                    traceback.format_exc(),
                                )
                                self._value = None

                            self._resetSubscriptionsToViewReads(v)

                            self._valueUpToDate = True

                            if oldValue != self._value:
                                self._triggerListeners()

                return
            except SubscribeAndRetry as e:
                e.callback(self.cells.db)

    def _resetSubscriptionsToViewReads(self, view):
        new_subscriptions = set(view.getFieldReads()).union(set(view.getIndexReads()))

        for k in new_subscriptions.difference(self.subscriptions):
            self.cells.subscribeCell(self, k)

        for k in self.subscriptions.difference(new_subscriptions):
            self.cells.unsubscribeCell(self, k)

        self.subscriptions = new_subscriptions


class SessionState(object):
    """Represents a piece of session-specific interface state. You may access state
    using attributes, which will register a dependency
    """

    def __init__(self):
        self._slots = {}

    def _reset(self, cells):
        self._slots = {
            k: Slot(v.getWithoutRegisteringDependency()) for k, v in self._slots.items()
        }

        for s in self._slots.values():
            s._cells = cells
            if isinstance(s._value, Cell):
                try:
                    s._value.prepareForReuse()
                except Exception:
                    logging.warn(f"Reusing a Cell slot could create a problem: {s._value}")
        return self

    def _slotFor(self, name):
        if name not in self._slots:
            self._slots[name] = Slot()
        return self._slots[name]

    def __getattr__(self, attr):
        if attr[:1] == "_":
            raise AttributeError(attr)

        return self._slotFor(attr).get()

    def __setattr__(self, attr, val):
        if attr[:1] == "_":
            self.__dict__[attr] = val
            return

        return self._slotFor(attr).set(val)

    def setdefault(self, attr, value):
        if attr not in self._slots:
            self._slots[attr] = Slot(value)

    def set(self, attr, value):
        self._slotFor(attr).set(value)

    def toggle(self, attr):
        self.set(attr, not self.get(attr))

    def get(self, attr):
        return self._slotFor(attr).get()

    def getWithoutRegisteringDependency(self, attr):
        return self._slotFor(attr).getWithoutRegisteringDependency()


def sessionState():
    return context(SessionState)


class Cell:
    def __init__(self):
        self.cells = None  # will get set when its added to a 'Cells' object

        # the cell that created us. This will never change.
        self.parent = None

        self.level = None
        self.children = Children()
        self.contents = ""  # some contents containing a local node def
        self.shouldDisplay = True  # Whether or not this is a cell that will be displayed
        self.isRoot = False
        self.isShrinkWrapped = False  # If will be shrinkwrapped inside flex parent
        self.isFlex = False  # If True, then we are 'Flex'
        self._identity = None  # None, or a string
        self._tag = None
        self._nowrap = None
        self._overflow = None
        self.postscript = None
        self.garbageCollected = False
        self.subscriptions = set()
        self._style = {}
        self.context = {}

        # lifecylce state attributes
        # These reflect the current state of the cell and
        # subsequently used in WS message formatting and pre-processing
        # NOTE: as of this commit these resetting state on (potentially) reused
        # cells is handled by self.updateLifecycleState.
        self.wasCreated = True
        self.wasUpdated = False
        self.wasDataUpdated = False  # Whether or not this cell has updated data
        self.wasDataRequested = False  # Whether this cell requested data
        self.wasRemoved = False

        self._logger = logging.getLogger(__name__)

        # This is for interim JS refactoring.
        # Cells provide extra data that JS
        # components will need to know about
        # when composing DOM.
        self.exportData = {}

    def onRemovedFromTree(self):
        """Called when a cell is removed from the tree. This shouldn't update any slots,
        but may schedule callbacks."""
        pass

    def onWatchingSlot(self, slot):
        """Called when we become tied to the value of a slot."""
        pass

    def subscribedSlotChanged(self, slot):
        """Called when a slot we're subscribed to changes."""
        self.markDirty()

    def subscribedOdbValueChanged(self, odbKey):
        """Called when an object database key we depend on changes."""
        self.markDirty()

    def rootMergeNode(self):
        """Return the root node we're merged into, or ourself if we're not merged."""
        while True:
            if not self.isMergedIntoParent():
                return self
            if self.parent is None:
                return None
            self = self.parent

    def getDisplayExportData(self):
        """Get the version of 'self.exportData' we should actually use.

        Cells that have children who are collapsed into their parent are responsible for
        updating things like 'flexParent' here.
        """
        return self.exportData

    def getDisplayChildren(self):
        """Get the version of 'self.children' that we should use when displaying this cell.

        Cells that have children who are collapsed into their parent are
        responsible for flattening the tree here.
        """
        return self.children

    def _sequenceOrientation(self):
        """If we are an oriented sequence, return 'horizontal' or 'vertical'.

        Otherwise None."""
        return None

    def isMergedIntoParent(self):
        return False

    def rootSequenceOfOrientation(self, orientation):
        """Are we (or are we contained within) a sequence of a given orientation?

        Args:
            orientation - one of 'vertical' or 'horizontal'

        Returns:
            A Cell representing the root sequence of a given orientation. This will
            end up being the 'display parent' for all child sequences that get
            flattened within this tree.
        """
        if self._sequenceOrientation() != orientation:
            return None

        if self.isFlex:
            # if we're marked 'Flex', then we are the terminal node.
            return self

        if not self.parent:
            return self

        root = self.parent.rootSequenceOfOrientation(orientation)
        if root is not None:
            return root

        return self

    def install(self, cells, parent, identity):
        assert self.cells is None
        self.cells = cells
        self.parent = parent
        self.level = parent.level + 1 if parent is not None else 0
        self._identity = identity
        self._identityPath = None

    @property
    def identityPath(self):
        """Return a stable unique id for this cell representing its position in the tree."""
        if self.cells is None:
            return ()

        if self.parent is None:
            return ()

        if self._identityPath is None:
            self._identityPath = self.parent.identityPath + (
                self.parent.identityOfChild(self),
            )

        return self._identityPath

    def identityOfChild(self, child):
        try:
            return self.children.allChildren.index(child)
        except ValueError:
            return child._identity

    def __repr__(self):
        return f"{type(self).__name__}(id={self._identity})"

    def applyCellDecorator(self, decorator):
        """Return a new cell which applies the function 'decorator' to 'self'.

        By default we just call the function. But some subclasses may want to apply
        the decorator to child cells instead.
        """
        return decorator(self)

    def updateLifecycleState(self):
        """Handles cell lifecycle state.

        Once a cell has been created, updated or deleted and corresponding
        messages sent to the client, the cell state is updated accordingly.
        Example, if `cell.wasCreated=True` from that moment forward it is
        already in the echosystem and so `cell.Created=False`. The 'was'
        linking verb is used to to reflect that something has been done to the
        cell (object DB, or client call back side-effect) and now the reset of
        the system, server and client side, needs to know about it.

        TODO: At the moment this method **needs** to be called after all
        message sends to the client. In the future, this should be integrated
        into a general lifecycle management scheme.
        """
        if self.wasCreated:
            self.wasCreated = False
        if self.wasUpdated:
            self.wasUpdated = False
        if self.wasDataUpdated:
            self.wasDataUpdated = False

            # clear the data info. We're using this to send messages, not as 'state'.
            self.exportData["dataInfo"] = None

        if self.wasDataRequested:
            self.wasDataRequested = False

            # clear the data info. We're using this to send messages, not as 'state'.
            self.exportData["dataInfo"] = None
        # NOTE: self.wasRemoved is set to False for self.prepareForReuse
        if self.wasRemoved:
            self.wasRemoved = False

    def evaluateWithDependencies(self, fun):
        """Evaluate function within a view and add dependencies for whatever
        we read."""
        with self.view() as v:
            result = fun()

            self._resetSubscriptionsToViewReads(v)

            return result

    def triggerPostscript(self, javascript):
        """ Queue a postscript to be run at the end of message processing.

        A postscript is a piece of javascript to execute.
        """
        self.cells._pendingPostscripts.append(javascript)

    def tagged(self, tag):
        """Give a tag to the cell, which can help us find interesting cells during test."""
        self._tag = tag
        self.exportData["queryTag"] = tag
        return self

    def findChildrenByTag(self, tag, stopSearchingAtFoundTag=False):
        """Search the cell and its children for all cells with the given tag.

        If `stopSearchingAtFoundTag`, we don't search recursively the children of a
        cell that matched our search.
        """
        cells = []

        if self._tag == tag:
            cells.append(self)
            if stopSearchingAtFoundTag:
                return cells

        for child in self.children.allChildren:
            cells.extend(child.findChildrenByTag(tag, stopSearchingAtFoundTag))

        return cells

    def visitAllChildren(self, visitor):
        visitor(self)
        for child in self.children.allChildren:
            child.visitAllChildren(visitor)

    def findChildrenMatching(self, filtr):
        res = []

        def visitor(cell):
            if filtr(cell):
                res.append(cell)

        self.visitAllChildren(visitor)

        return res

    def stableParent(self):
        """Find either myself or
        a parent Cell that is stable
        enough to send in an update
        message"""
        if not self.parent:
            return self
        if self.parent.wasUpdated or self.parent.wasCreated or self.isMergedIntoParent():
            return self.parent.stableParent()
        return self

    def childByIndex(self, ix):
        return self.children[sorted(self.children)[ix]]

    def childrenWithExceptions(self):
        return self.findChildrenMatching(lambda cell: isinstance(cell, Traceback))

    def getCurrentStructure(self, expand=False):
        return Messenger.getStructure(self.parent.identity, self, expand)

    def onMessageWithTransaction(self, *args):
        """ Call our inner 'onMessage' function with a transaction in a retry loop. """
        tries = 0
        t0 = time.time()
        while True:
            with ComputingCellContext(self, isProcessingMessage=True):
                try:
                    with self.transaction():
                        self.onMessage(*args)
                        return
                except RevisionConflictException:
                    tries += 1
                    if tries > MAX_TRIES or time.time() - t0 > MAX_TIMEOUT:
                        self._logger.error("OnMessage timed out. This should really fail.")
                        return
                except Exception:
                    self._logger.exception(
                        "Exception processing message %s to cell %s logic:", args, self
                    )
                    return

    def _clearSubscriptions(self):
        if self.cells:
            for sub in self.subscriptions:
                self.cells.unsubscribeCell(self, sub)

        self.subscriptions = set()

    def _resetSubscriptionsToViewReads(self, view):
        new_subscriptions = set(view.getFieldReads()).union(set(view.getIndexReads()))

        for k in new_subscriptions.difference(self.subscriptions):
            self.cells.subscribeCell(self, k)

        for k in self.subscriptions.difference(new_subscriptions):
            self.cells.unsubscribeCell(self, k)

        self.subscriptions = new_subscriptions

    def view(self):
        return self.cells.db.view()

    def transaction(self):
        return self.cells.db.transaction()

    def prepare(self):
        pass

    def sortsAs(self):
        return None

    def nowrap(self):
        self._nowrap = True
        return self

    def overflow(self, overflow):
        self._overflow = overflow
        return self

    def isActive(self):
        """Is this cell installed in the tree and active?"""
        return self.cells and not self.garbageCollected

    def prepareForReuse(self):
        if not self.garbageCollected:
            return False

        self.cells = None
        self.postscript = None
        self.garbageCollected = False
        self._identity = None
        self.parent = None

        for c in self.children.allChildren:
            c.prepareForReuse()

        return True

    @property
    def identity(self):
        if self._identity is None:
            raise Exception(
                "Can't ask for identity for %s as it's not part of a cells package" % self
            )
        return self._identity

    def markDirty(self):
        if not self.garbageCollected and self.cells is not None:
            self.cells.markDirty(self)

    def recalculate(self):
        pass

    @staticmethod
    def makeCell(x):
        if isinstance(x, (str, float, int, bool)):
            return Text(str(x), sortAs=x)
        if x is None:
            return Span("")
        if isinstance(x, Cell):
            return x

        return ContextualDisplay(x)

    def __add__(self, other):
        return Sequence([self, Cell.makeCell(other)])

    def __rshift__(self, other):
        return HorizontalSequence([self, Cell.makeCell(other)])

    def withContext(self, **kwargs):
        """Modify our context, and then return self."""
        self.context.update(kwargs)
        return self

    def setContext(self, key, val):
        self.context[key] = val
        return self

    def getContext(self, contextKey):
        if contextKey in self.context:
            return self.context[contextKey]

        if self.parent:
            return self.parent.getContext(contextKey)

        return None


class Card(Cell):
    def __init__(self, body, header=None, padding=None):
        super().__init__()

        self.padding = padding
        self.body = body
        self.header = header

    def recalculate(self):
        bodyCell = Cell.makeCell(self.body)
        self.children["body"] = bodyCell

        if self.header is not None:
            headerCell = Cell.makeCell(self.header)
            self.children["header"] = headerCell

        self.exportData["padding"] = self.padding

    def sortsAs(self):
        return self.contents.sortsAs()


class CardTitle(Cell):
    def __init__(self, inner):
        super().__init__()
        innerCell = Cell.makeCell(inner)
        self.children["inner"] = innerCell

    def sortsAs(self):
        return self.inner.sortsAs()


class Modal(Cell):
    def __init__(self, title, message, show=None, **buttonActions):
        """Initialize a modal dialog.

        title - string for the title
        message - string for the message body
        show - A Slot whose value is True if the cell
               should currently be showing and false if
               otherwise.
        buttonActions - a dict from string to a button action function.
        """
        super().__init__()
        self.title = Cell.makeCell(title).tagged("title")
        self.message = Cell.makeCell(message).tagged("message")
        if not show:
            self.show = Slot(False)
        else:
            self.show = show
        self.initButtons(buttonActions)
        self.buttonActions = buttonActions

    def initButtons(self, buttonActions):
        def augmentButtonAction(onClick):
            def newOnClick():
                self.show.set(False)
                onClick()

            return newOnClick

        buttons = [
            Button(k, augmentButtonAction(v)).tagged(k) for k, v in buttonActions.items()
        ]
        self.buttons = {}
        for i in range(len(buttons)):
            button = buttons[i]
            self.buttons["____button_{}__".format(i)] = button

    def recalculate(self):
        self.children.addFromDict(
            {
                "buttons": list(self.buttons.values()),
                "title": self.title,
                "message": self.message,
            }
        )
        with ComputingCellContext(self):
            self.exportData["show"] = self.show.get()

    def onMessage(self, messageFrame):
        if messageFrame["event"] == "close":
            self.show.set(False)
            if "Cancel" in self.buttonActions:
                self.buttonActions["Cancel"]()

        elif messageFrame["event"] == "accept":
            # First, run the default action,
            # which should be the one associated
            # with the *first* button
            if len(self.buttons) >= 1:
                self.buttons["____button_0__"].onClick()


class Octicon(Cell):
    def __init__(self, which, color="black", hoverText=None):
        super().__init__()
        self.whichOcticon = which
        self.color = color
        self.hoverText = hoverText

    def sortsAs(self):
        return self.whichOcticon

    def recalculate(self):
        octiconClasses = ["octicon", ("octicon-%s" % self.whichOcticon)]
        self.exportData["octiconClasses"] = octiconClasses
        self.exportData["color"] = self.color
        self.exportData["hoverText"] = str(self.hoverText or "")


class Badge(Cell):
    def __init__(self, inner, style="primary"):
        super().__init__()
        self.inner = self.makeCell(inner)
        self.style = style
        self.exportData["badgeStyle"] = self.style

    def sortsAs(self):
        return self.inner.sortsAs()

    def recalculate(self):
        self.children["inner"] = self.inner


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


class Text(Cell):
    def __init__(self, text, text_color=None, sortAs=None):
        super().__init__()
        self.text = str(text)
        self._sortAs = sortAs if sortAs is not None else text
        self.text_color = text_color

    def sortsAs(self):
        return self._sortAs

    def recalculate(self):
        escapedText = html.escape(str(self.text)) if self.text else " "
        self.exportData["escapedText"] = escapedText
        self.exportData["rawText"] = self.text
        self.exportData["textColor"] = self.text_color


class Padding(Cell):
    def __init__(self):
        super().__init__()

    def sortsAs(self):
        return " "


class Span(Cell):
    def __init__(self, text):
        super().__init__()
        self.exportData["text"] = text

    def sortsAs(self):
        return self.contents


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
        self._mergedIntoParent = False

    def isMergedIntoParent(self):
        return self._mergedIntoParent

    def _sequenceOrientation(self):
        return "vertical"

    def getDisplayChildren(self):
        children = []

        for child in self.elements:
            if child.isMergedIntoParent():
                children.extend(child.getDisplayChildren().allChildren)
            else:
                children.append(child)

        res = Children()
        res["elements"] = children
        return res

    def getDisplayExportData(self):
        """Get the version of 'self.exportData' we should actually use.

        Cells that have children who are collapsed into their parent are responsible for
        updating things like 'flexParent' here.
        """
        exportData = dict(self.exportData)

        displayChildren = self.getDisplayChildren()

        for child in displayChildren.allChildren:
            if child.isFlex:
                exportData["flexParent"] = True

        return exportData

    def __add__(self, other):
        other = Cell.makeCell(other)
        if isinstance(other, Sequence):
            return Sequence(self.elements + other.elements)
        else:
            return Sequence(self.elements + [other])

    def recalculate(self):
        if self.parent and not self.isFlex:
            rootSequence = self.parent.rootSequenceOfOrientation("vertical")
            if rootSequence is not None:
                self._mergedIntoParent = True

        self.children["elements"] = self.elements
        self.exportData["margin"] = self.margin

    def sortsAs(self):
        if self.elements:
            return self.elements[0].sortsAs()
        return None


class HorizontalSequence(Cell):
    def __init__(self, elements, overflow=True, margin=None, wrap=True):
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

    def isMergedIntoParent(self):
        return self._mergedIntoParent

    def _sequenceOrientation(self):
        return "horizontal"

    def __rshift__(self, other):
        other = Cell.makeCell(other)
        if isinstance(other, HorizontalSequence):
            return HorizontalSequence(self.elements + other.elements)
        else:
            return HorizontalSequence(self.elements + [other])

    def getDisplayChildren(self):
        children = []

        for child in self.elements:
            if child.isMergedIntoParent():
                children.extend(child.getDisplayChildren().allChildren)
            else:
                children.append(child)

        res = Children()
        res["elements"] = children
        return res

    def getDisplayExportData(self):
        """Get the version of 'self.exportData' we should actually use.

        Cells that have children who are collapsed into their parent are responsible for
        updating things like 'flexParent' here.
        """
        exportData = dict(self.exportData)

        displayChildren = self.getDisplayChildren()
        for child in displayChildren.allChildren:
            if child.isFlex:
                exportData["flexParent"] = True

        return exportData

    def recalculate(self):
        if self.parent and not self.isFlex:
            rootSequence = self.parent.rootSequenceOfOrientation("horizontal")
            if rootSequence is not None:
                self._mergedIntoParent = True

        self.exportData["margin"] = self.margin
        self.exportData["wrap"] = self.wrap
        self.children["elements"] = self.elements

    def sortAs(self):
        if self.elements:
            return self.elements[0].sortAs()
        return None


class Columns(Cell):
    def __init__(self, *elements):
        super().__init__()
        elements = [Cell.makeCell(x) for x in elements]

        self.elements = elements
        self.children["elements"] = self.elements

    def __add__(self, other):
        other = Cell.makeCell(other)
        if isinstance(other, Columns):
            return Columns(*(self.elements + other.elements))
        else:
            return super().__add__(other)

    def sortsAs(self):
        if self.elements:
            return self.elements[0].sortsAs()
        return None


class LargePendingDownloadDisplay(Cell):
    def __init__(self):
        super().__init__()


class HeaderBar(Cell):
    def __init__(self, leftItems, centerItems=(), rightItems=()):
        super().__init__()
        self.leftItems = leftItems
        self.centerItems = centerItems
        self.rightItems = rightItems

        self.children.addFromDict(
            {
                "leftItems": self.leftItems,
                "centerItems": self.centerItems,
                "rightItems": self.rightItems,
            }
        )


class Main(Cell):
    def __init__(self, child):
        super().__init__()
        self.children["child"] = child


class _NavTab(Cell):
    def __init__(self, slot, index, target, child):
        super().__init__()

        self.slot = slot
        self.index = index
        self.target = target
        self.child = child

    def recalculate(self):
        self.exportData["clickData"] = {
            "event": "click",
            "ix": str(self.index),
            "target_cell": self.target,
        }

        if self.index == self.slot.get():
            self.exportData["isActive"] = True
        else:
            self.exportData["isActive"] = False

        childCell = Cell.makeCell(self.child)
        childCell.prepareForReuse()
        self.children["child"] = childCell


class Tabs(Cell):
    def __init__(self, headersAndChildren=(), **headersAndChildrenKwargs):
        super().__init__()

        self.whichSlot = Slot(0)
        self.headersAndChildren = list(headersAndChildren)
        self.headersAndChildren.extend(headersAndChildrenKwargs.items())

    def sortsAs(self):
        return None

    def setSlot(self, index):
        self.whichSlot.set(index)

    def recalculate(self):
        displayCell = Subscribed(lambda: self.headersAndChildren[self.whichSlot.get()][1])

        self.children["display"] = displayCell
        self.children["headers"] = []

        headersToAdd = []
        for i in range(len(self.headersAndChildren)):
            headerCell = _NavTab(
                self.whichSlot, i, self._identity, self.headersAndChildren[i][0]
            )
            headersToAdd.append(headerCell)

        self.children["headers"] = headersToAdd

    def onMessage(self, msgFrame):
        self.whichSlot.set(int(msgFrame["ix"]))


class Dropdown(Cell):
    def __init__(self, title, headersAndLambdas, singleLambda=None, rightSide=False):
        """
        Initialize a Dropdown menu.

            title - a cell containing the current value.
            headersAndLambdas - a list of pairs containing (cell, callback) for each menu item.

        OR

            title - a cell containing the current value.
            headersAndLambdas - a list of pairs containing cells for each item
            callback - a primary callback to call with the selected cell
        """
        super().__init__()

        if singleLambda is not None:

            def makeCallback(cell):
                def callback():
                    singleLambda(cell)

                return callback

            self.headersAndLambdas = [
                (header, makeCallback(header)) for header in headersAndLambdas
            ]
        else:
            self.headersAndLambdas = headersAndLambdas

        self.title = Cell.makeCell(title)

    def sortsAs(self):
        return self.title.sortsAs()

    def recalculate(self):
        self.children["title"] = self.title
        self.children["dropdownItems"] = []

        # Because the items here are not separate cells,
        # we have to perform an extra hack of a dict
        # to get the proper data to the temporary
        # JS Component
        self.exportData["targetIdentity"] = self.identity
        self.exportData["dropdownItemInfo"] = {}

        itemsToAdd = []
        for i in range(len(self.headersAndLambdas)):
            header, onDropdown = self.headersAndLambdas[i]
            childCell = Cell.makeCell(header)
            itemsToAdd.append(childCell)
            if not isinstance(onDropdown, str):
                self.exportData["dropdownItemInfo"][i] = "callback"
            else:
                self.exportData["dropdownItemInfo"][i] = onDropdown
        self.children["dropdownItems"] = itemsToAdd

    def onMessage(self, msgFrame):
        self._logger.info(msgFrame)
        fun = self.headersAndLambdas[msgFrame["ix"]][1]
        fun()


class CircleLoader(Cell):
    """A simple circular loading indicator
    """

    def __init__(self):
        super().__init__()


class AsyncDropdown(Cell):
    """A Bootstrap-styled Dropdown Cell

    whose dropdown-menu contents can be loaded
    asynchronously each time the dropdown is opened.

    Example
    -------
    The following dropdown will display a
    Text cell that displays "LOADING" for
    a second before switching to a different
    Text cell that says "NOW CONTENT HAS LOADED"::
        def someDisplayMethod():
            def delayAndDisplay():
                time.sleep(1)
                return Text('NOW CONTENT HAS LOADED')

            return Card(
                AsyncDropdown(delayAndDisplay)
            )

    """

    def __init__(self, labelText, contentCellFunc, loadingIndicatorCell=None):
        """
        Parameters
        ----------
        labelText: str
            A label for the dropdown
        contentCellFunc: Function or Lambda
            A lambda or function that will
            return a Cell to display asynchronously.
            Usually some computation that takes time
            is performed first, then the Cell gets
            returned
        loadingIndicatorCell: Cell
            A cell that will be displayed while
            the content of the contentCellFunc is
            loading. Defaults to CircleLoader.
        """
        super().__init__()
        self.slot = Slot(False)
        self.labelText = labelText
        self.exportData["labelText"] = self.labelText
        if not loadingIndicatorCell:
            loadingIndicatorCell = CircleLoader()
        self.contentCell = Cell.makeCell(
            AsyncDropdownContent(self.slot, contentCellFunc, loadingIndicatorCell)
        )
        self.children["content"] = Cell.makeCell(self.contentCell)

    def onMessage(self, messageFrame):
        """On `dropdown` events sent to this
        Cell over the socket, we will be told
        whether the dropdown menu is open or not
        """
        if messageFrame["event"] == "dropdown":
            self.slot.set(not messageFrame["isOpen"])


class AsyncDropdownContent(Cell):
    """A dynamic content cell designed for use

    inside of a parent `AsyncDropdown` Cell.

    Notes
    -----
    This Cell should only be used by `AsyncDropdown`.

    Because of the nature of slots and rendering,
    we needed to decompose the actual Cell that
    is dynamically updated using `Subscribed` into
    a separate unit from `AsyncDropdown`.

    Without this separate decomposition,
    the entire Cell would be replaced on
    the front-end, meaning the drawer would never open
    or close since Dropdowns render closed initially.
    """

    def __init__(self, slot, contentFunc, loadingIndicatorCell):
        """
        Parameters
        ----------
        slot: Slot
            A slot that contains a Boolean value
            that tells this cell whether it is in
            the open or closed state on the front
            end. Changes are used to update the
            loading of dynamic Cells to display
            on open.
        contentFunc: Function or Lambda
            A function or lambda that will return
            a Cell to display. Will be called whenever
            the Dropdown is opened. This gets passed
            from the parent `AsyncDropdown`
        loadingIndicatorCell: Cell
            A Cell that will be displayed while
            the content from contentFunc is loading
        """
        super().__init__()
        self.slot = slot
        self.contentFunc = contentFunc
        self.loadingCell = loadingIndicatorCell
        self.contentCell = Subscribed(self.changeHandler)
        self.children.addFromDict({"content": Cell.makeCell(self.contentCell)})

    def changeHandler(self):
        """If the slot is true, the
        dropdown is open and we call the
        `contentFunc` to get something to
        display. Until then, we show the
        Loading message.
        """
        slotState = self.slot.get()
        if slotState:
            return self.contentFunc()
        else:
            return Cell.makeCell(self.loadingCell)


class Container(Cell):
    # TODO: Figure out what this Cell
    # actually needs to do, ie why
    # we need this setContents method
    # now that we are not using contents strings
    def __init__(self, child=None):
        super().__init__()
        if child is None:
            self.children["child"] = None
        else:
            childCell = Cell.makeCell(child)
            self.children["child"] = childCell

    def setChild(self, child):
        self.setContents("", child)

    def setContents(self, newContents, newChildren):
        self.children["child"] = Cell.makeCell(newChildren)
        self.markDirty()


class Scrollable(Container):
    def __init__(self, child=None, height=None):
        super().__init__(child)
        self.exportData["height"] = height


class RootCell(Container):
    def __init__(self, child=None):
        super().__init__(child)
        self.isRoot = True

    @property
    def identity(self):
        return "page_root"

    def setChild(self, child):
        self.setContents("", child)


class Traceback(Cell):
    # TODO: It seems like the passed-in traceback
    # value might not need to be its own Cell, but
    # rather just some data that is passed to this
    # cell.
    def __init__(self, traceback):
        super().__init__()
        self.traceback = traceback
        tracebackCell = Cell.makeCell(traceback)
        self.children["traceback"] = tracebackCell

    def sortsAs(self):
        return self.traceback


class Code(Cell):
    # TODO: It looks like codeContents might not
    # need to be an actual Cell, but instead just
    # some data passed to this Cell.
    def __init__(self, codeContents):
        super().__init__()
        self.codeContents = codeContents
        codeContentsCell = Cell.makeCell(codeContents)
        self.children["code"] = codeContentsCell

    def sortsAs(self):
        return self.codeContents


class ContextualDisplay(Cell):
    """Display an arbitrary python object by checking registered display handlers"""

    # map from type -> [(ContextMatcher, displayFun)]
    _typeToDisplay = {}

    class ContextMatcher:
        """Checks if a cell matches a context dict."""

        def __init__(self, contextDict):
            """Initialize a context matcher."""
            self.contextDict = contextDict

        def matchesCell(self, cell):
            for key, value in self.contextDict.items():
                ctx = cell.getContext(key)
                if callable(value):
                    if not value(ctx):
                        return False
                else:
                    if ctx != value:
                        return False
            return True

    def __init__(self, obj):
        super().__init__()
        self.obj = obj

    def getChild(self):
        if type(self.obj) in ContextualDisplay._typeToDisplay:
            for context, dispFun in ContextualDisplay._typeToDisplay[type(self.obj)]:
                if context.matchesCell(self):
                    return dispFun(self.obj)

        if hasattr(self.obj, "cellDisplay"):
            return self.obj.cellDisplay()

        return Traceback(f"Invalid object of type {type(self.obj)}")

    def recalculate(self):
        with self.view():
            childCell = self.getChild()
            self.children["child"] = childCell
            self.exportData["objectType"] = str(type(self.obj))


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

    def rootSequenceOfOrientation(self, orientation):
        return self.parent.rootSequenceOfOrientation(orientation)

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

    def isMergedIntoParent(self):
        if "content" not in self.children:
            return False

        return self.children["content"].isMergedIntoParent()

    def getDisplayChildren(self):
        if self.isMergedIntoParent():
            return self.children["content"].getDisplayChildren()

        return self.children

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

        self.orientation = orientation
        self._mergedIntoParent = False

    def _sequenceOrientation(self):
        return self.orientation

    def isMergedIntoParent(self):
        return self._mergedIntoParent

    def getDisplayChildren(self):
        children = []

        for child in self.children["elements"]:
            if child.isMergedIntoParent():
                children.extend(child.getDisplayChildren().allChildren)
            else:
                children.append(child)

        res = Children()
        res["elements"] = children
        return res

    def getDisplayExportData(self):
        """Get the version of 'self.exportData' we should actually use.

        Cells that have children who are collapsed into their parent are responsible for
        updating things like 'flexParent' here.
        """
        exportData = dict(self.exportData)

        displayChildren = self.getDisplayChildren()
        for child in displayChildren.allChildren:
            if child.isFlex:
                exportData["flexParent"] = True

        return exportData

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
        itemCell = Cell.makeCell(self.rendererFun(item))
        wrapperCell = Subscribed(lambda: itemCell)
        wrapperCell.isFlex = itemCell.isFlex
        return wrapperCell

    def recalculate(self):
        if self.parent and not self.isFlex:
            rootSequence = self.parent.rootSequenceOfOrientation(self.orientation)
            if rootSequence is not None:
                self._mergedIntoParent = True

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


class Popover(Cell):
    # TODO: Does title actually need to be a cell here? What about detail?
    # What is the purpose of the sortAs method here and why are we using
    # it on the title cell?
    def __init__(self, contents, title, detail, width=400):
        super().__init__()

        self.width = width
        contentCell = Cell.makeCell(contents)
        detailCell = Cell.makeCell(detail)
        titleCell = Cell.makeCell(title)
        self.children.addFromDict(
            {"content": contentCell, "detail": detailCell, "title": titleCell}
        )

    def recalculate(self):
        self.exportData["width"] = self.width

    def sortsAs(self):
        if self.children.hasChildNamed("title"):
            return self.children["title"].sortAs()


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

    def prepareForReuse(self):
        if not self.garbageCollected:
            return False
        self._clearSubscriptions()
        self.existingItems = {}
        self.rows = []
        self.cols = []
        super().prepareForReuse()

    def recalculate(self):
        with self.view() as v:
            try:
                self.rows = augmentToBeUnique(self.rowFun())
            except SubscribeAndRetry:
                raise
            except Exception:
                self._logger.exception("Row fun calc threw an exception:")
                self.rows = []
            try:
                self.cols = augmentToBeUnique(self.colFun())
            except SubscribeAndRetry:
                raise
            except Exception:
                self._logger.exception("Col fun calc threw an exception:")
                self.cols = []

            self._resetSubscriptionsToViewReads(v)

        new_named_children = {"headers": [], "rowLabels": [], "dataCells": []}
        seen = set()

        for col_ix, col in enumerate(self.cols):
            seen.add((None, col))
            if (None, col) in self.existingItems:
                new_named_children["headers"].append(self.existingItems[(None, col)])
            else:
                try:
                    headerCell = Cell.makeCell(self.headerFun(col[0]))
                    self.existingItems[(None, col)] = headerCell
                    new_named_children["headers"].append(headerCell)
                except SubscribeAndRetry:
                    raise
                except Exception:
                    tracebackCell = Traceback(traceback.format_exc)()
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
                        rowLabelCell = Cell.makeCell(self.rowLabelFun(row[0]))
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
                        dataCell = Cell.makeCell(self.rendererFun(row[0], col[0]))
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


class SortWrapper:
    def __init__(self, x):
        self.x = x

    def __lt__(self, other):
        try:
            if type(self.x) is type(other.x):  # noqa: E721
                return self.x < other.x
            else:
                return str(type(self.x)) < str(type(other.x))
        except Exception:
            try:
                return str(self.x) < str(self.other)
            except Exception:
                return False

    def __eq__(self, other):
        try:
            if type(self.x) is type(other.x):  # noqa: E721
                return self.x == other.x
            else:
                return str(type(self.x)) == str(type(other.x))
        except Exception:
            try:
                return str(self.x) == str(self.other)
            except Exception:
                return True


class SingleLineTextBox(Cell):
    def __init__(self, slot, pattern=None):
        super().__init__()
        self.pattern = None
        self.slot = slot
        self.defaultValue = None

    def recalculate(self):
        if self.pattern:
            self.exportData["pattern"] = self.pattern
        self.exportData["defaultValue"] = self.getText()

    def getText(self):
        with ComputingCellContext(self):
            with self.view() as v:
                try:
                    return self.slot.get()
                finally:
                    self._resetSubscriptionsToViewReads(v)

    def onMessage(self, msgFrame):
        self.slot.set(msgFrame["text"])


class Table(Cell):
    """An active table with paging, filtering, sortable columns."""

    def __init__(
        self,
        colFun,
        rowFun,
        headerFun,
        rendererFun,
        maxRowsPerPage=20,
        sortColumn=None,
        sortColumnAscending=True,
    ):
        """
        Args:
            colFun: a function from nothing to a list of column names
            rowFun: a function from nothing to a list of row elements.
                Typically this is something like lambda: schema.Type.lookupAll()
            headerFun: usually lambda x: x
            rendererFun: a function from (row, column:str) to the value of that cell
            maxRowsPerPage (int): max number of rows per page
            sortColumn (int or None): index of column to sort (starts at 0).
            sortColumnAscending (bool): ascending or descending sorting.
        """
        super().__init__()
        self.colFun = colFun
        self.rowFun = rowFun
        self.headerFun = headerFun
        self.rendererFun = rendererFun

        self.existingItems = {}
        self.rows = []
        self.cols = []

        self.maxRowsPerPage = maxRowsPerPage

        self.curPage = Slot("1")
        self.sortColumn = Slot(sortColumn)
        self.sortColumnAscending = Slot(sortColumnAscending)
        self.columnFilters = {}

    def prepareForReuse(self):
        if not self.garbageCollected:
            return False
        self._clearSubscriptions()
        self.existingItems = {}
        self.rows = []
        self.cols = []
        super().prepareForReuse()

    def cachedRenderFun(self, row, col):
        if (row, col) in self.existingItems:
            return self.existingItems[row, col]
        else:
            return self.rendererFun(row, col)

    def filterRows(self, rows):
        for col in self.cols:
            if col not in self.columnFilters:
                self.columnFilters[col] = Slot(None)

            filterString = self.columnFilters.get(col).get()

            if filterString:
                new_rows = []
                for row in rows:
                    filterAs = self.cachedRenderFun(row, col).sortsAs()

                    if filterAs is None:
                        filterAs = ""
                    else:
                        filterAs = str(filterAs)

                    if filterString in filterAs:
                        new_rows.append(row)
                rows = new_rows

        return rows

    def sortRows(self, rows):
        sc = self.sortColumn.get()

        if sc is not None and sc < len(self.cols):
            col = self.cols[sc]

            keymemo = {}

            def key(row):
                if row not in keymemo:
                    try:
                        r = self.cachedRenderFun(row, col)
                        keymemo[row] = SortWrapper(r.sortsAs())
                    except Exception:
                        self._logger.exception("Exception in sortRows:")
                        keymemo[row] = SortWrapper(None)

                return keymemo[row]

            rows = sorted(rows, key=key)

            if not self.sortColumnAscending.get():
                rows = list(reversed(rows))

        page = 0
        try:
            page = max(0, int(self.curPage.get()) - 1)
            page = min(page, (len(rows) - 1) // self.maxRowsPerPage)
        except Exception:
            self._logger.exception("Failed to parse current page: %s")

        return rows[page * self.maxRowsPerPage : (page + 1) * self.maxRowsPerPage]

    def makeHeaderCell(self, col_ix):
        col = self.cols[col_ix]

        if col not in self.columnFilters:
            self.columnFilters[col] = Slot(None)

        def icon():
            if self.sortColumn.get() != col_ix:
                return ""
            return Octicon("arrow-up" if not self.sortColumnAscending.get() else "arrow-down")

        cell = (
            Cell.makeCell(self.headerFun(col)).nowrap()
            >> Padding()
            >> Subscribed(icon).nowrap()
        )

        def onClick():
            if self.sortColumn.get() == col_ix:
                self.sortColumnAscending.set(not self.sortColumnAscending.get())
            else:
                self.sortColumn.set(col_ix)
                self.sortColumnAscending.set(False)

        res = Clickable(cell, onClick, makeBold=True)

        if self.columnFilters[col].get() is None:
            res = (
                res.nowrap()
                >> Clickable(
                    Octicon("search"), lambda: self.columnFilters[col].set("")
                ).nowrap()
            )
        else:
            res = (
                res
                >> SingleLineTextBox(self.columnFilters[col]).nowrap()
                >> Button(Octicon("x"), lambda: self.columnFilters[col].set(None), small=True)
            )

        return Card(res, padding=1)

    def recalculate(self):
        with self.view() as v:
            try:
                self.cols = list(self.colFun())
            except SubscribeAndRetry:
                raise
            except Exception:
                self._logger.exception("Col fun calc threw an exception:")
                self.cols = []

            try:
                self.unfilteredRows = list(self.rowFun())
                self.filteredRows = self.filterRows(self.unfilteredRows)
                self.rows = self.sortRows(self.filteredRows)

            except SubscribeAndRetry:
                raise
            except Exception:
                self._logger.exception("Row fun calc threw an exception:")
                self.rows = []

            self._resetSubscriptionsToViewReads(v)

        new_named_children = {
            "headers": [],
            "dataCells": [],
            "page": None,
            "right": None,
            "left": None,
        }
        seen = set()

        for col_ix, col in enumerate(self.cols):
            seen.add((None, col))
            if (None, col) in self.existingItems:
                new_named_children["headers"].append(self.existingItems[(None, col)])
            else:
                try:
                    headerCell = self.makeHeaderCell(col_ix)
                    self.existingItems[(None, col)] = headerCell
                    new_named_children["headers"].append(headerCell)
                except SubscribeAndRetry:
                    raise
                except Exception:
                    tracebackCell = Traceback(traceback.format_exc())
                    self.existingItems[(None, col)] = tracebackCell
                    new_named_children["headers"].append(tracebackCell)

        seen = set()
        for row_ix, row in enumerate(self.rows):
            new_named_children_columns = []
            new_named_children["dataCells"].append(new_named_children_columns)
            for col_ix, col in enumerate(self.cols):
                seen.add((row, col))
                if (row, col) in self.existingItems:
                    new_named_children_columns.append(self.existingItems[(row, col)])
                else:
                    try:
                        dataCell = Cell.makeCell(self.rendererFun(row, col))
                        self.existingItems[(row, col)] = dataCell
                        new_named_children_columns.append(dataCell)
                    except SubscribeAndRetry:
                        raise
                    except Exception:
                        tracebackCell = Traceback(traceback.format_exc())
                        self.existingItems[(row, col)] = tracebackCell
                        new_named_children_columns.append(tracebackCell)

        self.children = Children()
        self.children.addFromDict(new_named_children)

        for i in list(self.existingItems):
            if i not in seen:
                del self.existingItems[i]

        totalPages = (len(self.filteredRows) - 1) // self.maxRowsPerPage + 1

        if totalPages <= 1:
            pageCell = Cell.makeCell(totalPages).nowrap()
            self.children["page"] = pageCell
        else:
            pageCell = SingleLineTextBox(self.curPage, pattern="[0-9]+").nowrap()
            self.children["page"] = pageCell
        if self.curPage.get() == "1":
            leftCell = Octicon("triangle-left", color="lightgray").nowrap()
            self.children["left"] = leftCell
        else:
            leftCell = Clickable(
                Octicon("triangle-left"),
                lambda: self.curPage.set(str(int(self.curPage.get()) - 1)),
            ).nowrap()
            self.children["left"] = leftCell
        if self.curPage.get() == str(totalPages):
            rightCell = Octicon("triangle-right", color="lightgray").nowrap()
            self.children["right"] = rightCell
        else:
            rightCell = Clickable(
                Octicon("triangle-right"),
                lambda: self.curPage.set(str(int(self.curPage.get()) + 1)),
            ).nowrap()
            self.children["right"] = rightCell

        # temporary js WS refactoring data
        self.exportData["totalPages"] = totalPages
        self.exportData["numColumns"] = len(self.cols)
        self.exportData["numRows"] = len(self.rows)


class Clickable(Cell):
    def __init__(self, content, onClick, makeBold=False, aTarget=None):
        """
        Args:
            content (Cell or something that auto-converts to a Cell): the cell to display
            onClick: str or zero-argument function that either returns a string which will be
                the link to follow, or that performs the action to be performed.
            makeBold (bool): should the text be bold
            aTarget (str): None or a target to an HTML <a> element. One of _blank, _self,
                _parent, _top, or a valid framename.
        """
        super().__init__()
        self.onClick = onClick
        self.content = Cell.makeCell(content)
        self.bold = makeBold
        if aTarget is None:
            self._jsStrTemplate = "window.location.href = '__url__'"
        else:
            self._jsStrTemplate = f"window.open('__url__', '{aTarget}')"

    def _makeJs(self, url: str):
        return quoteForJs(self._jsStrTemplate.replace("__url__", quoteForJs(url, "'")), '"')

    def calculatedOnClick(self):
        if isinstance(self.onClick, str):
            return self._makeJs(self.onClick)
        else:
            return (
                """
                cellSocket.sendString(
                    JSON.stringify({'event':'click', 'target_cell': '%s'})
                )
                """
                % self.identity
            )

    def recalculate(self):
        self.children["content"] = self.content
        self.exportData["bold"] = self.bold

        # TODO: this event handling situation must be refactored
        self.exportData["events"] = {"onclick": self.calculatedOnClick()}

    def sortsAs(self):
        return self.content.sortsAs()

    def onMessage(self, msgFrame):
        val = self.onClick if isinstance(self.onClick, str) else self.onClick()
        if isinstance(val, str):
            self.triggerPostscript(self._makeJs(val))


class Button(Clickable):
    def __init__(self, *args, small=False, active=True, style="primary", **kwargs):
        Clickable.__init__(self, *args, **kwargs)
        self.small = small
        self.active = active
        self.style = style

    def recalculate(self):
        self.children["content"] = self.content

        isActive = False
        if self.active:
            isActive = True

        # temporary js WS refactoring data
        self.exportData["small"] = self.small
        self.exportData["active"] = isActive
        self.exportData["style"] = self.style

        # TODO: this event handling situation must be refactored
        self.exportData["events"] = {"onclick": self.calculatedOnClick()}


class ButtonGroup(Cell):
    def __init__(self, buttons):
        super().__init__()
        self.buttons = buttons

    def recalculate(self):
        self.children["buttons"] = self.buttons


class LoadContentsFromUrl(Cell):
    # TODO: Determine the real need / purpose of
    # this cell. In the future WS system, we can
    # simply send this as a message and it can be
    # at the most a non-display kind of Cell that
    # sends a WS command when it first gets created
    def __init__(self, targetUrl):
        Cell.__init__(self)
        self.targetUrl = targetUrl

    def recalculate(self):
        self.exportData["loadTargetId"] = "loadtarget%s" % self._identity

        self.postscript = "$('#loadtarget__identity__').load('__url__')".replace(
            "__identity__", self._identity
        ).replace("__url__", quoteForJs(self.targetUrl, "'"))


class SubscribeAndRetry(Exception):
    def __init__(self, callback):
        super().__init__("SubscribeAndRetry")
        self.callback = callback


def ensureSubscribedType(t, lazy=False):
    if not current_transaction().db().isSubscribedToType(t):
        raise SubscribeAndRetry(
            Timer("Subscribing to type %s%s", t, " lazily" if lazy else "")(
                lambda db: db.subscribeToType(t, lazySubscription=lazy)
            )
        )


def ensureSubscribedSchema(t, lazy=False):
    if not current_transaction().db().isSubscribedToSchema(t):
        raise SubscribeAndRetry(
            Timer("Subscribing to schema %s%s", t, " lazily" if lazy else "")(
                lambda db: db.subscribeToSchema(t, lazySubscription=lazy)
            )
        )


class Expands(Cell):
    # TODO: Do the icons really need to be their own Cell objects?
    # In fact, does Octicon need to be its own Cell class/object at all,
    # considering it is a styling/visual issue that can
    # more easily be handled by passing names to the front end?
    def __init__(self, closed, open, closedIcon=None, openedIcon=None):
        super().__init__()
        self.closed = closed
        self.open = open
        self.openedIcon = openedIcon or Octicon("diff-removed")
        self.closedIcon = closedIcon or Octicon("diff-added")

        # if we get 'isExpanded' written to before we get calculated, we write here.
        self.toWrite = None

    @property
    def isExpanded(self):
        if self.toWrite is not None:
            return self.toWrite

        if self.cells is None:
            return False

        return self.getContext(SessionState).get(self.identityPath + ("ExpandState",)) or False

    @isExpanded.setter
    def isExpanded(self, isExpanded):
        if self.cells is None:
            self.toWrite = isExpanded
            return

        return self.getContext(SessionState).set(
            self.identityPath + ("ExpandState",), bool(isExpanded)
        )

    def sortsAs(self):
        if self.isExpanded:
            return self.open.sortsAs()
        return self.closed.sortsAs()

    def recalculate(self):
        if self.toWrite is not None:
            self.isExpanded = self.toWrite
            self.toWrite = None

        inlineScript = (
            "cellSocket.sendString(JSON.stringify({'event':'click', 'target_cell': '%s'}))"
            % self.identity
        )

        self.children.addFromDict(
            {
                "content": self.open if self.isExpanded else self.closed,
                "icon": self.openedIcon if self.isExpanded else self.closedIcon,
            }
        )

        # TODO: Refactor this. We shouldn't need to send
        # an inline script!
        self.exportData["events"] = {"onclick": inlineScript}
        self.exportData["isOpen"] = self.isExpanded

        for c in self.children.allChildren:
            if c.cells is not None:
                c.prepareForReuse()

    def onMessage(self, msgFrame):
        self.isExpanded = not self.isExpanded


class CodeEditor(Cell):
    """Produce a code editor."""

    def __init__(
        self,
        keybindings=None,
        noScroll=False,
        minLines=None,
        fontSize=None,
        readOnly=False,
        autocomplete=True,
        onTextChange=None,
        firstVisibleRow=None,
        onFirstRowChange=None,
        onSelectionChanged=None,
        textToDisplayFunction=lambda: "",
        mouseoverTimeout=1000,
        onMouseover=None,
    ):
        """Create a code editor

        Parameters
        ----------

        keybindings: map
            map from keycode to a lambda function that will receive
            the current buffer and the current selection range when the user
            types ctrl-X and 'X' is a valid keycode. Common values here are also
            'Enter' and 'space'

        You may call 'setContents' to override the current contents of the editor.
        This version is not robust to mutiple users editing at the same time.

        onTextChange: func
            called when the text buffer changes with the new buffer
            and a json selection.

        textToDisplayFunction: func
            a function of no arguments that should return
            the current text we _ought_ to be displaying.

        onFirstRowChange - a function that is called when the first visible row
            changes. It takes one argument which is said row.

        onSelectionChanged - a function that is called when the selection changes.
            It gets called with None, or a dict with start_row, end_row, start_column,
            end_column.

        mouseoverTimeout - timeout for mouseover callback WS message in
            milliseconds

        onMouseover = a function which is called subsequent to the mouseover
            event fires on the client side and corresponding WS message is
            received.The entire message is passed to the function.
        """
        super().__init__()
        # contains (current_iteration_number: int, text: str)
        self.currentIteration = 0
        self.keybindings = keybindings or {}
        self.noScroll = noScroll
        self.fontSize = fontSize
        self.minLines = minLines
        self.readOnly = readOnly
        self.autocomplete = autocomplete
        self.onTextChange = onTextChange
        self.onSelectionChanged = onSelectionChanged
        self.textToDisplayFunction = textToDisplayFunction
        self.mouseoverTimeout = mouseoverTimeout
        self.onMouseover = onMouseover

        # All CodeEditors will be
        # flexed inside of Sequences,
        # and will cause parent Sequences
        # to become flex parent
        self.isFlex = True
        self.exportData["flexChild"] = True
        self.onFirstRowChange = onFirstRowChange

        if firstVisibleRow is not None:
            self.firstVisibleRowOverride = firstVisibleRow
        else:
            self.firstVisibleRowOverride = None

    def onMessage(self, msgFrame):
        if msgFrame["event"] == "keybinding":
            self.keybindings[msgFrame["key"]](msgFrame["buffer"], msgFrame["selection"])

        elif msgFrame["event"] == "editing":
            if (
                msgFrame["iteration"] is not None
                and self.currentIteration < msgFrame["iteration"]
            ):
                if msgFrame["buffer"] is not None:
                    self.exportData["initialText"] = msgFrame["buffer"]
                    self.currentIteration = msgFrame["iteration"]

                    if self.onTextChange:
                        self.onTextChange(msgFrame["buffer"], msgFrame["selection"])

                self.selectionSlot.set(msgFrame["selection"])

                if self.onSelectionChanged:
                    self.onSelectionChanged(msgFrame["selection"])

        elif msgFrame["event"] == "scrolling":
            self.firstVisibleRowSlot.set(msgFrame["firstVisibleRow"])
            if self.onFirstRowChange is not None:
                self.onFirstRowChange(msgFrame["firstVisibleRow"])
        elif msgFrame["event"] == "mouseover":
            if self.onMouseover is not None:
                self.onMouseover(msgFrame)

    def setFirstVisibleRow(self, rowNum):
        """ Send a message to set the first visible row of the editor to
        rowNum.

        Parameters
        ----------
        rowNum : int
        """
        self.firstVisibleRowSlot.set(rowNum)

        dataInfo = {"firstVisibleRow": rowNum}
        # stage this piece of data to be sent when we recalculate
        if self.exportData.get("dataInfo") is None:
            self.exportData["dataInfo"] = [dataInfo]
        else:
            self.exportData["dataInfo"].append(dataInfo)

        self.wasDataUpdated = True
        self.markDirty()

    def setSelection(self, selection):
        """ Send a message to set the first visible row of the editor to
        rowNum.

        Args:
            selection - a dict(
                start=dict(row=int, column=int),
                end=dict(row=int, column=int)
            )

            indicating what our selection state should be
        """
        assert isinstance(selection, dict)
        selection = dict(
            start=dict(row=selection["start"]["row"], column=selection["start"]["column"]),
            end=dict(row=selection["end"]["row"], column=selection["end"]["column"]),
        )

        self.selectionSlot.set(selection)

        dataInfo = {"selection": selection}

        if self.exportData.get("dataInfo") is None:
            self.exportData["dataInfo"] = [dataInfo]
        else:
            self.exportData["dataInfo"].append(dataInfo)

        self.wasDataUpdated = True
        self.markDirty()

    def setMarkers(self, markers):
        """Set the list of markers.

        Each marker must be a dict with:
            startRow
            endRow (optional)
            startColumn (optional)
            endColumn (only if startColumn)
            color (red, blue, green)
            label
        """
        res = []
        for m in markers:
            sm = {}
            sm["startRow"] = int(m["startRow"])
            sm["endRow"] = int(m.get("endRow", sm["startRow"]))
            sm["startColumn"] = int(m.get("startColumn", 0))
            sm["endColumn"] = int(m.get("endColumn", 1000))
            sm["color"] = m.get("color", "red")
            assert sm["color"] in ["red", "blue", "green"]
            if m.get("label"):
                sm["label"] = str(m.get("label"))
            res.append(sm)

        if self.exportData.get("dataInfo") is None:
            self.exportData["dataInfo"] = [{"updateMarkers": True, "markers": res}]
        else:
            self.exportData["dataInfo"].append({"updateMarkers": True, "markers": res})

        if self.cells is not None:
            self.wasDataUpdated = True

        self.markDirty()

    def focusEditor(self):
        """ Send a message to focus the editor immediately. """
        dataInfo = {"focusNow": True}
        # stage this piece of data to be sent when we recalculate
        if self.exportData.get("dataInfo") is None:
            self.exportData["dataInfo"] = [dataInfo]
        else:
            self.exportData["dataInfo"].append(dataInfo)

        self.wasDataUpdated = True
        self.markDirty()

    def setCurrentTextFromServer(self, text):
        if text is None:
            text = ""

        # prevent firing an event to the client if the text isn't actually
        # different than what we know locally.
        if text == self.exportData["initialText"]:
            return

        self.exportData["initialText"] = text

        self.currentIteration += 1000000

        self.triggerPostscript(
            """
            aceEditorComponents['editor__identity__'].setTextFromServer(
                __iteration__,
                "__text__",
            )
            """.replace(
                "__identity__", self.identity
            )
            .replace("__text__", quoteForJs(text, '"'))
            .replace("__iteration__", str(self.currentIteration))
        )

    def updateFromCallback(self):
        self.setCurrentTextFromServer(self.calculateCurrentText())

    def subscribedSlotChanged(self, slot):
        """Override the way we respond to a slot changing.

        Instead of recalculating, which would rebuild the component, we
        simply send a message to the server. Eventually this will used the 'data changed'
        channel
        """
        # we can't calculate this directly because we're on a message processing thread
        self.cells.scheduleCallback(self.updateFromCallback)

    def subscribedOdbValueChanged(self, odbKey):
        """Override the way we respond to an odb value changing.

        Instead of recalculating, which would rebuild the component, we
        simply send a message to the server. Eventually this will used the 'data changed'
        channel
        """
        # we can't calculate this directly because we're on a message processing thread
        self.cells.scheduleCallback(self.updateFromCallback)

    def calculateCurrentText(self):
        """Calculate the text we're supposed to display (according to the server)

        as part of this change, look at which values changed and make sure we subscribe
        correctly to them.
        """
        with ComputingCellContext(self):
            with self.view() as v:
                try:
                    return self.textToDisplayFunction()
                finally:
                    self._resetSubscriptionsToViewReads(v)

    @property
    def selectionSlot(self):
        return sessionState()._slotFor(self.identityPath + ("CodeEditorState",))

    @property
    def firstVisibleRowSlot(self):
        return sessionState()._slotFor(self.identityPath + ("CodeEditorStateFirstVisibleRow",))

    def recalculate(self):
        if self.firstVisibleRowOverride is not None:
            self.firstVisibleRowSlot.set(self.firstVisibleRowOverride)
            self.firstVisibleRowOverride = None

        self.exportData["initialText"] = self.calculateCurrentText()
        self.exportData["currentIteration"] = self.currentIteration
        self.exportData[
            "initialSelection"
        ] = self.selectionSlot.getWithoutRegisteringDependency()
        self.exportData["autocomplete"] = self.autocomplete
        self.exportData["noScroll"] = self.noScroll
        self.exportData["readOnly"] = self.readOnly

        if self.fontSize is not None:
            self.exportData["fontSize"] = self.fontSize
        if self.minLines is not None:
            self.exportData["minLines"] = self.minLines

        self.exportData[
            "firstVisibleRow"
        ] = self.firstVisibleRowSlot.getWithoutRegisteringDependency()

        self.exportData["mouseoverTimeout"] = self.mouseoverTimeout

        self.exportData["keybindings"] = [k for k in self.keybindings.keys()]


class Plot(Cell):
    """Produce some reactive line plots."""

    def __init__(self, plotDataGenerator, xySlot=None):
        """Initialize a line plot.

        plotDataGenerator: a function that produces plot data to pass to plotly.
            the function should return a tuple with two values: (data, layout), where
            'data' contains a list of trace objects to be passed to plotly, and 'layout'
            contains a dictionary of layout values to be merged into the layout we pass
            into plotly.
        """
        super().__init__()

        self.plotDataGenerator = plotDataGenerator
        self.curXYRanges = xySlot or Slot(None)
        self.error = Slot(None)

    def recalculate(self):
        chartUpdaterCell = Subscribed(lambda: _PlotUpdater(self))
        errorCell = Subscribed(
            lambda: Traceback(self.error.get()) if self.error.get() is not None else Text("")
        )
        self.children.addFromDict({"chartUpdater": chartUpdaterCell, "error": errorCell})
        self.postscript = ""

    def onMessage(self, msgFrame):
        d = msgFrame["data"]
        curVal = self.curXYRanges.get() or ((None, None), (None, None))

        self.curXYRanges.set(
            (
                (d.get("xaxis.range[0]", curVal[0][0]), d.get("xaxis.range[1]", curVal[0][1])),
                (d.get("yaxis.range[0]", curVal[1][0]), d.get("yaxis.range[1]", curVal[1][1])),
            )
        )

        self.cells._logger.info("User navigated plot to %s", self.curXYRanges.get())

    def setXRange(self, low, high):
        curXY = self.curXYRanges.getWithoutRegisteringDependency()
        self.curXYRanges.set(((low, high), curXY[1] if curXY else (None, None)))

        self.triggerPostscript(
            f"""
            plotDiv = document.getElementById('plot__identity__');
            newLayout = plotDiv.layout

            if (typeof(newLayout.xaxis.range[0]) === 'string') {{
                formatDate = function(d) {{
                    return (d.getYear() + 1900) +
                            "-" + ("00" + (d.getMonth() + 1)).substr(-2) +
                            "-" + ("00" + d.getDate()).substr(-2) +
                            " " + ("00" + d.getHours()).substr(-2) +
                            ":" + ("00" + d.getMinutes()).substr(-2) +
                            ":" + ("00" + d.getSeconds()).substr(-2) +
                            "." + ("000000" + d.getMilliseconds()).substr(-3)
                    }};

                newLayout.xaxis.range[0] = formatDate(new Date({low*1000}));
                newLayout.xaxis.range[1] = formatDate(new Date({high*1000}));
                newLayout.xaxis.autorange = false;
            }} else {{
                newLayout.xaxis.range[0] = {low};
                newLayout.xaxis.range[1] = {high};
                newLayout.xaxis.autorange = false;
            }}


            plotDiv.is_server_defined_move = true;
            Plotly.react(plotDiv, plotDiv.data, newLayout);
            plotDiv.is_server_defined_move = false;

            console.log("cells.Plot: range for 'plot__identity__' is now " +
                plotDiv.layout.xaxis.range[0] + " to " + plotDiv.layout.xaxis.range[1])

            """.replace(
                "__identity__", self._identity
            )
        )


class _PlotUpdater(Cell):
    """Helper utility to push data into an existing line plot."""

    def __init__(self, linePlot):
        super().__init__()

        self.linePlot = linePlot
        self.plotDataGenerator = linePlot.plotDataGenerator
        self.chartId = linePlot._identity
        self.exportData["plotId"] = self.chartId

    def calculatedDataJson(self):
        traces, layout = self.plotDataGenerator()

        assert isinstance(traces, list)
        assert isinstance(layout, dict)

        return [self.recursivelyEncodeNumpyArrays(trace) for trace in traces], layout

    def recursivelyEncodeNumpyArrays(self, trace):
        if isinstance(trace, dict):
            res = {}

            for k, v in trace.items():
                res[k] = self.recursivelyEncodeNumpyArrays(v)

            return res
        elif isinstance(trace, list):
            res = []
            for v in trace:
                res.append(self.recursivelyEncodeNumpyArrays(v))

            return res
        elif isinstance(trace, numpy.ndarray):
            if trace.dtype == numpy.int64:
                traceType = "s64"
            elif trace.dtype == numpy.int32:
                traceType = "s32"
            elif trace.dtype == numpy.int16:
                traceType = "s16"
            elif trace.dtype == numpy.int8:
                traceType = "s08"
            elif trace.dtype == numpy.uint64:
                traceType = "u64"
            elif trace.dtype == numpy.uint32:
                traceType = "u32"
            elif trace.dtype == numpy.uint16:
                traceType = "u16"
            elif trace.dtype == numpy.uint8:
                traceType = "u08"
            elif trace.dtype == numpy.float64:
                traceType = "f64"
            elif trace.dtype == numpy.float32:
                traceType = "f32"
            else:
                trace = trace.astype("float32")
                traceType = "f32"

            return f"__hexencoded_{traceType}__" + trace.tostring().hex()
        else:
            return trace

    def recalculate(self):
        with self.view() as v:
            # we only exist to run our postscript
            self.postscript = ""
            self.linePlot.error.set(None)

            # temporary js WS refactoring data
            self.exportData["exceptionOccured"] = False

            try:
                jsonDataToDraw = self.calculatedDataJson()
                self.exportData["plotData"] = jsonDataToDraw
            except SubscribeAndRetry:
                raise
            except Exception:
                # temporary js WS refactoring data
                self.exportData["exceptionOccured"] = True

                self._logger.exception("Exception in recalculate")
                self.linePlot.error.set(traceback.format_exc())

            self._resetSubscriptionsToViewReads(v)


class Timestamp(Cell):
    """Display current time zone."""

    def __init__(self, timestamp):
        """
        Parameters:
        ----------
        timestamp: float
            time from epoch
        """
        super().__init__()
        assert isinstance(timestamp, (float, int)), (
            "expected time since " "epoch float or int for" " 'timestamp' argument."
        )
        self.timestamp = timestamp

    def recalculate(self):
        self.exportData["timestamp"] = self.timestamp


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


class SizedPanel(Cell):
    """SizedPanel Cell

    This cell is exactly like a Panel, except
    that it takes explicit width and height
    values (in pixels)

    Properties
    ----------
    content: Cell
        A child cell that will be displayed within
        the bordered Panel area.
    width: int
        The width of the Panel, in pixels
    height: int
        The height of the Panel, in pixels
    """

    def __init__(self, content, width=100, height=100, border=True):
        """
        Parameters
        ----------
        content: Cell
            A child cell that will be displyed
            within the bordered Panel area.
            Will be set on instance as `content`
            property.
        width: int
            The desired width of the panel, in pixels
        height: int
            The desired height of the panel, in pixels
        border: bool
            If True, produce a border and padding. Otherwise, just use this as a grouping
            element in the display.
        """
        super().__init__()

        self.content = Cell.makeCell(content)
        self.width = width
        self.height = height
        self.applyBorder = border

    def recalculate(self):
        self.exportData["applyBorder"] = self.applyBorder
        self.exportData["width"] = self.width
        self.exportData["height"] = self.height
        self.children["content"] = Cell.makeCell(self.content)


class Highlighted(Cell):
    """Highlighted

    This cell acts as a generic, highlighted container.
    It has a single child Cell element which is displayed.

    Properties
    ----------
    content: Cell
        A child cell that will be displayed within
        the bordered Panel area.
    """

    def __init__(self, content):
        super().__init__()
        self.content = Cell.makeCell(content)

    def recalculate(self):
        self.children["content"] = Cell.makeCell(self.content)


class WSMessageTester(Cell):
    """A helper cell to test cell methods interactively in the browser."""

    def __init__(
        self,
        methodToRun=None,
        WSMessageToSend=None,
        messageType="cellDataUpdated",
        onCallbackFunc=None,
        **kwargs,
    ):
        """
        Parameters:
        ----------
            methodToRun: cell method
                The method of an initialized cell to run when the
                WSMessageTester button is clicked.
            WSMessageToSend : dict
                If provided will send this message across the WS instead of
                envoking methodToRun
            messageType : str
                The WS message type to send; either 'cellDataUpdated'
                or 'cellDataRequested'
            onCallbackFunc : func
                If provided will be called on the msgFrame returned from the
                client.
            kwargs: cell method kwargs

        """
        super().__init__()
        if onCallbackFunc is not None and WSMessageToSend is None:
            raise "you must provided a WSMessageToSend for onCallbackFunc"
        assert messageType in ["cellDataUpdated", "cellDataRequested"]
        self.content = "Go!"
        self.content = Cell.makeCell(self.content)
        self.methodToRun = methodToRun
        self.WSMessageToSend = WSMessageToSend
        self.messageType = messageType
        self.onCallbackFunc = onCallbackFunc
        self.kwargs = kwargs

    def onMessage(self, msgFrame):
        if msgFrame["event"] == "click":
            if self.methodToRun is not None:
                # Run the method...
                self.methodToRun(**self.kwargs)
                # ... and let the client know what you ran
                dataInfo = {
                    "event": "WSTest",
                    "method": str(self.methodToRun),
                    "args": self.kwargs,
                }
                self.wasDataUpdated = True
            elif self.WSMessageToSend is not None:
                if self.messageType == "cellDataUpdated":
                    self.wasDataUpdated = True
                elif self.messageType == "cellDataRequested":
                    self.wasDataRequested = True
                dataInfo = self.WSMessageToSend
            self.exportData["dataInfo"] = [dataInfo]
            self.markDirty()
        else:
            if self.onCallbackFunc is not None:
                self.onCallbackFunc(msgFrame)

    def recalculate(self):
        self.children["content"] = self.content
