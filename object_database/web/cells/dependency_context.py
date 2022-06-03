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

import threading
import logging

from object_database.web.cells.util import SubscribeAndRetry
from object_database import MaskView, RevisionConflictException


_cur_context = threading.local()
_cur_context.stack = []


class DependencyContext:
    """Models a collection of dependencies on ODB and slot values."""
    def __init__(self, db, readOnly):
        self.db = db
        self.readOnly = readOnly

        # a set of slots we've read from. This may also contain computed slots
        self.slotsRead = set()

        # a set of slots we've created. These may be modified during computation.
        self.slotsCreated = set()

        # map from Slot objects to original values before they were read
        self.writtenSlotOriginalValues = {}

        # the ODB identities we're subscribed to
        self.subscriptions = set()

        # the set of ODB keys we wrote to
        self.odbKeysWritten = set()

    def getViewOrTransaction(self):
        return self.db.view() if self.readOnly else self.db.transaction()

    def slotCreated(self, slot):
        self.slotsCreated.add(slot)

    def slotSet(self, slot, origValue):
        if slot in self.slotsCreated:
            return

        if self.readOnly:
            raise Exception("Can't modify a slot in a read-only dependency context.")

        if slot not in self.writtenSlotOriginalValues:
            self.writtenSlotOriginalValues[slot] = origValue

    def slotRead(self, slot):
        self.slotsRead.add(slot)

    @staticmethod
    def get():
        if not _cur_context.stack:
            return None
        return _cur_context.stack[-1]

    def __enter__(self):
        _cur_context.stack.append(self)

    def __exit__(self, *args):
        _cur_context.stack.pop()

    def resetWrites(self):
        self.slotsCreated = set()

        for slot, val in self.writtenSlotOriginalValues.items():
            slot._value = val

        self.writtenSlotOriginalValues = {}
        self.odbKeysWritten = set()

    def reset(self):
        self.slotsRead = set()
        self.slotsCreated = set()

        for slot, val in self.writtenSlotOriginalValues.items():
            slot._value = val

        self.writtenSlotOriginalValues = {}
        self.subscriptions = set()
        self.odbKeysWritten = set()
        self.computedSlotRead = set()

    def calculate(self, func):
        """Return the value of 'func' calculated with correct dependencies.

        The return value is a tuple of

            (isException: bool, value: object)

        where isException will be True if 'func' threw an exception.

        If 'func' throws a SubscribeAndRetry exception or has a revision conflict, then we'll
        reset the code and try again.
        """
        revisionConflicts = 0

        try:
            with MaskView():
                with self:
                    while True:
                        try:
                            with self.getViewOrTransaction() as v:
                                result = func()
                                self.subscriptions = (
                                    set(v.getFieldReads()).union(set(v.getIndexReads()))
                                )
                                if not self.readOnly:
                                    self.odbKeysWritten = (
                                        set(v.getFieldWrites()).union(set(v.getIndexWrites()))
                                    )

                                return (False, result)
                        except SubscribeAndRetry as e:
                            e.callback(self.db)

                            # reset and try again
                            self.reset()
                        except RevisionConflictException:
                            revisionConflicts += 1
                            if revisionConflicts > 2:
                                logging.warn(
                                    "Committing to db threw revision conflict #%s",
                                    revisionConflicts
                                )

                            if revisionConflicts > 100:
                                logging.error(
                                    "ComputedSlot threw so many conflicts we're just bailing"
                                )
                                return

                            self.reset()
                        except Exception as e:
                            # the exception is actually our 'result'
                            # all writes are voided, but we have to retain the set of values we
                            # wrote so we can put them back if necessary
                            self.subscriptions = (
                                set(v.getFieldReads()).union(set(v.getIndexReads()))
                            )
                            self.resetWrites()

                            return (True, e)

        except Exception:
            self.reset()
            raise
