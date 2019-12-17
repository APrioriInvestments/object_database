import time

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
    thrown = [0]

    def incrementor():
        shouldThrow = False

        with db.transaction():
            executed[0] += 1
            if c.x:
                thrown[0] += 1
                c.x = 0
                shouldThrow = True

        assert not shouldThrow

    r1 = Reactor(db, incrementor)

    with r1.running():
        for _ in range(10):
            with db.transaction():
                c.x = 1

            assert db.waitForCondition(lambda: c.x == 0, timeout=1.0) is True

    assert thrown[0] == 10
    assert executed[0] > thrown[0]


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
                    t.nextUpdate = t.nextUpdate + 0.01
                    t.timesUpdated += 1

    def updateCount():
        with db.view():
            return sum([x.timesUpdated for x in Thing.lookupAll()])

    r1 = Reactor(db, incrementor)

    while updateCount() < 1000 and time.time() - t0 < 2.0:
        r1.next(timeout=1.0)

    assert time.time() - t0 < 1.2

    r1.start()
    assert db.waitForCondition(
        lambda: sum(x.timesUpdated for x in Thing.lookupAll()) >= 2000, timeout=2.0
    )
    assert time.time() - t0 < 2.2
    r1.stop()


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
