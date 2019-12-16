import pytest
import time

from contextlib import contextmanager
from .reactor import Reactor


@pytest.fixture
def db(in_mem_connection):
    # if needed: in_mem_connection.subscribeToSchema(xyz)
    return in_mem_connection


_logs = []


def log():
    _logs.append(f"Message #{len(_logs) + 1}")


@contextmanager
def running_reactor(reactor):
    reactor.start()
    yield reactor
    reactor.stop()
    reactor.teardown()


def test_reactor_restarting(db):
    sleepAmt = 0.1
    r = Reactor(db, log, maxSleepTime=sleepAmt)
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
