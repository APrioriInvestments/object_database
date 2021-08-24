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


from object_database.web.cells.computing_cell_context import ComputingCellContext
from object_database.web.cells.slot import Slot
from object_database.web.cells.util import SubscribeAndRetry
from object_database import MaskView


import logging
import traceback


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
        # change, then you won't recalculate.
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
        self._listeners = []
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

    def set(self, val, reason=None):
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
                        with self.cells.db.transaction() as v:
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
                                self._fireListenerCallbacks(oldValue, self._value, "recompute")

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
