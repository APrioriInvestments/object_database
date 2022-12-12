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


from object_database.web.cells.slot import Slot
from object_database.web.cells.computed_slot import ComputedSlot


class Reactor:
    """Encapsulates a single cells-based 'reaction' to the state of the slots and ODB.

    A reactor is a state-change operation that looks at the state of the ODB and its slots
    and is allowed to make changes to them. Whenever anything it read is modified, it will
    re-run.

    Reactors are allowed to send messages.
    """

    def __init__(self):
        pass

    def applyStateChange(self):
        """Perform any state change we might have made.

        Returns:
            True if we did anything, False otherwise.
        """
        raise NotImplementedError(self)


class SimpleReactor(Reactor):
    def __init__(self, effect):
        super().__init__()

        self.effect = effect

    def applyStateChange(self):
        self.effect()
        return True


class SlotWatcher(Reactor):
    def __init__(self, slot, onValueChanged):
        super().__init__()

        assert isinstance(slot, (Slot, ComputedSlot)), type(slot)

        self.slot = slot
        self.onValueChanged = onValueChanged
        self.hasCalculated = False
        self.broadcastValue = None

    def setWithoutChange(self, newValue):
        self.slot.set(newValue)
        self.broadcastValue = newValue

    def applyStateChange(self):
        if not self.hasCalculated:
            # the first time, we don't update
            self.broadcastValue = self.slot.get()
            self.hasCalculated = True
        else:
            curVal = self.slot.get()

            if curVal != self.broadcastValue:
                oldValue = self.broadcastValue
                self.broadcastValue = curVal
                self.onValueChanged(oldValue, curVal)

                return True

        return False
