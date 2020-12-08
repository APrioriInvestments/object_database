#   Copyright 2019 Nativepython authors
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

import logging
import queue
import threading
import time

from contextlib import contextmanager
from object_database.view import RevisionConflictException, ViewWatcher


class Timeout:
    """Singleton used to indicate that the reactor timed out."""

    pass


class DeadlockException(Exception):
    pass


_currentReactor = threading.local()


class Reactor:
    """Reactor

    Repeatedly executes a function until it no longer produces a new writes.
    Waits for any new transactions to come in that would re-trigger it.

    The function should take no arguments, and should create a sequence of
    views and transactions (using only the database_connection specified in
    the reactor). If a function call produces no actual writes, then the
    reactor will go to sleep until one of the keys that was read in the most
    recent pass through the function is touched. Otherwise it will continue
    calling the reactor function.

    If the function raises a RevisionConflictException, we will retry the
    entire function from the beginning. If the function raises any other
    exception the Reactor will log an exception and exit its loop.

    You may also specify a periodic wakup time, which causes the reactor
    to run at least that frequently.

    Reactors can run inside a thread, using 'start/stop' semantics, or
    synchronously, where the client calls 'next', which returns the
    next function call result, or Timeout if the reactor doesn't want
    to retrigger within the timeout. This can be useful for watching for
    a condition.

    Finally, you may call 'blockUntilTrue' if you want to wait until
    the function returns a non-false value.

    Example:

        def consumeOne():
            with db.transaction():
                t = T.lookupAny()
                if t is not None:
                    print("Consumed one")
                    t.delete()

        # 1. Reactor in daemonic thread (explicit)
        r1 = Reactor(db, consumeOne)
        r1.start()

        ...

        r1.stop()
        r1.teardown()

        # 2. Reactor in daemonic thread (with-block)
        r2 = Reactor(db, consumeOne)
        with r2.running() as r2:
            ...

        r2.teardown()

        # 3. Reactor used synchronously
        r3 = Reactor(db, consumeOne)
        r3.next(timeout=1.0)
        r3.next(timeout=1.0)

        ...

        r3.teardown()

    """

    class STOP:
        """singleton class to indicate that we should exit the loop."""

        pass

    def __init__(self, db, reactorFunction, maxSleepTime=None):
        self.db = db
        self.reactorFunction = reactorFunction
        self.maxSleepTime = maxSleepTime

        self._transactionQueue = queue.Queue()
        self._wantRecordTransactions = False
        self._thread = None
        self._isStarted = False
        self._lastReadKeys = None
        self._nextWakeup = None

        # grab a transaction handler. We need to ensure this is the same object
        # when we deregister it.
        self.transactionHandler = self._onTransaction
        self.db.registerOnTransactionHandler(self.transactionHandler)
        self._isTornDown = False

    @staticmethod
    def curTimestamp():
        """Return the timestamp of the start of the current transaction or None.

        This does _not_ create a dependency.
        """
        return getattr(_currentReactor, "timestamp", None)

    @staticmethod
    def curTimestampIsAfter(ts):
        """Returns True if the timestamp of the current reactor invocation is after 'ts'.

        This allows clients to check if the current time is after a threshold and
        ensure that they are woken up as soon as that condition is met.

        If this function returns False, it causes the Reactor to wake up
        as soon at it would return True.
        """
        if not isinstance(ts, (int, float)):
            raise TypeError(f"Timestamp `ts` must be of type float but was of type {type(ts)}")

        curTime = Reactor.curTimestamp()
        if curTime is None:
            raise Exception("No reactor is running.")

        if curTime >= ts:
            return True

        if _currentReactor.nextWakeup is None or _currentReactor.nextWakeup > ts:
            _currentReactor.nextWakeup = ts

        return False

    def start(self):
        if self._thread is not None:
            return

        if self._isTornDown:
            raise Exception("Cannot use reactor after it has been torn down")

        self._thread = threading.Thread(target=self._updateLoop, daemon=True)
        self._isStarted = True
        self._thread.start()

    def stop(self):
        if self._thread is None:
            return

        self._isStarted = False
        self._transactionQueue.put(Reactor.STOP)
        self._thread.join()
        self._thread = None

    def isRunning(self):
        if self._thread is None:
            return False
        return self._thread.is_alive()

    @contextmanager
    def running(self, teardown=False):
        self.start()
        yield self
        self.stop()
        if teardown:
            self.teardown()

    def teardown(self):
        """Remove this reactor from the object_database.

        Clients should _always_ call this when they are done, even though
        the __del__ method calls it, because calling __del__ is done on a
        best-effort basis in python.
        """
        if self._thread is not None:
            raise Exception("Cannot tear down reactor while its background thread is running")

        self._isTornDown = True
        self.db.dropTransactionHandler(self.transactionHandler)

    def __del__(self):
        self.teardown()

    def blockUntilTrue(self, timeout=None):
        """Block until the reactor function returns 'True'.

        Returns True if we succeed, False if we exceed the threshold.
        """
        if timeout is None:
            while not self.next():
                pass

            return True
        else:
            curTime = time.time()
            timeThreshold = curTime + timeout

            while curTime < timeThreshold:
                result = self.next(timeout=timeThreshold - curTime)

                if result is Timeout:
                    return False

                if result:
                    return True

                curTime = time.time()

            return False

    def next(self, timeout=None):
        if self._thread is not None:
            raise Exception(
                "Cannot call 'next' if the reactor is being used in threaded mode."
            )

        if self._isTornDown:
            raise Exception("Cannot use reactor after it has been torn down.")

        if self._lastReadKeys is not None:
            if not self._blockUntilRecalculate(
                self._lastReadKeys, self._nextWakeup, timeout=timeout
            ):
                return Timeout

        self._drainTransactionQueue()
        self._wantRecordTransactions = True

        result, self._lastReadKeys, self._nextWakeup = self._calculate(
            catchRevisionConflicts=False
        )

        return result

    def _updateLoop(self):
        try:
            """Update as quickly as possible."""
            exceptionsInARow = 0
            readKeys = None

            while self._isStarted:
                self._drainTransactionQueue()
                self._wantRecordTransactions = True

                try:
                    _, readKeys, nextWakeup = self._calculate(catchRevisionConflicts=True)
                    exceptionsInARow = 0

                except Exception:
                    exceptionsInARow += 1
                    if (
                        exceptionsInARow < 10
                        or exceptionsInARow < 100
                        and exceptionsInARow % 10 == 0
                        or exceptionsInARow % 100 == 0
                    ):
                        logging.exception(
                            "Unexpected exception in Reactor user code "
                            "(%s occurrences in a row):",
                            exceptionsInARow,
                        )
                    time.sleep(0.001 * exceptionsInARow)

                if readKeys is not None:
                    # make sure we have not been disabled. It's possible
                    # someone wrote a wakeup message into the queue,
                    # which we drained after checking _isStarted.
                    # because they always set _isStarted _before_ writing
                    # into the transaction queue, even if we accidentally
                    # dropped that message, we should still exit now.
                    if not self._isStarted:
                        self._wantRecordTransactions = False
                        self._drainTransactionQueue()
                        return

                    self._blockUntilRecalculate(readKeys, nextWakeup, self.maxSleepTime)

                self._wantRecordTransactions = False
                self._drainTransactionQueue()

        except DeadlockException:
            raise
        except Exception:
            logging.exception("Unexpected exception in Reactor loop:")

    def _blockUntilRecalculate(self, readKeys, nextWakeup, timeout):
        """Wait until we're triggered, or hit a timeout.

        Returns:
            True if we were triggered by a key update, False otherwise.
        """
        if not readKeys and timeout is None and nextWakeup is None:
            raise DeadlockException(f"Reactor on {self.reactorFunction} would block forever.")

        curTime = time.time()
        finalTime = curTime + (timeout if timeout is not None else 10 ** 8)
        if nextWakeup is not None and finalTime > nextWakeup:
            finalTime = nextWakeup

        while curTime < finalTime:
            try:
                result = self._transactionQueue.get(timeout=finalTime - curTime)
            except queue.Empty:
                return False

            if result is Reactor.STOP:
                return False

            for key in result:
                if key in readKeys:
                    return True

            curTime = time.time()

        if nextWakeup is not None and curTime > nextWakeup:
            return True

        return False

    def _drainTransactionQueue(self):
        self._transactionQueue = queue.Queue()

    def _calculate(self, catchRevisionConflicts):
        """Calculate the reactor function.

        Returns:
            (functionResult, keySet, nextWakeup)

            functionResult will be the actual result of the function,
            or None if it threw a RevisionConflictException

            keySet will be the set of keys to check for updates, which could be empty.

            nextWakeup will be None unless it was updated by `curTimestampIsAfter`
            or unless the reactor needs to re-execute immediately due to a write,
            in which cases nextWakeup will be the timestamp at which the reactor
            should re-execute.
        """
        try:
            seenKeys = set()
            hadWrites = [False]

            def onViewClose(view, isException):
                if hadWrites[0]:
                    return

                if view._view.extractWrites():
                    hadWrites[0] = True
                    return

                seenKeys.update(view._view.extractReads())
                seenKeys.update(view._view.extractIndexReads())

            currentStartTimestamp = time.time()
            with ViewWatcher(onViewClose):
                try:
                    origTimestamp = getattr(_currentReactor, "timestamp", None)
                    origWakeup = getattr(_currentReactor, "nextWakeup", None)

                    _currentReactor.timestamp = currentStartTimestamp
                    _currentReactor.nextWakeup = None

                    logging.getLogger(__name__).debug(
                        "Reactor %s recalculating", self.reactorFunction
                    )
                    functionResult = self.reactorFunction()

                    nextWakeup = _currentReactor.nextWakeup

                finally:
                    _currentReactor.nextWakeup = origWakeup
                    _currentReactor.timestamp = origTimestamp

            if hadWrites[0]:
                nextWakeup = currentStartTimestamp

            return functionResult, seenKeys, nextWakeup

        except RevisionConflictException as e:
            if not catchRevisionConflicts:
                raise

            logging.getLogger(__name__).info(
                "Handled a revision conflict on key %s in %s. Retrying."
                % (e, self.reactorFunction.__name__)
            )
            return None, seenKeys, currentStartTimestamp

    def _onTransaction(self, key_value, set_adds, set_removes, transactionId):
        if self._wantRecordTransactions:
            self._transactionQueue.put(list(key_value) + list(set_adds) + list(set_removes))
