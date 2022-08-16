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
from object_database.schema import ObjectFieldId, IndexId


_cur_context = threading.local()


class DependencyContext:
    """Models a collection of dependencies on ODB and slot values.

    If writeable, also maintains a 'shadow' copy of the ComputedSlot
    layer"""

    def __init__(self, cells, readOnly):
        self.cells = cells
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

        # set of ComputedSlot dependencies we read from
        self.slotDepsRead = set()

        self.slowComputedSlotsRead = set()

        # messages that were scheduled to be sent as part of this recalculation
        self.scheduledMessages = []

        # callbacks that need to be registered as part of this callback
        self.scheduledCallbacks = []

        # all computed slots whose cache values are known to be correct
        # if we read a computed slot and can prove that none of the ODB
        # values, slots, and computed slots it has read from have been
        # modified, then we place a value in here.
        self.unmodifiedComputedSlots = set()

        # all computed slots whose values are being maintained by
        # this dependency context. Any computed slot that depends on
        # a modified computed slot must also be considered modified
        # and must be recomputed before its value can be read
        self.modifiedComputedSlots = set()

        # the subset of all ComputedSlot values and deps
        # contained in both 'unmodified' and 'modified' computed slots
        self.computedSlotValues = {}
        self.computedSlotDependencies = {}

        # the reverse dependencies:
        #     odb key to set(ComputedSlot)
        #     Slot -> set(ComputedSlot)
        # these are
        self.subscriptionToComputedSlots = {}
        self.slotToComputedSlots = {}

        # a list of ComputedSlotDep objects representing
        # computations we're currently executing
        self.executingDependencyStack = []

    def getComputedSlotValue(self, computedSlot):
        """Read a computed slot in a non readOnly dependency context.

        This function ensures that we see a consistent view of the
        ComputedSlot objects available to us. In particular, we want
        to re-use the values in the existing ComputedSlot dependency
        graph that we've already calculated, but we also need to
        ensure that we correctly reflect any writes we've made into
        Slot and ODB values.
        """
        if computedSlot in self.computedSlotValues:
            self.slotsRead.add(computedSlot)
            self.slotDepsRead.add(self.computedSlotDependencies[computedSlot])

            if self.executingDependencyStack:
                self.executingDependencyStack[-1].subSlots.add(computedSlot)
                self.executingDependencyStack[-1].subSlotDeps.add(
                    self.computedSlotDependencies[computedSlot]
                )

            (isException, value) = self.computedSlotValues[computedSlot]
            if isException:
                raise value
            else:
                return value

        # it wouldn't make sense for this slot to be unmodified
        # and also not to be cached.
        assert computedSlot not in self.unmodifiedComputedSlots

        if computedSlot not in self.modifiedComputedSlots:
            if not computedSlot.isDirty():
                if self._areComputedSlotDepsAllUnmodified(computedSlot):
                    self.setComputedSlotValue(
                        computedSlot,
                        computedSlot._valueAndIsException,
                        computedSlot.dependencies,
                        True,
                    )
                    return self.getComputedSlotValue(computedSlot)

        self.modifiedComputedSlots.add(computedSlot)

        from object_database.web.cells.computed_slot import ComputedSlotDeps

        newDeps = ComputedSlotDeps((), (), ())

        self.executingDependencyStack.append(newDeps)

        try:
            computedSlot._isExecuting = True
            valueAndIsException = (False, computedSlot._valueFunction())
        except SubscribeAndRetry:
            # need to pass these back out to the outermost level
            self.setComputedSlotValue(computedSlot, None, None, False)
            raise
        except Exception as e:
            valueAndIsException = (True, e)
        finally:
            computedSlot._isExecuting = False
            self.executingDependencyStack.pop()

        self.setComputedSlotValue(computedSlot, valueAndIsException, newDeps, False)
        return self.getComputedSlotValue(computedSlot)

    def setComputedSlotValue(self, slot, valueAndIsException, newDependencies, isUnmodified):
        if isUnmodified:
            # can't go backward!
            assert slot not in self.modifiedComputedSlots

            self.unmodifiedComputedSlots.add(slot)
        else:
            self.unmodifiedComputedSlots.discard(slot)
            self.modifiedComputedSlots.add(slot)

        existingDependencies = self.computedSlotDependencies.get(slot)

        if valueAndIsException is None:
            assert newDependencies is None
            self.computedSlotValues.pop(slot, None)
            self.computedSlotDependencies.pop(slot, None)
        else:
            self.computedSlotValues[slot] = valueAndIsException
            self.computedSlotDependencies[slot] = newDependencies

        existingSubSlots = (
            existingDependencies.subSlots if existingDependencies is not None else set()
        )
        existingSubscriptions = (
            existingDependencies.subscriptions if existingDependencies is not None else set()
        )

        newSubSlots = newDependencies.subSlots if newDependencies is not None else set()
        newSubscriptions = (
            newDependencies.subscriptions if newDependencies is not None else set()
        )

        addedSubscriptions = newSubscriptions - existingSubscriptions
        droppedSubscriptions = existingSubscriptions - newSubscriptions

        for sub in addedSubscriptions:
            self.subscriptionToComputedSlots.setdefault(sub, set()).add(slot)

        for sub in droppedSubscriptions:
            self.subscriptionToComputedSlots[sub].discard(slot)
            if not self.subscriptionToComputedSlots[sub]:
                del self.subscriptionToComputedSlots[sub]

        addedSlots = newSubSlots - existingSubSlots
        droppedSlots = existingSubSlots - newSubSlots

        for sub in addedSlots:
            self.slotToComputedSlots.setdefault(sub, set()).add(slot)

        for sub in droppedSlots:
            self.slotToComputedSlots[sub].discard(slot)
            if not self.slotToComputedSlots[sub]:
                del self.slotToComputedSlots[sub]

    def _areComputedSlotDepsAllUnmodified(self, computedSlot):
        for dep in computedSlot.dependencies.subSlots:
            if not dep.IS_COMPUTED and dep in self.writtenSlotOriginalValues:
                return False
            if dep.IS_COMPUTED:
                if (
                    dep not in self.unmodifiedComputedSlots
                    and dep not in self.modifiedComputedSlots
                ):
                    self.getComputedSlotValue(dep)

                if dep in self.modifiedComputedSlots:
                    return False

        return True

    def getComputedSlotsRead(self):
        return [x for x in self.slotsRead if x.IS_COMPUTED]

    def getViewOrTransaction(self):
        return (self.cells.db.view if self.readOnly else self.cells.db.transaction)(
            transaction_id=self.cells.currentTransactionId
        )

    def slotCreated(self, slot):
        self.slotsCreated.add(slot)

    def slotValueModified(self, slot, origValue):
        if self.readOnly or self.executingDependencyStack:
            raise Exception("Can't modify a slot in a read-only dependency context.")

        for computedSlot in set(self.slotToComputedSlots.get(slot, set())):
            self.markComputedSlotDirty(computedSlot)

        if slot in self.slotsCreated:
            return

        if slot not in self.writtenSlotOriginalValues:
            self.writtenSlotOriginalValues[slot] = origValue

    def slotRead(self, slot):
        # this only gets called in the read-only pathway
        self.slotsRead.add(slot)

        if slot.IS_COMPUTED:
            self.slotDepsRead.add(slot.dependencies)

        if self.executingDependencyStack:
            self.executingDependencyStack[-1].subSlots.add(slot)
            if slot.IS_COMPUTED:
                self.executingDependencyStack[-1].subSlotDeps.add(slot.dependencies)

    def _onViewEvent(self, event, field, oidOrIndexVal):
        if event in ("fieldWritten", "indexWritten"):
            assert not self.readOnly

            if self.executingDependencyStack:
                raise Exception("Can't write into the ODB during a ComputedSlot calc")

            if event == "fieldWritten":
                sub = ObjectFieldId(fieldId=field, objId=oidOrIndexVal, isIndexValue=False)
            else:
                sub = IndexId(fieldId=field, indexValue=oidOrIndexVal)

            for slot in set(self.subscriptionToComputedSlots.get(sub, set())):
                self.markComputedSlotDirty(slot)
        elif event in ("fieldRead", "indexRead"):
            if not self.executingDependencyStack:
                return

            if event == "fieldRead":
                sub = ObjectFieldId(fieldId=field, objId=oidOrIndexVal, isIndexValue=False)
            else:
                sub = IndexId(fieldId=field, indexValue=oidOrIndexVal)

            self.executingDependencyStack[-1].subscriptions.add(sub)
        else:
            assert False, f"invalid event: {event}"

    def markComputedSlotDirty(self, slot):
        if slot not in self.computedSlotValues:
            # nothing to do - its already unmodified
            return

        upstreams = set(self.slotToComputedSlots.get(slot, set()))

        self.setComputedSlotValue(slot, None, None, False)

        for u in upstreams:
            self.markComputedSlotDirty(u)

    @staticmethod
    def get():
        if not hasattr(_cur_context, "stack"):
            _cur_context.stack = []

        if not _cur_context.stack:
            return None
        return _cur_context.stack[-1]

    def __enter__(self):
        if not hasattr(_cur_context, "stack"):
            _cur_context.stack = []

        _cur_context.stack.append(self)

    def __exit__(self, *args):
        _cur_context.stack.pop()

    def scheduleCallback(self, callback):
        if self.readOnly:
            raise Exception("Can't schedule a callback in a read-only dependency context")

        self.scheduledCallbacks.append(callback)

    def scheduleMessage(self, cell, message):
        if self.readOnly:
            raise Exception("Can't schedule a message in a read-only dependency context")

        self.scheduledMessages.append((cell, message))

    def resetWrites(self):
        self.slotsCreated = set()

        for slot, val in self.writtenSlotOriginalValues.items():
            slot._value = val

        self.writtenSlotOriginalValues = {}
        self.odbKeysWritten = set()
        self.scheduledMessages = []
        self.scheduledCallbacks = []
        self.executingDependencyStack = []

    def reset(self):
        self.slotsRead = set()
        self.slotsCreated = set()

        for slot, val in self.writtenSlotOriginalValues.items():
            slot._value = val

        self.writtenSlotOriginalValues = {}
        self.subscriptions = set()
        self.odbKeysWritten = set()
        self.slotDepsRead = set()
        self.scheduledMessages = []
        self.scheduledCallbacks = []

        self.unmodifiedComputedSlots = set()
        self.modifiedComputedSlots = set()
        self.computedSlotValues = {}
        self.computedSlotDependencies = {}
        self.subscriptionToComputedSlots = {}
        self.slotToComputedSlots = {}
        self.executingDependencyStack = []

    def markTransitiveReadsInto(self, view):
        slotDepsVisited = set()
        toVisit = set(self.slotDepsRead)

        while toVisit:
            dep = toVisit.pop()

            if dep not in slotDepsVisited:
                slotDepsVisited.add(dep)

                # transitively visit any ComputedSlotDeps we reach
                toVisit.update(dep.subSlotDeps)

                for subscription in dep.subscriptions:
                    if isinstance(subscription, IndexId):
                        view.markIndexRead(subscription.fieldId, subscription.indexValue)
                    else:
                        view.markFieldRead(subscription.fieldId, subscription.objId)

    def calculate(self, func):
        """Return the value of 'func' calculated with correct dependencies.

        The return value is a tuple of

            (isException: bool, value: object)

        where isException will be True if 'func' threw an exception.

        If 'func' throws a SubscribeAndRetry exception or has a revision conflict, then we'll
        reset the code and try again.
        """
        revisionConflicts = 0
        v = None

        try:
            with MaskView():
                with self:
                    while True:
                        try:
                            with self.getViewOrTransaction() as v:
                                # make sure we can see what we are writing
                                # into so that we can dirty computed slots
                                # appropriately
                                v.addViewWatcher(self._onViewEvent)

                                result = func()

                                self.subscriptions = set(v.getFieldReads()).union(
                                    set(v.getIndexReads())
                                )

                                if not self.readOnly:
                                    self.odbKeysWritten = set(v.getFieldWrites()).union(
                                        set(v.getIndexWrites())
                                    )

                                if not self.readOnly:
                                    self.markTransitiveReadsInto(v)

                            return (False, result)
                        except SubscribeAndRetry as e:
                            e.callback(self.cells.db)
                            self.cells._handleAllTransactions()

                            # reset and try again
                            self.reset()
                        except RevisionConflictException as e:
                            revisionConflicts += 1
                            if revisionConflicts > 0:
                                logging.warn(
                                    "Committing to db threw revision conflict #%s",
                                    revisionConflicts,
                                )

                            if revisionConflicts > 100:
                                logging.error(
                                    "ComputedSlot threw so many conflicts we're just bailing"
                                )
                                return (True, e)

                            self.reset()
                            self.cells._handleAllTransactions()

                        except Exception as e:
                            # the exception is actually our 'result'
                            # all writes are voided, but we have to retain the set of values we
                            # read so we can register appropriate dependencies
                            if v is not None:
                                self.subscriptions = set(v.getFieldReads()).union(
                                    set(v.getIndexReads())
                                )
                            else:
                                self.subscriptions = set()

                            self.resetWrites()

                            return (True, e)

        except Exception:
            self.reset()
            raise
