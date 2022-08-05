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


from object_database.web.cells.cells_context import CellsContext
from object_database.web.cells.dependency_context import DependencyContext


class ComputedSlotDeps:
    """Explicitly tracks the set of ComputedSlot and ODB values we read.

    This needs to be versioned, since a ComputedSlot could read different
    values if it gets recomputed midway through an effect calculation.
    """

    def __init__(self, subSlots, subscriptions, subSlotDeps):
        self.subSlots = set(subSlots)
        self.subscriptions = set(subscriptions)
        self.subSlotDeps = set(subSlotDeps)

    def __str__(self):
        return (
            f"ComputedSlotDeps({len(self.subSlots)} slots"
            f" and {len(self.subscriptions)} subs)"
        )


class ComputedSlot:
    """Models a value that's computed from other Slot and ODB values.

    This lets us stash expensive computations in the Slot and re-use them
    in many places in the UI. It also allows us to break update chains caused
    by computations reading from many different slots.

    Usage:
        # create a computed slot
        x = ComputedSlot(lambda: someCalc)

        # this reads the value of the computed slot and registers
        # a dependency on it. If the slot recomputes but the value doesn't
        # change, then you won't recalculate.
        x.get()

    Optionally you can add a 'setter' to it, and get a callback that lets you
    push the 'set' operation into some other slot or ODB value.
    """

    IS_COMPUTED = True

    def __init__(self, valueFunction, onSet=None):
        self._valueFunction = valueFunction
        self._onSet = onSet
        self._valueAndIsException = None
        self._valueUpToDate = False
        self.dependencies = None
        self.cells = None
        self._isExecuting = False

    def orphan(self):
        """This slot is no longer being used by the cells tree."""
        self._valueUpToDate = False
        self._valueAndIsException = None
        self.cells = None

    def getWithoutRegisteringDependency(self):
        if self._isExecuting:
            raise Exception("ComputedSlot definition is cyclic.")

        if self.cells is None and CellsContext.get():
            self.cells = CellsContext.get()

        curContext = DependencyContext.get()

        if not curContext.readOnly:
            raise Exception(
                "It makes no sense to getWithoutRegisteringDependency"
                " in a writeable dependency context"
            )

        self.ensureCalculated()

        if self._valueAndIsException[0]:
            raise self._valueAndIsException[1]
        else:
            return self._valueAndIsException[1]

    def get(self):
        if self._isExecuting:
            raise Exception("ComputedSlot definition is cyclic.")

        if self.cells is None and CellsContext.get():
            self.cells = CellsContext.get()

        curContext = DependencyContext.get()

        if not curContext.readOnly:
            return curContext.getComputedSlotValue(self)

        self.ensureCalculated()

        # don't allow direct modifications outside of the context
        if curContext is None:
            raise Exception("You can't read a ComputedSlot outside of a DependencyContext")

        curContext.slotRead(self)

        if self._valueAndIsException[0]:
            raise self._valueAndIsException[1]
        else:
            return self._valueAndIsException[1]

    def set(self, val):
        if not self._onSet:
            raise Exception("This ComputedSlot is not settable.")

        # this just passes through to the setter function. if it modifies anything in ODB
        # or the slot state we'll see it immediately.
        self._onSet(val)

    def markDirty(self):
        self._valueUpToDate = False
        self.dependencies = None

    def isDirty(self):
        return not self._valueUpToDate

    def ensureCalculated(self):
        if self._isExecuting:
            raise Exception("ComputedSlot definition is cyclic.")

        if self.cells is None and CellsContext.get():
            self.cells = CellsContext.get()

        if self._valueUpToDate:
            return

        if not self.cells:
            raise Exception("Can't calculate a ComputedSlot without a cells instance.")

        context = DependencyContext(self.cells, readOnly=True)

        oldVal = self._valueAndIsException
        try:
            self._isExecuting = True
            self._valueAndIsException = context.calculate(self._valueFunction)
        finally:
            self._isExecuting = False

        self._valueUpToDate = True

        self.cells._dependencies.updateDependencies(self, context)

        if oldVal != self._valueAndIsException:
            self.cells._dependencies.markSlotsDirty([self])

        self.dependencies = ComputedSlotDeps(
            context.slotsRead,
            context.subscriptions,
            context.slotDepsRead
        )
