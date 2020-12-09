import time
import pytest

from object_database.schema import Schema, Indexed
from .reactor import Reactor, Timeout

schema = Schema("test_schema")


@schema.define
class Counter:
    k = Indexed(int)
    x = int

    def f(self):
        return self.k + 1

    def __str__(self):
        return "Counter(k=%s)" % self.k


def test_reactor_restarting(db):
    sleepAmt = 0.1
    _logs = []

    def logger():
        _logs.append(f"Message #{len(_logs) + 1}")

    r = Reactor(db, logger, maxSleepTime=sleepAmt)
    assert len(_logs) == 0

    with r.running() as r:
        time.sleep(sleepAmt / 2)
        assert len(_logs) == 1
        time.sleep(sleepAmt)
        assert len(_logs) == 2

    time.sleep(sleepAmt)
    assert len(_logs) == 2

    with r.running(teardown=True) as r:
        time.sleep(sleepAmt / 2)
        assert len(_logs) == 3


@schema.define
class Status:
    on = bool
    count = int

    def set(self):
        if self.on is not True:
            self.on = True
            self.count += 1

    def clear(self):
        if self.on is not False:
            self.on = False
            self.count += 1


def test_reactor_invalid_uses(in_mem_odb_connection):
    def noop():
        time.sleep(0.01)

    r = Reactor(in_mem_odb_connection, noop)

    r.next()
    with pytest.raises(Exception, match="Reactor .* would block forever"):
        r.next()

    r.start()
    assert r.isRunning()
    time.sleep(0.1)
    assert not r.isRunning()

    with pytest.raises(Exception, match="Cannot call 'next'"):
        r.next()

    with pytest.raises(Exception, match="Cannot tear down"):
        r.teardown()

    r.stop()
    r.teardown()

    with pytest.raises(Exception, match="Cannot use reactor"):
        r.start()

    with pytest.raises(Exception, match="Cannot use reactor"):
        r.next()


def test_reactor_useless_machine(db):
    db.subscribeToSchema(schema)

    with db.transaction():
        s = Status(on=True)

    def turnOn():
        with db.transaction():
            status = Status.lookupOne()
            status.set()

    def getStatus():
        with db.view():
            return Status.lookupOne().on

    def useless_machine():
        with db.transaction():
            status = Status.lookupOne()
            status.clear()

    r = Reactor(db, useless_machine)
    assert getStatus() is True

    REACTION_TIME = 0.01

    with r.running():
        assert db.waitForCondition(lambda: s.on is False, REACTION_TIME)
        assert getStatus() is False

        turnOn()
        assert db.waitForCondition(lambda: s.on is False, REACTION_TIME)
        assert getStatus() is False

    turnOn()
    assert not db.waitForCondition(lambda: s.on is False, 5 * REACTION_TIME)

    # we can restart the Reactor
    assert getStatus() is True
    with r.running(teardown=True):
        assert db.waitForCondition(lambda: s.on is False, REACTION_TIME)
        assert getStatus() is False


def test_reactor_threaded(db):
    db.subscribeToSchema(schema)

    executed = [0]

    def incrementor():
        with db.transaction():
            for c in Counter.lookupAll():
                if c.x != 0:
                    executed[0] += 1
                    c.k += c.x
                    c.x = 0

    r1 = Reactor(db, incrementor)

    with r1.running(teardown=True):
        time.sleep(0.10)
        assert executed[0] == 0

        with db.transaction():
            c = Counter(k=0, x=100)

        db.waitForCondition(lambda: c.k == 100, 2.0)

        with db.view():
            assert c.k == 100
            assert c.x == 0
            assert executed[0] == 1

        with db.transaction():
            c.x += 2

        db.waitForCondition(lambda: c.k == 102, 2.0)

        with db.view():
            assert c.k == 102
            assert c.x == 0
            assert executed[0] == 2


def test_reactor_with_exception(db):
    db.subscribeToSchema(schema)

    with db.transaction():
        c = Counter(k=0, x=0)

    executed = [0]
    raised = [0]

    def incrementor():
        shouldRaise = False

        with db.transaction():
            executed[0] += 1
            if c.x:
                raised[0] += 1
                c.x = 0
                shouldRaise = True

        if shouldRaise:
            raise Exception("Raising exception for Testing")

    r1 = Reactor(db, incrementor)

    with r1.running(teardown=True):
        for _ in range(10):
            with db.transaction():
                c.x = 1

            assert db.waitForCondition(lambda: c.x == 0, timeout=1.0) is True

    assert raised[0] == 10
    assert executed[0] > raised[0]


