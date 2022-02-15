#   Copyright 2017-2019 object_database Authors
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
from object_database.view import current_transaction
from object_database.web.cells.computing_cell_context import ComputingCellContext
from object_database.util import Timer


class DummyCell:
    def __init__(self, cells):
        self.cells = cells

    def onWatchingSlot(self, slot):
        pass

    def subscribedSlotChanged(self, slot):
        pass


def wrapCallback(callback):
    """Make a version of callback that will run on the main cells ui thread when invoked.

    This must be called from within a 'cell' or message update.
    """
    cells = ComputingCellContext.get().cells

    def realCallback(*args, **kwargs):
        def innerCallback():
            with ComputingCellContext(DummyCell(cells)):
                callback(*args, **kwargs)

        cells.scheduleCallback(innerCallback)

    realCallback.__name__ = callback.__name__

    return realCallback


class SubscribeAndRetry(Exception):
    def __init__(self, callback):
        super().__init__("SubscribeAndRetry")
        self.callback = callback


def ensureSubscribedType(t, lazy=False):
    if not current_transaction().db().isSubscribedToType(t):
        raise SubscribeAndRetry(
            Timer("Subscribing to type %s%s", t, " lazily" if lazy else "")(
                lambda db: db.subscribeToType(t, lazySubscription=lazy)
            )
        )


def ensureSubscribedSchema(t, lazy=False):
    if not current_transaction().db().isSubscribedToSchema(t):
        raise SubscribeAndRetry(
            Timer("Subscribing to schema %s%s", t, " lazily" if lazy else "")(
                lambda db: db.subscribeToSchema(t, lazySubscription=lazy)
            )
        )


def waitForCellsCondition(cells, condition, timeout=10.0):
    t0 = time.time()
    while time.time() - t0 < timeout:
        condRes = condition()

        if not condRes:
            time.sleep(0.1)
            cells.renderMessages()
        else:
            return condRes

    exceptions = cells.childrenWithExceptions()
    if exceptions:
        raise Exception("\n\n".join([e.childByIndex(0).contents for e in exceptions]))

    return None
