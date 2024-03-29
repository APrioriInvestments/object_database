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

from object_database.web.cells import (
    Cell,
    Cells,
    Effect,
    Subscribed,
    Expands,
    Card,
    Container,
    Sequence,
    SubscribedSequence,
    ComputedSlot,
    Span,
    Text,
    Slot,
    TimeIsAfter,
    HeaderBar,
    ensureSubscribedType,
    SessionState,
)

from object_database import InMemServer, Schema, Indexed, connect
from object_database.util import genToken, configureLogging
from object_database.frontends.service_manager import (
    autoconfigureAndStartServiceManagerProcess,
)
from object_database.test_util import currentMemUsageMb, log_cells_stats

import logging
import time
import unittest
import threading
import pytest


test_schema = Schema("core.web.test")


@test_schema.define
class Thing:
    k = Indexed(int)
    x = int


class CellsTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        configureLogging(preamble="cells_test", level=logging.INFO)
        cls._logger = logging.getLogger(__name__)

    def setUp(self):
        self.token = genToken()
        self.server = InMemServer(auth_token=self.token)
        self.server.start()

        self.db = self.server.connect(self.token)
        self.db.subscribeToSchema(test_schema)
        self.cells = Cells(self.db)

    def tearDown(self):
        self.server.stop()

    def test_cells_recalculation(self):
        pair = [Container("HI"), Container("HI2")]

        sequence = Sequence(pair)

        self.cells.withRoot(sequence)

        self.cells.renderMessages()
        pair[0].setChild("HIHI")
        self.cells.renderMessages()

        # Assert that the contianers have the correct parent
        self.assertEqual(pair[0].parent, sequence)
        self.assertEqual(pair[1].parent, sequence)

        # Assert that the first Container has a Cell child
        self.assertIsInstance(pair[0].children["child"], Cell)

    def test_computed_slot(self):
        aSlot = ComputedSlot(lambda: len(Thing.lookupAll()))

        # make a 'subscribed' that translates the slot value into a
        # something that will read it and keep it alive
        subs = Subscribed(lambda: str(aSlot.get()))
        self.cells.withRoot(subs)

        self.cells.renderMessages()

        assert subs.children["content"].text == "0"

        with self.db.transaction():
            Thing(x=1, k=1)
            Thing(x=2, k=2)

        self.cells.renderMessages()

        assert subs.children["content"].text == "2"

        aSlot2 = ComputedSlot(lambda: aSlot.get() + 2)

        subs = Subscribed(lambda: str(aSlot2.get()))
        self.cells.withRoot(subs)

        self.cells.renderMessages()
        assert subs.children["content"].text == "4"

        with self.db.transaction():
            Thing(x=1, k=1)
            Thing(x=2, k=2)

        self.cells.renderMessages()
        assert subs.children["content"].text == "6"

        self.cells.withRoot(Text("HI"))

        self.cells.renderMessages()

        with self.db.transaction():
            Thing(x=1, k=1)
            Thing(x=2, k=2)

        self.cells.renderMessages()

        assert aSlot.cells is None
        assert aSlot2.cells is None

        with self.db.transaction():
            Thing(x=1, k=1)
            Thing(x=2, k=2)

    def test_cant_change_data_in_readers_slot(self):
        slot = Slot(0)

        def calculateIt():
            slot.set(1)
            return "1"

        self.cells.withRoot(Subscribed(calculateIt))
        self.cells.renderMessages()

        assert self.cells.childrenWithExceptions()

    def test_cant_change_data_in_readers_odb(self):
        with self.db.transaction():
            t = Thing(x=1)

        def calculateIt():
            t.x = 2
            return "1"

        self.cells.withRoot(Subscribed(calculateIt))
        self.cells.renderMessages()

        assert self.cells.childrenWithExceptions()

    def test_cells_reusable(self):
        c1 = Card(Text("HI"))
        c2 = Card(Text("HI2"))
        slot = Slot(0)

        self.cells.withRoot(Subscribed(lambda: c1 if slot.get() else c2))

        self.cells.renderMessages()

        self.cells.scheduleUnconditionalCallback(lambda: slot.set(1))
        self.cells.renderMessages()
        assert slot.getWithoutRegisteringDependency() == 1

        self.cells.scheduleUnconditionalCallback(lambda: slot.set(0))
        self.cells.renderMessages()
        assert slot.getWithoutRegisteringDependency() == 0

        self.assertFalse(self.cells.childrenWithExceptions())

    def test_cells_subscriptions(self):
        self.cells.withRoot(
            Subscribed(
                lambda: Sequence(
                    [
                        Span("Thing(k=%s).x = %s" % (thing.k, thing.x))
                        for thing in Thing.lookupAll()
                    ]
                )
            )
        )

        self.cells.renderMessages()

        tid = self.cells.currentTransactionId

        with self.db.transaction():
            Thing(x=1, k=1)
            Thing(x=2, k=2)

        self.cells.db.flush()
        self.cells._recalculateAll()

        assert tid < self.cells.currentTransactionId

        # three 'Span', three 'Text', the Sequence, the Subscribed, and a delete
        # self.assertEqual(len(self.cells.renderMessages()), 9)
        nodes_created = [
            node
            for node in self.cells._nodesToBroadcast
            if node.identity not in self.cells._nodesKnownToChannel
        ]

        # We have created three: Span and two Text
        self.assertEqual(len(nodes_created), 3)

        # We have discarded only one
        self.assertEqual(len(self.cells._nodeIdsToDiscard), 1)

    def test_cells_ensure_subscribed(self):
        schema = Schema("core.web.test2")

        @schema.define
        class Thing2:
            k = Indexed(int)
            x = int

        computed = threading.Event()

        def checkThing2s():
            ensureSubscribedType(Thing2)

            res = Sequence(
                [
                    Span("Thing(k=%s).x = %s" % (thing.k, thing.x))
                    for thing in Thing2.lookupAll()
                ]
            )

            computed.set()

            return res

        self.cells.withRoot(Subscribed(checkThing2s))

        self.cells.renderMessages()

        self.assertTrue(computed.wait(timeout=5.0))

    def test_cells_garbage_collection(self):
        # create a cell that subscribes to a specific 'thing', but that
        # creates new cells each time, and verify that we reduce our
        # cell count, and that we send deletion messages

        # subscribes to the set of cells with k=0 and displays something
        self.cells.withRoot(
            SubscribedSequence(
                lambda: Thing.lookupAll(k=0),
                lambda thing: Subscribed(
                    lambda: Span("Thing(k=%s).x = %s" % (thing.k, thing.x))
                ),
            )
        )

        with self.db.transaction():
            thing = Thing(x=1, k=0)

        for i in range(100):
            with self.db.transaction():
                thing.k = 1
                thing = Thing(x=i, k=0)

                for anything in Thing.lookupAll():
                    anything.x = anything.x + 1

            messages = self.cells.renderMessages()

            self.assertTrue(
                len(self.cells) < 20, "Have %s cells at pass %s" % (len(self.cells), i)
            )
            self.assertTrue(
                len(messages) < 20, "Got %s messages at pass %s" % (len(messages), i)
            )

    def helper_memory_leak(self, cell, initFn, workFn, thresholdMB):
        port = 8021
        server, cleanupFn = autoconfigureAndStartServiceManagerProcess(
            port=port, authToken=self.token
        )
        try:
            db = connect("localhost", port, self.token, retry=True)
            db.subscribeToSchema(test_schema)
            cells = Cells(db)

            cells.withRoot(cell)

            initFn(db, cells)

            rss0 = currentMemUsageMb()
            log_cells_stats(cells, logging.info, indentation=4)

            workFn(db, cells)
            log_cells_stats(cells, logging.info, indentation=4)

            rss = currentMemUsageMb()
            logging.info("Initial Memory Usage: {} MB".format(rss0))
            logging.info("Final   Memory Usage: {} MB".format(rss))
            self.assertTrue(
                rss - rss0 < thresholdMB, "Memory Usage Increased by {} MB.".format(rss - rss0)
            )
        finally:
            cleanupFn()

    def test_cells_memory_leak1(self):
        cell = Subscribed(
            lambda: Sequence(
                [
                    Span("Thing(k=%s).x = %s" % (thing.k, thing.x))
                    for thing in Thing.lookupAll(k=0)
                ]
            )
        )

        def workFn(db, cells, iterations=5000):
            with db.view():
                thing = Thing.lookupAny(k=0)

            for counter in range(iterations):
                with db.transaction():
                    thing.delete()
                    thing = Thing(k=0, x=counter)

                cells.renderMessages()

        def initFn(db, cells):
            with db.transaction():
                Thing(k=0, x=0)

            cells.renderMessages()

            workFn(db, cells, iterations=500)

        self.helper_memory_leak(cell, initFn, workFn, 1)

    def test_header_bar(self):
        self.cells.withRoot(HeaderBar([]))

        self.cells.renderMessages()

    def test_cells_effect(self):
        # build a set of effects and see that they execute until they are quiet
        s0 = Slot(0)
        s1 = Slot(10)

        e1 = Effect(lambda: s0.set(min(s0.get() + 1, s1.get())))

        self.cells.withRoot(e1)
        self.cells.renderMessages()

        assert s0.getWithoutRegisteringDependency() == 10

        self.cells.scheduleUnconditionalCallback(lambda: s1.set(20))

        self.cells.renderMessages()

    def test_computed_slot_cycle(self):
        computedSlot1 = ComputedSlot(lambda: computedSlot2.get())
        computedSlot2 = ComputedSlot(lambda: computedSlot1.get())

        with pytest.raises(Exception, match="cyclic"):
            self.cells.executeCallback(lambda: computedSlot1.get())

        with pytest.raises(Exception, match="cyclic"):
            self.cells.calculateExpression(lambda: computedSlot1.get())

    def test_computed_slot_resets_on_slot(self):
        slot = Slot(0)
        computedSlot = ComputedSlot(lambda: slot.get())

        def callback():
            assert computedSlot.get() == slot.get()

            slot.set(1)
            assert computedSlot.get() == slot.get()
            computedSlot.get()
            slot.set(2)
            assert computedSlot.get() == slot.get()

            return True

        assert self.cells.executeCallback(callback)

    def test_computed_slot_resets_on_odb_value(self):
        with self.db.transaction():
            thing = Thing()

        computedSlot = ComputedSlot(lambda: thing.x)

        def callback():
            computedSlot.get()
            thing.x = 2
            assert computedSlot.get() == thing.x

            thing.x = 3
            assert computedSlot.get() == thing.x

            return True

        assert self.cells.executeCallback(callback)

    def test_computed_slot_resets_on_odb_index(self):
        computedSlot = ComputedSlot(lambda: len(Thing.lookupAll()))

        def callback():
            assert computedSlot.get() == 0

            Thing()

            assert computedSlot.get() == 1

            Thing()

            assert computedSlot.get() == 2

            return True

        assert self.cells.executeCallback(callback)

    def test_computed_slot_dependent_slots(self):
        slot = Slot(0)
        computedSlot = ComputedSlot(lambda: slot.get())
        computedSlot2 = ComputedSlot(lambda: computedSlot.get())

        def callback():
            assert computedSlot2.get() == 0
            slot.set(1)
            assert computedSlot2.get() == 1
            slot.set(2)
            assert computedSlot2.get() == 2

        self.cells.executeCallback(callback)

    def test_computed_slot_imports_correctly(self):
        # check that regardless of the order in which we read or cache
        # computed slots, the values are correct
        def checkScenario(N, firstRead, secondRead, write, thirdRead):
            """Make a chain of N slots.

            Calculate 'firstRead' of them.

            Then in a single transaction, check 'secondRead', increment
            'write', and then check 'thirdRead'

            This exercises pathways involving caching values from the
            main slots.
            """
            someSlots = [Slot(1) for _ in range(N)]

            def makeComputer(i):
                if i == 0:
                    return ComputedSlot(lambda: someSlots[i].get())

                return ComputedSlot(lambda: someSlots[i].get() + compSlots[i - 1].get())

            compSlots = [makeComputer(i) for i in range(N)]

            def checkCompSlot(i):
                total = 0
                for ix in range(i + 1):
                    total += someSlots[ix].get()

                assert compSlots[i].get() == total

                return True

            assert self.cells.calculateExpression(lambda: checkCompSlot(firstRead))

            def callback():
                checkCompSlot(secondRead)

                someSlots[write].set(someSlots[write].get() + 1)

                checkCompSlot(thirdRead)

                return True

            assert self.cells.executeCallback(callback)

            assert self.cells.calculateExpression(lambda: checkCompSlot(N - 1))

        N = 4

        for firstRead in range(N):
            for secondRead in range(N):
                for write in range(N):
                    for thirdRead in range(N):
                        checkScenario(N, firstRead, secondRead, write, thirdRead)

    def test_computed_slot_transitive_dependencies(self):
        N = 10

        with self.db.transaction():
            things = [Thing(x=i) for i in range(N)]
            outputThing = Thing(x=100)

        def makeGetsThing(i):
            return ComputedSlot(lambda: things[i].x)

        slots = [makeGetsThing(i) for i in range(N)]
        finalSlot = ComputedSlot(lambda: sum(slots[i].get() for i in range(N)))

        canProceedEvent = threading.Event()
        didWriteEvent = threading.Event()

        attemptedWrites = []

        def callback():
            outputThing.k = finalSlot.get()
            attemptedWrites.append(outputThing.k)
            didWriteEvent.set()
            canProceedEvent.wait(timeout=1)

        # in a background thread, ask Cells to process
        # a callback that attempts to write into the ODB
        # based on this computed value
        backgroundThread = threading.Thread(
            target=self.cells.executeCallback, args=(callback,)
        )
        backgroundThread.start()

        # wait for it to say that it has calculated a value
        didWriteEvent.wait(timeout=1)
        assert didWriteEvent.isSet()
        assert len(attemptedWrites) == 1

        # now let write a conflicting transaction in!
        with self.db.transaction():
            things[0].x += 1000

        canProceedEvent.set()
        backgroundThread.join(timeout=1)

        # we should see that it retried the transaction
        # and that it saw our increment
        assert len(attemptedWrites) == 2
        assert attemptedWrites[1] == attemptedWrites[0] + 1000

    def test_moving_cell(self):
        aCell = Text("SomeText")
        aSlot = Slot(0)

        self.cells.withRoot(
            Subscribed(lambda: aCell if aSlot.get() == 0 else None)
            + Subscribed(lambda: aCell if aSlot.get() == 1 else None)
        )

        self.cells.renderMessages()
        self.cells.executeCallback(lambda: aSlot.set(1))
        self.cells.renderMessages()
        self.cells.executeCallback(lambda: aSlot.set(0))
        self.cells.renderMessages()
        self.cells.executeCallback(lambda: aSlot.set(1))
        self.cells.renderMessages()

    def test_moving_cell_to_two_parents(self):
        aCell = Text("SomeText")
        aSlot = Slot(0)

        subA = Subscribed(lambda: aCell if aSlot.get() >= 0 else None)
        subB = Subscribed(lambda: aCell if aSlot.get() >= 1 else None)
        self.cells.withRoot(subA + subB)

        self.cells.renderMessages()
        assert not subA.isErrored()
        assert not subB.isErrored()

        self.cells.executeCallback(lambda: aSlot.set(1))
        self.cells.renderMessages()

        assert subA.isErrored()
        assert subB.isErrored()

    def test_time_is_after(self):
        t0 = time.time()
        timeIsAfter = TimeIsAfter(t0 + 0.5)

        self.cells.withRoot(Subscribed(lambda: "Yes" if timeIsAfter.get() else "No"))

        self.cells.renderMessages()
        assert not timeIsAfter.getWithoutRegisteringDependency()

        while not timeIsAfter.getWithoutRegisteringDependency() and time.time() < t0 + 1.0:
            self.cells.wait(timeout=t0 + 1.0 - time.time())
            self.cells.renderMessages()

        elapsed = time.time() - t0

        assert 0.5 < elapsed < 0.6

        assert timeIsAfter.getWithoutRegisteringDependency()

    def test_expands(self):
        sessionState = SessionState("sessionId")
        sessionState.setup(self.db)

        def makesAnExpander():
            return Expands(
                open=Subscribed(makesAnExpander) + Subscribed(makesAnExpander),
                closed=Text("closed"),
            )

        self.cells.withRoot(Subscribed(makesAnExpander), sessionState)

        self.cells.renderMessages()

        print("INITIAL TREE")
        self.cells.dumpTree()

        closed = self.cells.calculateExpression(
            lambda: self.cells.findChildrenMatching(
                lambda cell: isinstance(cell, Expands) and not cell.isExpanded
            )
        )

        assert len(closed) == 1
        self.cells.sendMessageToCellSynchronously(closed[0], {})
        self.cells.renderMessages()

        print("FINAL TREE")
        self.cells.dumpTree()

        closed = self.cells.calculateExpression(
            lambda: self.cells.findChildrenMatching(
                lambda cell: isinstance(cell, Expands) and not cell.isExpanded
            )
        )
        assert len(closed) == 2
