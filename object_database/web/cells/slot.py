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
