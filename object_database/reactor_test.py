import time

from .reactor import Reactor


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
