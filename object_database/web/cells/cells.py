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

import queue
import time
import traceback
import logging
import types

from object_database.web.cells.session_state import SessionState
from object_database.web.cells.cell import Cell
from object_database.web.cells.slot import Slot
from object_database.web.cells.computed_slot import ComputedSlot
from object_database.web.cells.root_cell import RootCell
from object_database.web.cells.dependency_context import DependencyContext
from object_database.web.cells.recomputing_cell_context import RecomputingCellContext
from object_database.web.cells.cells_context import CellsContext
from object_database.web.cells.reactor import Reactor


class CellDependencies:
    def __init__(self):
        """Track the dependencies of a set of cells and computed slots.

        Cells divides the world into two kinds of objects: "state" such as Slot objects and
        the ODB, and 'calculations' that depend on the state, which are the cells tree and
        ComputedSlot objects.

        The state of the system, when everything has finished calculating, is a DAG:
            * the root cell is the top of the dag
            * there is a subtree of cells below it, each of whose properties and children
                is a deterministic function of the state of the system
            * each cell may depend on the state of a collection of computed slots, each of
                which must also be up to date.
            * leaves of the dag are
                * slot objects
                * the ODB

        As a result, the calculated state of a 'cell' object or a computed slot will depend on
        a set of slots, odb values, and other computed slot objects.
        """
        # map from cell/computed slot to direct ODB dependencies
        self._subscriptions = {}

        self._cellReactors = {}

        # map from direct ODB key to set of cell / computed slots
        self._subscribedCells = {}

        # map from cell/computed slot to the set of slots (computed or otherwise) it read
        self._slotsRead = {}

        # map from slot to the set of cells / slots that are reading it
        self._slotToReaders = {}

        # set of computed slot objects that are dirty, and are in the calculation graph
        self._dirtyComputedSlots = set()

        # set of cells that are dirty
        self._dirtyNodes = set()

        self._dirtyReactors = set()

    def updateCellReactors(self, cell):
        if not cell.reactors and cell not in self._cellReactors:
            return

        oldReactors = self._cellReactors.get(cell, set())
        self._cellReactors[cell] = cell.reactors

        if not self._cellReactors[cell]:
            self._cellReactors.pop(cell)

        newReactors = cell.reactors

        for reactor in newReactors - oldReactors:
            self._dirtyReactors.add(reactor)

        for reactor in oldReactors - newReactors:
            self.calculationDiscarded(reactor)

    def calculationDiscarded(self, calculation):
        """Indicate that a cell or slot is garbage collected"""
        self._dirtyComputedSlots.discard(calculation)
        self._dirtyReactors.discard(calculation)

        subscriptions = self._subscriptions.pop(calculation, set())
        slots = self._slotsRead.pop(calculation, set())

        for key in subscriptions:
            self._subscribedCells[key].discard(calculation)
            if not self._subscribedCells[key]:
                self._subscribedCells.pop(key)

        for slot in slots:
            self._slotToReaders[slot].discard(calculation)
            if not self._slotToReaders[slot]:
                self._slotToReaders.pop(slot)

                if isinstance(slot, ComputedSlot):
                    self.calculationDiscarded(slot)
                    slot.orphan()

        for reactor in self._cellReactors.pop(calculation, []):
            self.calculationDiscarded(reactor)

    def updateDependencies(self, calculation, dependencyContext):
        """Update the dependencies of a cell or slot"""
        subscriptions = dependencyContext.subscriptions
        slots = dependencyContext.slotsRead

        existingSubscriptions = self._subscriptions.get(calculation, set())
        self._subscriptions[calculation] = subscriptions

        newSubscriptions = subscriptions - existingSubscriptions
        droppedSubscriptions = existingSubscriptions - subscriptions

        for key in newSubscriptions:
            self._subscribedCells.setdefault(key, set()).add(calculation)

        for key in droppedSubscriptions:
            self._subscribedCells[key].discard(calculation)
            if not self._subscribedCells[key]:
                self._subscribedCells.pop(key)

        existingSlots = self._slotsRead.get(calculation, set())
        self._slotsRead[calculation] = slots

        newSlots = slots - existingSlots
        droppedSlots = existingSlots - slots

        for slot in newSlots:
            self._slotToReaders.setdefault(slot, set()).add(calculation)

        for slot in droppedSlots:
            self._slotToReaders[slot].discard(calculation)
            if not self._slotToReaders[slot]:
                self._slotToReaders.pop(slot)

                if isinstance(slot, ComputedSlot):
                    self.calculationDiscarded(slot)
                    slot.orphan()

        self._dirtyComputedSlots.discard(calculation)
        self._dirtyNodes.discard(calculation)

    def updateFromWriteableDependencyContext(self, context):
        self.markSlotsDirty(set(context.writtenSlotOriginalValues))
        self.odbValuesChanged(set(context.odbKeysWritten))

    def markSlotsDirty(self, slots):
        """Some state-change modified the values in a collection of slots."""
        for slot in slots:
            for calculation in self._slotToReaders.get(slot, set()):
                self._markCalcDirty(calculation)

    def odbValuesChanged(self, keys):
        for key in keys:
            for calculation in self._subscribedCells.get(key, set()):
                self._markCalcDirty(calculation)

    def recalculateDirtyComputedSlots(self, db):
        # this is not the most efficient way of doing this - we could do better...
        while self._dirtyComputedSlots:
            aSlot = self._dirtyComputedSlots.pop()

            aSlot.ensureCalculated()

    def recalculateDirtyReactors(self, db):
        """Recalculate reactors in a loop until none are dirty.

        Returns:
            True if we updated anything.
        """
        if not self._dirtyReactors:
            return False

        while self._dirtyReactors:
            aReactor = self._dirtyReactors.pop()

            depContext = DependencyContext(db, readOnly=False)

            def updateIt():
                aReactor.applyStateChange()

            result = depContext.calculate(updateIt)

            if result[0]:
                logging.error(
                    "Effect %s threw exception %s:\n\n%s",
                    aReactor,
                    result[1],
                    "".join(traceback.format_tb(result[1].__traceback__)),
                )

            self.updateDependencies(aReactor, depContext)

            # now register its writes. This may trigger it again!
            self.updateFromWriteableDependencyContext(depContext)

        return True

    def markCellDirty(self, cell):
        self._dirtyNodes.add(cell)

    def _markCalcDirty(self, calculation):
        if isinstance(calculation, ComputedSlot):
            self._dirtyComputedSlots.add(calculation)
            calculation.markDirty()
        elif isinstance(calculation, Cell):
            self._dirtyNodes.add(calculation)
        elif isinstance(calculation, Reactor):
            self._dirtyReactors.add(calculation)
        else:
            raise Exception("Invalid calculation found")


