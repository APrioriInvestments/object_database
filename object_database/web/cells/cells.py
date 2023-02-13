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
from object_database.web.cells.root_cell import RootCell
from object_database.web.cells.dependency_context import DependencyContext
from object_database.web.cells.recomputing_cell_context import RecomputingCellContext
from object_database.web.cells.cells_context import CellsContext
from object_database.web.cells.cell_dependencies import CellDependencies


# maximum number of seconds to keep repeating the render / callback
# processing cycle for.
MAX_RENDER_TIME = 0.1


class Cells:
    def __init__(self, db):
        self.db = db

        self._eventHasTransactions = queue.Queue()

        # a view that we use to ensure that the underlying DB connection doesn't
        # GC a transaction before our transaction handler registers it
        self._tidLockingView = self.db.view()
        self.db.registerOnTransactionHandler(self._onTransaction)

        # map: Cell.identity ->  Cell
        self._cells = {}

        # set: type(Cell) that have been sent over the wire
        self._nonbuiltinCellTypes = set()

        # map: Cell.identity -> set(Cell)
        # populated for all cells with a valid identity
        self._cellsKnownChildren = {}

        # map: Cell.identity -> Cell
        self._effects = {}

        # a CellDependencies object that tracks the current calculation dependency graph
        self._dependencies = CellDependencies()

        # set(Cell)
        self._nodesToBroadcast = set()

        # set(Cell)
        self._nodesToBroadcastAsMoved = set()

        # set(Cell.identity)
        self._nodeIdsToDiscard = set()

        # set(Cell) giving all cells who may now be orphaned
        # and which need to be checked and cleaned up
        self._orphanedCells = set()

        # set(Cell.identity) giving all cells who have "moved", meaning
        # that they were installed with one parent but received another
        self._movedCells = set()

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

        # a dict from timestamp to a list of callbacks
        self._timedCallbacksQueue = queue.Queue()
        self._timedCallbacks = {}

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

    @property
    def currentTransactionId(self):
        """Get the current transactionId that has been processed.

        This TID is the max event we have processed through our transaction
        handler (which dirties computed slots) and is guaranteed to
        exist.
        """
        return self._tidLockingView.transaction_id()

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

    def _executeCallback(self, callback, withLogging=True):
        context = DependencyContext(self, readOnly=False)

        with CellsContext(self):
            result = context.calculate(callback)

        self._dependencies.updateFromWriteableDependencyContext(self, context)

        if result[0] and withLogging:
            logging.warn(
                "Callback %s threw an exception: %s\n\n%s",
                callback,
                result[1],
                "".join(traceback.format_tb(result[1].__traceback__)),
            )

        return result

    def calculateExpression(self, callback):
        """Synchronously execute a read-only callback on the main thread.

        If it throws, raise the exception directly."""
        self._handleAllTransactions()

        context = DependencyContext(self, readOnly=True)

        with CellsContext(self):
            result = context.calculate(callback)

        if result[0]:
            raise result[1]
        else:
            return result[1]

    def executeCallback(self, callback):
        """Synchronously execute a callback on the main thread.

        If it throws, raise the exception directly."""
        self._handleAllTransactions()

        result = self._executeCallback(callback, withLogging=False)

        if result[0]:
            raise result[1]
        else:
            return result[1]

    def changeFocus(self, newCell):
        """Trigger a server-side focus change."""
        self._eventHasTransactions.put(1)

        if DependencyContext.get() is None:
            # this can happen when we are installing a cell
            self._executeCallback(lambda: self.focusedCell.set(newCell))
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

    def scheduleUnconditionalCallback(self, callback, atTimestamp=None):
        """Place a callback on the callback queue unconditionally.

        This means that even if the current 'transaction' fails for some reason, the callback
        will be executed.  Normally, when processing cell messages or Effects, you should use
        Cell.scheduleCallback which works through the DependencyContext to only register the
        callback if the current transaction doesn't fail.

        Args:
            callback - a callback to fire
            atTimestamp - if not None, wait until this timestamp or greater before firing
                the callback
        """
        if atTimestamp is None or time.time() >= atTimestamp:
            self._callbacks.put(callback)
            self._eventHasTransactions.put(1)
        else:
            self._timedCallbacksQueue.put((callback, atTimestamp))
            self._eventHasTransactions.put(1)

    def _scheduleCallbacks(self, callbacks):
        if not callbacks:
            return

        for callback in callbacks:
            self._callbacks.put(callback)
        self._eventHasTransactions.put(1)

    def _scheduleMessages(self, messages):
        if not messages:
            return

        wasEmpty = len(self._pendingOutgoingMessages) == 0

        for cell, message in messages:
            messagesToSend = self._pendingOutgoingMessages.setdefault(cell, [])
            messagesToSend.append(message)

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

    def wait(self, timeout=None):
        if self._timedCallbacks:
            curTime = time.time()

            while self._timedCallbacks and min(self._timedCallbacks) <= curTime:
                firstTime = min(self._timedCallbacks)
                if firstTime <= curTime:
                    self._scheduleCallbacks(self._timedCallbacks.pop(firstTime))

            if self._timedCallbacks:
                if timeout is None:
                    timeout = min(self._timedCallbacks) - curTime
                else:
                    timeout = min(timeout, min(self._timedCallbacks) - curTime)

                assert timeout > 0

        # drain the queue
        try:
            self._eventHasTransactions.get(timeout=timeout)

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
        return transactionId

    def markDirty(self, cell):
        self._dependencies.markCellDirty(cell)

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
        context = DependencyContext(self, readOnly=False)

        def updateFocusedCell():
            focusedCell = self.focusedCell.get()

            if focusedCell and not focusedCell.isActive():
                self.focusedCell.set(self.pickFocusedCell())
                self.focusEventId += 1

            return self.focusedCell.get()

        result = context.calculate(updateFocusedCell)

        if result[0]:
            raise result[1]

        self._dependencies.updateFromWriteableDependencyContext(self, context)

        return result[1]

    def renderMessages(self):
        self._recalculateAll()

        focusedCell = self._updateFocusedCell()

        packet = dict(
            # indicate that this is one complete cell frame
            type="#frame",
            # list of cell identities that were discarded
            nodesToDiscard=[],
            # map from cell identities that were moved to their new parent.
            # They may also have been updated. They definitely exist in a prior
            # update
            nodesMoved={},
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

        for node in self._nodesToBroadcastAsMoved:
            packet["nodesMoved"][node.identity] = node.parent.identity

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

        for cell, messages in self._pendingOutgoingMessages.items():
            if cell.isActive():
                nodeId = cell.identity

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
                                logging.exception(
                                    "Callback %s threw an unexpected exception:", m
                                )
                        else:
                            toSend.append(m)

                    for m in messages:
                        unpackMessage(m)

                    packet["messages"][nodeId] = toSend

        self._pendingOutgoingMessages.clear()
        self._nodesToBroadcast = set()
        self._nodesToBroadcastAsMoved = set()
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

    def _recalculateAll(self):
        while True:
            self._handleAllTransactions()
            self._updateAllDirtyCells()
            self._cleanUpAllOrphans()

            hadMoves = self._updateAllMovedCells()
            hadReactors = self._dependencies.recalculateDirtyReactors(self)
            hadCallbacks = self._processCallbacks()

            if not hadReactors and not hadCallbacks and not hadMoves:
                return

    def _updateAllDirtyCells(self):
        if not self._dependencies._dirtyNodes:
            return

        # we might temporarily orphan a node, and then un-orphan it
        # when someone else finds it and calculates on it. As a result,
        # while we never want to recalculate an orphaned cell, we also
        # need to keep them around, since a node may become 'unorphaned'
        while True:
            cellsByLevel = {}

            for node in self._dependencies._dirtyNodes:
                if node.isActive():
                    cellsByLevel.setdefault(node.level, []).append(node)

            didAnything = False
            for level, nodesAtThisLevel in sorted(cellsByLevel.items()):
                for node in nodesAtThisLevel:
                    if node.isActive():
                        t0 = time.time()
                        self._recalculateCell(node)
                        if time.time() - t0 > 0.01:
                            logging.warning(
                                "recalculating %s took %.3f seconds", node, time.time() - t0
                            )
                        self._dependencies._dirtyNodes.discard(node)

                        didAnything = True

            if not didAnything:
                self._dependencies._dirtyNodes = set()
                return

    def _updateAllMovedCells(self):
        didAnything = False

        while self._movedCells:
            for cell in list(self._movedCells):
                assert not cell.isOrphaned()
                assert cell.isActive()
                assert cell.isMoved()

                self._movedCells.remove(cell)

                # tell the cell it moved. It then
                # can recalculate itself
                cell.onMoved()

                self._nodesToBroadcastAsMoved.add(cell)

                didAnything = True

        return didAnything

    def _cleanUpAllOrphans(self):
        while self._orphanedCells:
            for cell in list(self._orphanedCells):
                assert cell.isOrphaned()
                self._orphanedCells.remove(cell)
                self._cellOutOfScope(cell)

    def _recalculateCell(self, node):
        # this node has to be active for this to make sense
        assert node.isActive()

        origChildren = self._cellsKnownChildren.get(node.identity, set())

        depContext = DependencyContext(self, readOnly=True)

        def recalcNode():
            node.prepareForCalculation()

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
            assert child.isActive()

            child.removeParent(node)

            if child.isOrphaned():
                self._orphanedCells.add(child)

        for child in newChildren.difference(origChildren):
            if child.isActive() or child.isOrphaned():
                # this child is moving to a new parent. It's definitely
                # not orphaned anymore
                if child.moveToParent(node):
                    self._movedCells.add(child)
                    self._orphanedCells.discard(child)
                else:
                    self._movedCells.discard(child)
                    self._orphanedCells.discard(child)
            else:
                self._addCell(child, node)
                self._recalculateCell(child)

        self._cellsKnownChildren[node.identity] = newChildren

        self._dependencies.updateCellReactors(node)

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
        assert cell.cells is self

        for c in cell.children.allChildren:
            if c.parent is cell:
                self._cellOutOfScope(c)
            c.removeParent(cell)

        if cell.identity in self._nodesKnownToChannel:
            self._nodeIdsToDiscard.add(cell.identity)

        self._nodesToBroadcast.discard(cell)
        self._nodesToBroadcastAsMoved.discard(cell)
        self._focusableCells.discard(cell)

        cell.onRemovedFromTree()

        del self._cells[cell.identity]
        del self._cellsKnownChildren[cell.identity]
        self._dependencies.calculationDiscarded(cell)

        cell.uninstall()

    def _processCallbacks(self):
        """Execute any callbacks that have been scheduled to run on the main UI thread."""
        processed = 0
        t0 = time.time()

        callbacksToExecute = []

        try:
            while True:
                callbacksToExecute.append(self._callbacks.get(block=False))
        except queue.Empty:
            pass

        try:
            while True:
                callback, atTimestamp = self._timedCallbacksQueue.get(block=False)
                if atTimestamp < time.time():
                    callbacksToExecute.append(callback)
                else:
                    self._timedCallbacks.setdefault(atTimestamp, []).append(callback)
        except queue.Empty:
            pass

        def singleCallback():
            for c in callbacksToExecute:
                try:
                    c()
                except Exception:
                    logging.exception("Callback %s threw an unexpected exception", c)

        if callbacksToExecute:
            self._executeCallback(singleCallback)

        processed = len(callbacksToExecute)

        if processed:
            logging.info("Processed %s callbacks in %s seconds", processed, time.time() - t0)

        return processed > 0

    def _handleAllTransactions(self):
        """Process any transactions, dirtying the dependency graph if required."""
        maxTransactionId = self.db.currentTransactionId()

        old_queue = self._transactionQueue
        self._transactionQueue = queue.Queue()

        maxTransactionId = max(maxTransactionId, self._tidLockingView.transaction_id())

        try:
            while True:
                maxTransactionId = max(
                    self._handleTransaction(*old_queue.get_nowait()), maxTransactionId
                )
        except queue.Empty:
            pass

        if maxTransactionId != self._tidLockingView.transaction_id():
            self._tidLockingView = self.db.view(transaction_id=maxTransactionId)

        self._dependencies.recalculateDirtyComputedSlots(self)

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

    def childrenWithExceptions(self):
        return self._root.childrenWithExceptions()

    def findChildrenByTag(self, tag, stopSearchingAtFoundTag=True):
        return self._root.findChildrenByTag(
            tag, stopSearchingAtFoundTag=stopSearchingAtFoundTag
        )

    def findChildrenMatching(self, filtr):
        return self._root.findChildrenMatching(filtr)

    @property
    def root(self):
        return self._root.children["child"]
