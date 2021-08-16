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

import logging

from object_database.web.cells.computing_cell_context import ComputingCellContext


class Slot:
    """Represents a piece of session-specific interface state. Any cells
    that call 'get' will be recalculated if the value changes. UX is allowed
    to change the state (say, because of a button call), thereby causing any
    cells that depend on the Slot to recalculate.
    """

    def __init__(self, value=None):
        self._value = value
        self._subscribedCells = set()
        self._onSet = []

    def addListener(self, listener):
        """Add a listener who will get notified any time a slot's value gets set.

        Listeners will get called with (oldValue, newValue, reason)
        """
        self._onSet.append(listener)

    def removeListener(self, listener):
        self._onSet.remove(listener)

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

    def set(self, val, reason=None):
        """Write to a slot."""
        if val == self._value:
            return

        oldValue = self._value
        self._value = val

        self._triggerListeners()

        for listener in self._onSet:
            try:
                listener(oldValue, val, reason)
            except Exception:
                logging.exception("Unexpected exception in slot callback")

    def _triggerListeners(self):
        toTrigger = self._subscribedCells
        self._subscribedCells = set()

        for c in toTrigger:
            c.subscribedSlotChanged(self)

    def toggle(self):
        self.set(not self.get())
