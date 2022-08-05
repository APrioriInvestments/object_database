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

from object_database.web.cells.dependency_context import DependencyContext


class Slot:
    """Represents a piece of session-specific interface state. Any cells or computed slots
    that call 'get' will be recalculated in subsequent frames if the value changes.
    """
    IS_COMPUTED = False

    def __init__(self, value=None):
        self._value = value

        curContext = DependencyContext.get()

        if curContext:
            curContext.slotCreated(self)

    def setter(self, val):
        return lambda: self.set(val)

    def getWithoutRegisteringDependency(self):
        return self._value

    def get(self):
        """Get the value of the Slot, and register a dependency on the calling cell."""
        curContext = DependencyContext.get()

        if curContext is None:
            raise Exception("Can't read a Slot outside of a DependencyContext")

        curContext.slotRead(self)

        return self._value

    def set(self, val):
        """Write to a slot."""
        curContext = DependencyContext.get()

        # don't allow direct modifications outside of the context
        if curContext is None:
            raise Exception("You can't modify a Slot outside of a DependencyContext")

        if self._value == val:
            return

        curContext.slotValueModified(self, self._value)

        self._value = val

    def toggle(self):
        self.set(not self.get())