class Cells:
    def __init__(self, db):
        self.db = db

        self._eventHasTransactions = queue.Queue()

        self.db.registerOnTransactionHandler(self._onTransaction)

        # map: Cell.identity ->  Cell
        self._cells = {}

        # set: type(Cell) that have been sent over the wire
        self._nonbuiltinCellTypes = set()

        # map: Cell.identity -> set(Cell)
        self._cellsKnownChildren = {}

        # map: Cell.identity -> Cell
        # all 'effect' cells
        self._effects = {}

        # a CellDependencies object that tracks the current calculation dependency graph
        self._dependencies = CellDependencies()

        # set(Cell)
        self._nodesToBroadcast = set()

        # set(Cell.identity)
        self._nodeIdsToDiscard = set()

        # set(Cell)
        self._focusableCells = set()

        self._sessionId = None

        # set(Cell.identity) - the set of identities we've sent in prior
        # updates
        self._nodesKnownToChannel = set()

        self._transactionQueue = queue.Queue()

        # used by _newID to generate unique identifiers
        self._id = 1

        # a list of pending callbacks that want to run on the main thread
        self._callbacks = queue.Queue()

        # cell identity to list of json messages to process in each cell object
        self._pendingOutgoingMessages = {}

        # the next packetId we'll return
        self._packetId = 1

        # map from packetId to the callback that produces the packet data
        self._packetCallbacks = {}

        # the cell that currently has the focus
        self.focusedCell = Slot(None)

        # an ever-increasing 'eventId' that we can use to handle the race between
        # the user changing focus and the server sending an old focus
        self.focusEventId = 1

        self._root = RootCell()

        self._addCell(self._root, parent=None)

    def onMessage(self, message):
        """Called when the CellHandler sends a message _directly_ to 'cells'."""
        if message.get("event") == "focusChanged":
            eventId = message.get("eventId")
            if eventId > self.focusEventId:
                cellId = message.get("cellId")

                cell = self._cells.get(cellId)

                self.focusedCell.set(cell)
                self.focusEventId = eventId

                if cell is not None:
                    cell.mostRecentFocusId = self.focusEventId

    def changeFocus(self, newCell):
        """Trigger a server-side focus change."""
        self._eventHasTransactions.put(1)

        if DependencyContext.get() is None:
            # this can happen when we are installing a cell
            with CellsContext(self):
                context = DependencyContext(self.db, readOnly=False)
                context.calculate(lambda: self.focusedCell.set(newCell))
        else:
            self.focusedCell.set(newCell)

        self.focusEventId += 1000

        if newCell is not None:
            newCell.mostRecentFocusId = self.focusEventId

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
        processed = 0
        t0 = time.time()

        try:
            while True:
                callback = self._callbacks.get(block=False)
                processed += 1

                context = DependencyContext(self.db, readOnly=False)

                with CellsContext(self):
                    result = context.calculate(callback)

                self._dependencies.updateFromWriteableDependencyContext(context)

                if result[0]:
                    logging.warn(
                        "Callback %s threw an exception: %s\n\n%s",
                        callback,
                        result[1],
                        "".join(traceback.format_tb(result[1].__traceback__)),
                    )

        except queue.Empty:
            return
        finally:
            if processed:
                logging.info(
                    "Processed %s callbacks in %s seconds", processed, time.time() - t0
                )

    def scheduleCallback(self, callback):
        """Schedule a callback to execute on the main cells thread as soon as possible.

        Code in other threads shouldn't modify cells or slots.
        Cells that want to trigger asynchronous work can do so and then push
        content back into Slot objects using these callbacks.
        """
        self._callbacks.put(callback)
        self._eventHasTransactions.put(1)

    def markPendingMessage(self, cell, message):
        self.markPendingMessages(cell, [message])

    def markPendingMessages(self, cell, message):
        wasEmpty = len(self._pendingOutgoingMessages) == 0

        messagesToSend = self._pendingOutgoingMessages.setdefault(cell.identity, [])

        messagesToSend.extend(message)

        if wasEmpty:
            self._eventHasTransactions.put(1)

    def withRoot(self, root_cell, session_state=None):
        self._root.setChild(root_cell)
        self._root.setContext(
            SessionState, session_state or self._root.context.get(SessionState)
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
        if self._dependencies._dirtyNodes:
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
        """Given the updates coming from a transaction, update self._subscribedCells."""
        self._dependencies.odbValuesChanged(set(key_value) | set(set_adds) | set(set_removes))

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

        if cell.FOCUSABLE:
            self._focusableCells.add(cell)

    def _cellOutOfScope(self, cell):
        for c in cell.children.allChildren:
            self._cellOutOfScope(c)

        self.markToDiscard(cell)

        if cell.cells is not None:
            assert cell.cells == self
            del self._cells[cell.identity]
            del self._cellsKnownChildren[cell.identity]
            self._dependencies.calculationDiscarded(cell)

        cell.garbageCollected = True

    def markDirty(self, cell):
        assert not cell.garbageCollected
        self._dependencies.markCellDirty(cell)

    def markToDiscard(self, cell):
        assert not cell.garbageCollected

        if cell.identity in self._nodesKnownToChannel:
            self._nodeIdsToDiscard.add(cell.identity)

        self._nodesToBroadcast.discard(cell)
        self._focusableCells.discard(cell)

        cell.onRemovedFromTree()

    def markToBroadcast(self, node):
        assert node.cells is self

        self._nodesToBroadcast.add(node)

    def dumpTree(self, cell=None, indent=0):
        print(" " * indent + str(cell))
        for child in cell.children.allChildren:
            self.dumpTree(child, indent + 2)

    def pickFocusedCell(self):
        """Pick the most recently focused focusable cell."""
        if not self._focusableCells:
            return

        return sorted(
            self._focusableCells,
            key=lambda cell: (cell.mostRecentFocusId or -1, str(cell.identity)),
        )[-1]

    def _updateFocusedCell(self):
        context = DependencyContext(self.db, readOnly=False)

        def updateFocusedCell():
            focusedCell = self.focusedCell.get()

            if focusedCell and focusedCell.identity in self._nodeIdsToDiscard:
                self.focusedCell.set(self.pickFocusedCell())
                self.focusEventId += 1

            return self.focusedCell.get()

        result = context.calculate(updateFocusedCell)

        if result[0]:
            raise result[1]

        self._dependencies.updateFromWriteableDependencyContext(context)

        return result[1]

    def renderMessages(self):
        self._processCallbacks()
        self._recalculateCells()
        focusedCell = self._updateFocusedCell()

        packet = dict(
            # indicate that this is one complete cell frame
            type="#frame",
            # list of cell identities that were discarded
            nodesToDiscard=[],
            # map from cellId -> cell update
            # each update contains the properties, children, and named
            # children that have changed
            nodesUpdated={},
            # for any new nodes, the complete body of the node
            nodesCreated={},
            # messages: dict from cell-id to []
            messages={},
            # new cell types: list of [(javascript, css)]
            dynamicCellTypeDefinitions=[],
            focusedCellId=focusedCell.identity if focusedCell else None,
            focusedCellEventId=self.focusEventId,
        )

        for node in self._nodesToBroadcast:
            # assert that the parent of each child is either in this set, or is known
            # to the other side of the connection
            if node.parent is None:
                assert isinstance(node, RootCell)
            else:
                assert (
                    node.parent in self._nodesToBroadcast
                    or node.parent.identity in self._nodesKnownToChannel
                )

        for node in self._nodesToBroadcast:
            if not node.isBuiltinCell():
                if type(node) not in self._nonbuiltinCellTypes:
                    self._nonbuiltinCellTypes.add(type(node))
                    packet["dynamicCellTypeDefinitions"].append(
                        (type(node).getDefinitionalJavascript(), type(node).getCssRules())
                    )

            if node.identity not in self._nodesKnownToChannel:
                self._nodesKnownToChannel.add(node.identity)

                packet["nodesCreated"][node.identity] = dict(
                    cellType=node.cellJavascriptClassName(),
                    extraData=node.getDisplayExportData(),
                    children=node.children.namedChildIdentities(),
                    parent=node.parent.identity if node.parent is not None else None,
                )
            else:
                packet["nodesUpdated"][node.identity] = dict(
                    extraData=node.getDisplayExportData(),
                    children=node.children.namedChildIdentities(),
                )

            # check that every node we're sending is either known
            # already, or in the broadcast set
            for child in node.children.allChildren:
                assert (
                    child.identity in self._nodesKnownToChannel
                    or child in self._nodesToBroadcast
                )

        # Make the compound message
        # listing all the nodes that
        # will be discarded
        finalNodesToDiscard = packet["nodesToDiscard"]

        for nodeId in self._nodeIdsToDiscard:
            assert nodeId in self._nodesKnownToChannel
            assert nodeId not in packet["nodesUpdated"], nodeId
            assert nodeId not in packet["nodesCreated"], nodeId

            finalNodesToDiscard.append(nodeId)
            self._nodesKnownToChannel.discard(nodeId)

        for nodeId, messages in self._pendingOutgoingMessages.items():
            # only send messages for cells that still exist.
            # we process messages at the end of the cell update cycle,
            # after the tree is fully rebuilt.
            if nodeId in self._nodesKnownToChannel:
                toSend = []

                def unpackMessage(m):
                    if isinstance(m, types.FunctionType):
                        try:
                            toSend.append(m())
                        except Exception:
                            logging.exception("Callback %s threw an unexpected exception:", m)
                    else:
                        toSend.append(m)

                for m in messages:
                    unpackMessage(m)

                packet["messages"][nodeId] = toSend

        self._pendingOutgoingMessages.clear()
        self._nodesToBroadcast = set()
        self._nodeIdsToDiscard = set()

        # if packet['nodesUpdated']:
        #     print("SENDING PACKET WITH ")
        #     print("   UPDATED: ")
        #     for node in sorted(packet['nodesUpdated']):
        #         print("        ", node, "->", packet['nodesUpdated'][node]['children'])

        #     print("   NEW    : ", sorted(packet['nodesCreated']))
        #     print("   DROP   : ", sorted(packet['nodesToDiscard']))

        # print(
        #     len(str(packet)),
        #     "bytes and",
        #     len(packet['nodesCreated']) + len(packet['nodesUpdated']),
        #     "nodes"
        # )

        return [packet]

    def _recalculateCells(self):
        while True:
            # handle all the transactions so far
            old_queue = self._transactionQueue
            self._transactionQueue = queue.Queue()

            try:
                while True:
                    self._handleTransaction(*old_queue.get_nowait())
            except queue.Empty:
                pass

            self._dependencies.recalculateDirtyComputedSlots(self.db)

            while self._dependencies._dirtyNodes:
                cellsByLevel = {}
                for node in self._dependencies._dirtyNodes:
                    if not node.garbageCollected:
                        cellsByLevel.setdefault(node.level, []).append(node)
                self._dependencies._dirtyNodes.clear()

                for level, nodesAtThisLevel in sorted(cellsByLevel.items()):
                    for node in nodesAtThisLevel:
                        if not node.garbageCollected:
                            self._recalculateCell(node)

            if not self._dependencies.recalculateDirtyReactors(self.db):
                return

    def getPacketId(self, packetCallback):
        """Return an integer 'packet' id for a callback.

        This lets us register a callback that can produce a larger bundle of
        data that we can send to the browser over http (instead of the websocket)
        which is faster and which can happen out-of-band.

        Args:
            packetCallback - a function that accepts a packetId and
                returns a 'bytes' object  that will be the response

        Returns:
            a 'packet id' we can use to identify the packet.
        """
        packetId = self._packetId

        self._packetId += 1
        self._packetCallbacks[packetId] = packetCallback

        return packetId

    def getPackets(self):
        """Get a dict from packetId to packet contents"""
        res = {}
        for packetId, packetFun in self._packetCallbacks.items():
            res[packetId] = packetFun(packetId)

        self._packetCallbacks.clear()
        return res

    def _recalculateCell(self, node):
        origChildren = self._cellsKnownChildren.get(node.identity, set())

        depContext = DependencyContext(self.db, readOnly=True)

        def recalcNode():
            node.prepare()

            with RecomputingCellContext(node):
                node.recalculate()

        with CellsContext(self):
            result = depContext.calculate(recalcNode)

        if result[0]:
            node.onError(result[1], "".join(traceback.format_tb(result[1].__traceback__)))

        self._dependencies.updateDependencies(node, depContext)

        self.markToBroadcast(node)

        newChildren = set(node.children.allChildren)

        # remove any nodes from the tree we're no longer using
        for child in origChildren.difference(newChildren):
            self._cellOutOfScope(child)

        for child in newChildren.difference(origChildren):
            if child.garbageCollected:
                child.prepareForReuse()
                self._addCell(child, node)
            else:
                self._addCell(child, node)
            self._recalculateCell(child)

        self._cellsKnownChildren[node.identity] = newChildren

        self._dependencies.updateCellReactors(node)

    def childrenWithExceptions(self):
        return self._root.childrenWithExceptions()

    def findChildrenByTag(self, tag, stopSearchingAtFoundTag=True):
        return self._root.findChildrenByTag(
            tag, stopSearchingAtFoundTag=stopSearchingAtFoundTag
        )

    def findChildrenMatching(self, filtr):
        return self._root.findChildrenMatching(filtr)