def test_unstarted_reactor(db):
    # check that an unstarted or stopped reactor doesn't track
    # all transactions forever
    s = Schema("schema")

    @s.define
    class Thing:
        x = int
        y = int

    db.subscribeToSchema(s)

    def incrementor():
        with db.transaction():
            for t in Thing.lookupAll():
                if t.y != t.x:
                    t.y = t.x

    r1 = Reactor(db, incrementor)

    with db.transaction():
        someThings = [Thing(x=i, y=i) for i in range(10)]

    db.flush()
    assert r1._transactionQueue.qsize() == 0

    with db.transaction():
        for t in someThings:
            t.x = t.x + 1

    db.flush()
    assert r1._transactionQueue.qsize() == 0

    r1.start()

    assert db.waitForCondition(lambda: all(t.x == t.y for t in Thing.lookupAll()), timeout=2.0)

    r1.stop()

    with db.transaction():
        for t in someThings:
            t.x = t.x + 1

    db.flush()

    assert r1._transactionQueue.qsize() == 0


def test_reactor_with_timestamp_lookup(db):
    # check the semantics of 'curTimestampIsAfter'
    t0 = time.time()

    s = Schema("schema")

    @s.define
    class Thing:
        nextUpdate = float
        timesUpdated = int

    db.subscribeToSchema(s)

    with db.transaction():
        someThings = [Thing(nextUpdate=t0 + 0.001, timesUpdated=0) for _ in range(10)]

    def incrementor():
        with db.transaction():
            for t in someThings:
                if Reactor.curTimestampIsAfter(t.nextUpdate):
                    t.nextUpdate += 0.01
                    t.timesUpdated += 1

    def updateCount():
        with db.view():
            return sum([x.timesUpdated for x in Thing.lookupAll()])

    r1 = Reactor(db, incrementor)

    while updateCount() < 1000 and time.time() - t0 < 2.0:
        r1.next(timeout=1.0)

    assert time.time() - t0 < 1.2

    with r1.running(teardown=True):
        assert db.waitForCondition(
            lambda: sum(x.timesUpdated for x in Thing.lookupAll()) >= 2000, timeout=2.0
        )
        assert time.time() - t0 < 2.2


def test_reactor_synchronous(db):
    db.subscribeToSchema(schema)

    def incrementor():
        executed = 0
        with db.transaction():
            for c in Counter.lookupAll():
                if c.x != 0:
                    executed += 1
                    c.k += c.x
                    c.x = 0

        return executed

    r1 = Reactor(db, incrementor)

    assert r1.next(timeout=0.01) == 0
    assert r1.next(timeout=0.01) is Timeout

    with db.transaction():
        c = Counter(k=0, x=100)

    assert r1.next(timeout=0.01) == 1
    assert r1.next(timeout=0.01) == 0
    assert r1.next(timeout=0.01) is Timeout

    with db.view():
        assert c.k == 100
        assert c.x == 0

    with db.transaction():
        c.x += 2

    assert r1.next(timeout=0.01) == 1
    assert r1.next(timeout=0.01) == 0
    assert r1.next(timeout=0.01) is Timeout

    with db.view():
        assert c.k == 102
        assert c.x == 0

    r1.teardown()


def test_reactor_block_until_true(db):
    db.subscribeToSchema(schema)

    checkCount = [0]
    incrementCount = [0]

    def incrementor():
        incrementCount[0] += 1
        # move '1' from any nonzero 'x' to 'k'
        with db.transaction():
            for c in Counter.lookupAll():
                if c.x > 0:
                    c.k += 1
                    c.x -= 1

        time.sleep(0.001)

    def checker():
        # Check if any counters exist with x > 0
        checkCount[0] += 1
        with db.view():
            for c in Counter.lookupAll():
                if c.x > 0:
                    return False
        return True

    incrementor = Reactor(db, incrementor)
    checker = Reactor(db, checker)

    with incrementor.running(teardown=True):
        with db.transaction():
            c = Counter(k=0, x=10)

        assert not checker.blockUntilTrue(timeout=0.00001)
        assert checker.blockUntilTrue(timeout=1.0)

        assert incrementCount[0] >= 10
        assert checkCount[0] >= 5

        with db.transaction():
            c.x += 5

        assert not checker.blockUntilTrue(timeout=0.00001)
        assert checker.blockUntilTrue(timeout=1.0)

        assert incrementCount[0] >= 15
        assert checkCount[0] >= 8

    checker.teardown()


def test_curTimestamp_exceptions(db):
    """ Test the exceptional paths of curTimestamp and curTimestampIsAfter """
    assert Reactor.curTimestamp() is None

    with pytest.raises(TypeError):
        Reactor.curTimestampIsAfter("now")

    with pytest.raises(Exception, match="No reactor is running"):
        Reactor.curTimestampIsAfter(0)
