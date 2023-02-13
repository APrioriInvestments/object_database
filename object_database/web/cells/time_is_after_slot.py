#   Copyright 2017-2023 object_database Authors
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

import time

from object_database.web.cells.cells_context import CellsContext
from object_database.web.cells.slot import Slot


class TimeIsAfter:
    """Models a 'slot' that calculates whether a given timestamp has elapsed.

    This lets us build UI that depends on when something has changed without going into
    a recalculation loop.
    """
    def __init__(self, timestamp):
        self._timestamp = timestamp
        self._registered = False
        self._slot = None

    def getWithoutRegisteringDependency(self):
        if not self._registered:
            self._register()

        return self._slot.getWithoutRegisteringDependency()

    def get(self):
        if not self._registered:
            self._register()

        return self._slot.get()

    def _register(self):
        """Calculate the cell and register it with 'cells' if necessary"""
        curTimestamp = time.time()

        if curTimestamp >= self._timestamp:
            self._slot = Slot(True)
        else:
            self._slot = Slot(False)

            cells = CellsContext.get()

            if cells is None:
                raise Exception("Please call 'get' inside of a valid cells context first.")

            cells.scheduleUnconditionalCallback(
                self._trigger, atTimestamp=self._timestamp
            )

        self._registered = True

    def _trigger(self):
        self._slot.set(True)
