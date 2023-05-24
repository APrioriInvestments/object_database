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

from contextlib import contextmanager

import object_database


class ServiceRuntimeConfig:
    def __init__(
        self,
        dbConnectionFactory,
        serviceTemporaryStorageRoot,
        authToken,
        ownIpAddress,
        serviceInstance,
    ):
        self.dbConnectionFactory = dbConnectionFactory
        self.serviceTemporaryStorageRoot = serviceTemporaryStorageRoot
        self.authToken = authToken
        self.ownIpAddress = ownIpAddress
        self.serviceInstance = serviceInstance


class ServiceBase:
    coresUsed = 1
    gbRamUsed = 1

    def __init__(self, db, serviceObject, runtimeConfig):
        self.db = db
        self.serviceObject = serviceObject
        self.runtimeConfig = runtimeConfig
        self.registeredReactors = []
        self._reactorsRunning = False

        self.registeredThreads = []
        self._threadsStarted = False

    def configureLogging(self):
        """Subclasses may override this method to configure logging."""
        pass

    @staticmethod
    def configureFromCommandline(db, serviceObject, args):
        """Subclasses should take the remaining args from the commandline
        and configure using them
        """
        pass

    def initialize(self):
        pass

    def doWork(self, shouldStop):
        # subclasses may override if they are doing work outside of reactors.
        with self.reactorsRunning():
            shouldStop.wait()

    @staticmethod
    def serviceDisplay(serviceObject, instance=None, objType=None, queryArgs=None):
        return object_database.web.cells.Card(
            "No details provided for service '%s'" % serviceObject.name
        )

    @staticmethod
    def serviceHeaderToggles(serviceObject, instance=None, queryArgs=None):
        """Return a collection of widgets we want to stick in the top of the service display.

        If None, then we get a raw service display with nothing else."""
        return []

    def registerReactor(self, reactor):
        if self._reactorsRunning:
            raise Exception("Cannot register new reactors while reactors are already runing")

        self.registeredReactors.append(reactor)

    def startReactors(self):
        self._reactorsRunning = True
        for r in self.registeredReactors:
            r.start()

    def stopReactors(self):
        for r in self.registeredReactors:
            r.stop()
        self._reactorsRunning = False

    def teardownReactors(self):
        for r in self.registeredReactors:
            r.teardown()

    @contextmanager
    def reactorsRunning(self):
        self.startReactors()
        yield
        self.stopReactors()
        self.teardownReactors()

    def _raiseIfThreadsStarted(self):
        if self._threadsStarted:
            raise Exception("Cannot register new threads while threads are already running")

    def registerThread(self, thread):
        if self._threadsStarted:
            raise Exception("Cannot register new threads while threads are already running")

        self.registeredThreads.append(thread)

    def startThreads(self):
        if self._threadsStarted:
            raise Exception("Cannot register new threads while threads are already running")

        self._threadsStarted = True
        for thread in self.registeredThreads:
            thread.start()

    def joinThreads(self):
        # TODO
        pass
