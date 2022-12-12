import logging
import traceback

from object_database.web.cells.computed_slot import ComputedSlot
from object_database.web.cells.cells_context import CellsContext
from object_database.web.cells.cell import Cell
from object_database.web.cells.dependency_context import DependencyContext
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

    def updateFromWriteableDependencyContext(self, cells, context):
        self.markSlotsDirty(set(context.writtenSlotOriginalValues))
        self.odbValuesChanged(set(context.odbKeysWritten))
        cells._scheduleMessages(context.scheduledMessages)
        cells._scheduleCallbacks(context.scheduledCallbacks)

        # force cells to handle any transactions that were written
        cells._handleAllTransactions()

    def markSlotsDirty(self, slots):
        """Some state-change modified the values in a collection of slots."""
        for slot in slots:
            for calculation in self._slotToReaders.get(slot, set()):
                self._markCalcDirty(calculation)

    def odbValuesChanged(self, keys):
        for key in keys:
            for calculation in self._subscribedCells.get(key, set()):
                self._markCalcDirty(calculation)

    def recalculateDirtyComputedSlots(self, cells):
        # this is not the most efficient way of doing this - we could do better
        # by more explicitly tracking the level of each computed slot in the
        # tree.
        while self._dirtyComputedSlots:
            aSlot = self._dirtyComputedSlots.pop()

            with CellsContext(cells):
                aSlot.ensureCalculated()

    def recalculateDirtyReactors(self, cells):
        """Recalculate reactors in a loop until none are dirty.

        Returns:
            True if we updated anything.
        """
        didAnything = False

        while self._dirtyReactors:
            aReactor = self._dirtyReactors.pop()

            depContext = DependencyContext(cells, readOnly=False)

            def updateIt():
                return aReactor.applyStateChange()

            with CellsContext(cells):
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
            if result[1]:
                self.updateFromWriteableDependencyContext(cells, depContext)
                didAnything = True

        return didAnything

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
