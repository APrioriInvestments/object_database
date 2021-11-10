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

import logging
import numpy
import os
import psutil
import sys
import tempfile
import textwrap
import time
import unittest
import pytest
from flaky import flaky

from object_database.service_manager.ServiceManagerTestCommon import ServiceManagerTestCommon
from object_database.service_manager.ServiceManager import ServiceManager
from object_database.service_manager.ServiceBase import ServiceBase
import object_database.service_manager.ServiceInstance as ServiceInstance
from object_database.web.cells import (
    Card,
    ensureSubscribedType,
)

from object_database import Schema, Indexed, core_schema, service_schema, Reactor

ownDir = os.path.dirname(os.path.abspath(__file__))
ownName = os.path.basename(os.path.abspath(__file__))

schema = Schema("core.ServiceManagerTest")


@schema.define
class MockServiceCounter:
    k = int


@schema.define
class PointsToShow:
    timestamp = float
    y = float


@schema.define
class Feigenbaum:
    y = float
    density = int


@schema.define
class MockServiceLastTimestamp:
    connection = Indexed(core_schema.Connection)
    lastPing = float
    triggerHardKill = bool
    triggerSoftKill = bool
    version = int
    ownIp = str

    @staticmethod
    def aliveServices(window=None):
        res = []

        for i in MockServiceLastTimestamp.lookupAll():
            if i.connection.exists() and (window is None or time.time() - i.lastPing < window):
                res.append(i)

        return res

    @staticmethod
    def aliveCount(window=None):
        return len(MockServiceLastTimestamp.aliveServices(window))

    @staticmethod
    def allCount(window=None):
        return len(MockServiceLastTimestamp.lookupAll())


class MockService(ServiceBase):
    gbRamUsed = 0
    coresUsed = 0

    def initialize(self):
        self.db.subscribeToSchema(core_schema, service_schema, schema)

        with self.db.transaction():
            self.conn = MockServiceLastTimestamp(connection=self.db.connectionObject)
            self.version = 0
            self.conn.ownIp = self.runtimeConfig.ownIpAddress

    def doWork(self, shouldStop):
        while not shouldStop.is_set():
            time.sleep(0.01)

            with self.db.transaction():
                if self.conn.triggerSoftKill:
                    return

                if self.conn.triggerHardKill:
                    os._exit(1)

                self.conn.lastPing = time.time()


class HangingService(ServiceBase):
    gbRamUsed = 0
    coresUsed = 0

    def initialize(self):
        self.db.subscribeToSchema(core_schema, service_schema, schema)

        with self.db.transaction():
            self.conn = MockServiceLastTimestamp(connection=self.db.connectionObject)
            self.version = 0

    def doWork(self, shouldStop):
        time.sleep(120)


class UninitializableService(ServiceBase):
    def initialize(self):
        assert False


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


class ReactorService(ServiceBase):
    def initialize(self):
        self.db.subscribeToSchema(core_schema, service_schema, schema)
        reactor = Reactor(self.db, self.reactorFun)
        self.registerReactor(reactor)
        print("Initialized ReactorService", flush=True)

    def reactorFun(self):
        print("Reactor executing", flush=True)
        with self.db.transaction():
            status = Status.lookupOne()
            status.clear()


simpleTestServiceSchema = Schema("core.test.simpleTestService")


@simpleTestServiceSchema.define
class SimpleTestObject:
    i = int

    def display(self, queryParams=None):
        ensureSubscribedType(SimpleTestObject)
        return Card("SimpleTestObject %s. " % self.i + str(queryParams))


class SimpleTestService(ServiceBase):
    def initialize(self):
        pass

    def doWork(self, shouldStop):
        self.db.subscribeToSchema(simpleTestServiceSchema)

        with self.db.transaction():
            h = SimpleTestObject(i=1)
            h = SimpleTestObject(i=2)

        while not shouldStop.is_set():
            shouldStop.wait(0.5)
            with self.db.transaction():
                h = SimpleTestObject()

            shouldStop.wait(0.5)
            with self.db.transaction():
                h.delete()


class StorageTest(ServiceBase):
    def initialize(self):
        with open(
            os.path.join(self.runtimeConfig.serviceTemporaryStorageRoot, "a.txt"), "w"
        ) as f:
            f.write("This exists")

        self.db.subscribeToSchema(core_schema, service_schema, schema)

        with self.db.transaction():
            self.conn = MockServiceLastTimestamp(connection=self.db.connectionObject)
            self.version = 0

    def doWork(self, shouldStop):
        shouldStop.wait()


class CrashingService(ServiceBase):
    def initialize(self):
        assert False

    def doWork(self, shouldStop):
        time.sleep(0.5)
        assert False


waiting = Schema("core.test.waiting")


@waiting.define
class Initialized:
    pass


@waiting.define
class Stopped:
    pass


class WaitForService(ServiceBase):
    def initialize(self):
        self.db.subscribeToSchema(waiting)

        with self.db.transaction():
            assert Initialized.lookupAny() is None
            Initialized()

    def doWork(self, shouldStop):
        while not shouldStop.is_set():
            time.sleep(0.5)

        with self.db.transaction():
            assert Stopped.lookupAny() is None
            Stopped()


def getTestServiceModule(version):
    return {
        "test_service/__init__.py": "",
        "test_service/service.py": textwrap.dedent(
            """
            from object_database import (
                Schema,
                ServiceBase,
                Indexed,
                core_schema,
                service_schema,
            )
            import os
            import time
            import logging

            schema = Schema("core.ServiceManagerTest")

            @schema.define
            class MockServiceLastTimestamp:
                connection = Indexed(core_schema.Connection)
                lastPing = float
                triggerHardKill = bool
                triggerSoftKill = bool
                version = int

            class Service(ServiceBase):
                def initialize(self):
                    self.db.subscribeToSchema(core_schema, service_schema, schema)

                    with self.db.transaction():
                        self.conn = MockServiceLastTimestamp(
                            connection=self.db.connectionObject
                        )
                        self.conn.version = {version}

                def doWork(self, shouldStop):
                    while not shouldStop.is_set():
                        time.sleep(0.01)

                        with self.db.transaction():
                            if self.conn.triggerSoftKill:
                                return

                            if self.conn.triggerHardKill:
                                os._exit(1)

                            self.conn.lastPing = time.time()
            """.format(
                version=version
            )
        ),
    }


class ServiceManagerTest(ServiceManagerTestCommon, unittest.TestCase):
    def schemasToSubscribeTo(self):
        return [schema]

    def setCountAndBlock(self, count):
        with self.database.transaction():
            ServiceManager.startService("MockService", count)
        self.waitForCount(count)

    def waitForCount(self, count, timeout=5.0):
        def checkAliveCount():
            logging.info(
                "ALIVE COUNT IS %s (of %s total)",
                MockServiceLastTimestamp.aliveCount(),
                MockServiceLastTimestamp.allCount(),
            )
            return MockServiceLastTimestamp.aliveCount() == count

        self.assertTrue(
            self.database.waitForCondition(
                checkAliveCount, timeout=timeout * self.ENVIRONMENT_WAIT_MULTIPLIER
            )
        )

    def test_starting_services(self):
        with self.database.transaction():
            ServiceManager.createOrUpdateService(MockService, "MockService", target_count=1)

        self.waitForCount(1)

    def test_own_ip_populated(self):
        with self.database.transaction():
            ServiceManager.createOrUpdateService(MockService, "MockService", target_count=1)

        self.waitForCount(1)

        with self.database.view():
            state = MockServiceLastTimestamp.lookupAny()

            # we should always know our ip as 127.0.0.1 because we infer it from
            # the server we connect to, and we connected to localhost.
            self.assertEqual(state.ownIp, "127.0.0.1")

    def test_service_storage(self):
        with self.database.transaction():
            ServiceManager.createOrUpdateService(StorageTest, "StorageTest", target_count=1)

        self.waitForCount(1)

    def test_starting_uninitializable_services(self):
        with self.database.transaction():
            svc = ServiceManager.createOrUpdateService(
                UninitializableService, "UninitializableService", target_count=1
            )

        self.assertTrue(
            self.database.waitForCondition(
                lambda: svc.timesBootedUnsuccessfully == ServiceInstance.MAX_BAD_BOOTS,
                timeout=10 * self.ENVIRONMENT_WAIT_MULTIPLIER,
            )
        )

        with self.database.view():
            self.assertEqual(svc.effectiveTargetCount(), 0)

        with self.database.transaction():
            svc.resetCounters()

        with self.database.view():
            self.assertEqual(svc.effectiveTargetCount(), 1)

        self.assertTrue(
            self.database.waitForCondition(
                lambda: svc.timesBootedUnsuccessfully == ServiceInstance.MAX_BAD_BOOTS,
                timeout=10 * self.ENVIRONMENT_WAIT_MULTIPLIER,
            )
        )

    def test_waitfor_service(self):
        self.database.subscribeToSchema(waiting)
        svcName = "WaitForService"

        def test_once(timeout=None):
            if timeout is None:
                timeout = 6.0 * self.ENVIRONMENT_WAIT_MULTIPLIER
            with self.database.transaction():
                self.assertIsNone(Initialized.lookupAny())
                self.assertIsNone(Stopped.lookupAny())
                ServiceManager.createOrUpdateService(WaitForService, svcName)
                ServiceManager.startService(svcName)

            ServiceManager.waitRunning(self.database, svcName, timeout=timeout)

            with self.database.view():
                self.assertIsNotNone(Initialized.lookupAny())

            with self.database.transaction():
                ServiceManager.stopService(svcName)

            self.assertTrue(
                ServiceManager.waitStopped(self.database, svcName, timeout=timeout)
            )

            with self.database.view():
                self.assertIsNotNone(Stopped.lookupAny())

            with self.database.transaction():
                for obj in Initialized.lookupAll():
                    obj.delete()

                for obj in Stopped.lookupAll():
                    obj.delete()

        for ix in range(10):
            test_once()

    def test_reactor_service(self):
        with self.database.transaction():
            s = Status(on=True)
            ServiceManager.createOrUpdateService(
                ReactorService, "ReactorService", target_count=1
            )

        with self.database.transaction():
            ServiceManager.startService("ReactorService", 1)

        self.assertTrue(self.database.waitForCondition(lambda: s.on is False, 5))

        with self.database.transaction():
            self.assertEqual(s.count, 1)
            s.set()
            self.assertEqual(s.count, 2)

        self.assertTrue(self.database.waitForCondition(lambda: s.on is False, 0.5))
        with self.database.view():
            self.assertEqual(s.count, 3)

    def test_delete_service(self):
        def getInstances(db=None):
            if db is not None:
                with db.view():
                    return service_schema.ServiceInstance.lookupAll()
            else:
                return service_schema.ServiceInstance.lookupAll()

        with self.database.view():
            self.assertEqual(len(getInstances()), 0)

        with self.database.transaction():
            ServiceManager.createOrUpdateService(
                SimpleTestService, "SimpleTestService", target_count=1
            )

        self.assertTrue(self.database.waitForCondition(lambda: len(getInstances()) == 1, 1))

        with self.database.transaction():
            for service in service_schema.Service.lookupAll():
                service.delete()

        self.assertTrue(self.database.waitForCondition(lambda: len(getInstances()) == 0, 10))

    def test_remove_service(self):
        with self.database.view():
            services = service_schema.Service.lookupAll()
            self.assertEqual(len(services), 0)
            instances = service_schema.ServiceInstance.lookupAll()
            self.assertEqual(len(instances), 0)

        with self.database.transaction():
            ServiceManager.createOrUpdateService(
                SimpleTestService, "SimpleTestService", target_count=2
            )

        self.assertTrue(
            self.database.waitForCondition(
                lambda: len(service_schema.ServiceInstance.lookupAll()) == 2, 1
            )
        )

        with self.database.view():
            services = service_schema.Service.lookupAll()
            self.assertEqual(len(services), 1)
            instances = service_schema.ServiceInstance.lookupAll()
            self.assertEqual(len(instances), 2)

        with self.database.transaction():
            with self.assertRaisesRegex(Exception, "Failed to remove"):
                ServiceManager.removeService("SimpleTestService")

            ServiceManager.stopService("SimpleTestService")

        def serviceState():
            with self.database.view():
                service = service_schema.Service.lookupAny(name="SimpleTestService")
                instances = service_schema.ServiceInstance.lookupAll(service=service)
                return [i.state for i in instances]

        timeout = 6.0 * self.ENVIRONMENT_WAIT_MULTIPLIER
        self.assertTrue(
            ServiceManager.waitStopped(self.database, "SimpleTestService", timeout),
            serviceState(),
        )

        with self.database.transaction():
            ServiceManager.removeService("SimpleTestService")
            services = service_schema.Service.lookupAll()
            self.assertEqual(len(services), 0)
            instances = service_schema.ServiceInstance.lookupAll()
            self.assertEqual(len(instances), 0)

    def test_force_remove_service(self):
        with self.database.view():
            services = service_schema.Service.lookupAll()
            self.assertEqual(len(services), 0)
            instances = service_schema.ServiceInstance.lookupAll()
            self.assertEqual(len(instances), 0)

        with self.database.transaction():
            ServiceManager.createOrUpdateService(
                SimpleTestService, "SimpleTestService", target_count=2
            )

        self.assertTrue(
            self.database.waitForCondition(
                lambda: len(service_schema.ServiceInstance.lookupAll()) == 2, 1
            )
        )

        with self.database.view():
            services = service_schema.Service.lookupAll()
            self.assertEqual(len(services), 1)
            instances = service_schema.ServiceInstance.lookupAll()
            self.assertEqual(len(instances), 2)

        with self.database.transaction():
            ServiceManager.removeService("SimpleTestService", force=True)
            services = service_schema.Service.lookupAll()
            self.assertEqual(len(services), 0)
            instances = service_schema.ServiceInstance.lookupAll()
            self.assertEqual(len(instances), 0)

    @flaky(max_runs=3, min_passes=1)
    def test_racheting_service_count_up_and_down(self):
        with self.database.transaction():
            ServiceManager.createOrUpdateService(MockService, "MockService", target_count=1)

        numpy.random.seed(42)

        for count in numpy.random.choice(6, size=40):
            logging.getLogger(__name__).info(
                "Setting count for MockService to %s and waiting for it to be alive.", count
            )

            with self.database.transaction():
                ServiceManager.startService("MockService", int(count))

            self.waitForCount(count)

        with self.database.transaction():
            ServiceManager.startService("MockService", 0)

        self.waitForCount(0)

        # make sure we don't have a bunch of zombie processes
        # hanging underneath the service manager
        time.sleep(1.0)
        self.assertEqual(len(psutil.Process().children()[0].children()), 0)

    def test_shutdown_hanging_services(self):
        with self.database.transaction():
            ServiceManager.createOrUpdateService(
                HangingService, "HangingService", target_count=10
            )

        self.waitForCount(10)

        t0 = time.time()

        with self.database.transaction():
            ServiceManager.startService("HangingService", 0)

        self.waitForCount(0)

        self.assertLess(time.time() - t0, 2.0 * self.ENVIRONMENT_WAIT_MULTIPLIER)

        # make sure we don't have a bunch of zombie processes
        # hanging underneath the service manager
        time.sleep(1.0)
        self.assertEqual(len(psutil.Process().children()[0].children()), 0)

    @flaky(max_runs=3, min_passes=1)
    def test_redeploy_hanging_services(self):
        with self.database.transaction():
            ServiceManager.createOrUpdateService(
                HangingService, "HangingService", target_count=10
            )

        self.waitForCount(10)

        with self.database.view():
            instances = service_schema.ServiceInstance.lookupAll()

            # this is a builtin service
            self.assertTrue(instances[0].codebase is None)

        with self.database.transaction():
            ServiceManager.createOrUpdateService(
                "test_service.service.Service",
                "HangingService",
                10,
                codebase=service_schema.Codebase.createFromFiles(getTestServiceModule(2)),
            )

        # this should force a redeploy.
        maxProcessesEver = [0]

        def checkIfRedeployedSuccessfully():
            maxProcessesEver[0] = max(
                maxProcessesEver[0], len(psutil.Process().children()[0].children())
            )

            if not all(
                x.codebase is not None for x in service_schema.ServiceInstance.lookupAll()
            ):
                return False

            if len(service_schema.ServiceInstance.lookupAll()) != 10:
                return False

            return True

        self.database.waitForCondition(checkIfRedeployedSuccessfully, 20)

        with self.database.view():
            instances_redeployed = service_schema.ServiceInstance.lookupAll()

            self.assertEqual(len(instances), 10)
            self.assertEqual(len(instances_redeployed), 10)
            self.assertEqual(len(set(instances).intersection(set(instances_redeployed))), 0)

        # and we never became too big!
        self.assertLess(maxProcessesEver[0], 11)

    def measureThroughput(self, seconds):
        t0 = time.time()

        with self.database.transaction():
            c = MockServiceCounter()

        while time.time() - t0 < seconds:
            with self.database.transaction():
                c.k = c.k + 1

        with self.database.view():
            return c.k / seconds

    @flaky(max_runs=3, min_passes=1)
    def test_throughput_while_adjusting_servicecount(self):
        with self.database.transaction():
            ServiceManager.createOrUpdateService(MockService, "MockService", target_count=0)

        emptyThroughputs = [self.measureThroughput(1.0)]
        fullThroughputs = []

        for i in range(2):
            with self.database.transaction():
                ServiceManager.startService("MockService", 10)

            self.waitForCount(10)

            fullThroughputs.append(self.measureThroughput(1.0))

            with self.database.transaction():
                ServiceManager.startService("MockService", 0)

            self.waitForCount(0)

            emptyThroughputs.append(self.measureThroughput(1.0))

        print("Throughput with no workers: ", emptyThroughputs)
        print("Throughput with 20 workers: ", fullThroughputs)

        # we want to ensure that we don't have some problem where our transaction throughput
        # goes down because we have left-over connections or something similar in the server,
        # which would be a real problem!
        self.assertTrue(emptyThroughputs[-1] * 2 > emptyThroughputs[0], (emptyThroughputs))

    @pytest.mark.skip(reason="multi-worker test")
    def test_throughput_with_many_workers(self):
        with self.database.transaction():
            ServiceManager.createOrUpdateService(MockService, "MockService", target_count=0)

        throughputs = []

        for ct in [16, 18, 20, 22, 24, 26, 28, 30, 32, 34, 0]:
            with self.database.transaction():
                ServiceManager.startService("MockService", ct)

            self.waitForCount(ct)

            throughputs.append(self.measureThroughput(5.0))

        print("Total throughput was", throughputs, " transactions per second")

    def test_service_restarts_after_soft_kill(self):
        with self.database.transaction():
            ServiceManager.createOrUpdateService(MockService, "MockService", target_count=1)

        self.waitForCount(1)

        with self.database.transaction():
            s = MockServiceLastTimestamp.aliveServices()[0]
            s.triggerSoftKill = True

        self.database.waitForCondition(
            lambda: not s.connection.exists(), timeout=5.0 * self.ENVIRONMENT_WAIT_MULTIPLIER
        )

        self.waitForCount(1)

    def test_service_restarts_after_killing(self):
        with self.database.transaction():
            ServiceManager.createOrUpdateService(MockService, "MockService", target_count=1)

        self.waitForCount(1)

        with self.database.transaction():
            s = MockServiceLastTimestamp.aliveServices()[0]
            s.triggerHardKill = True

        self.database.waitForCondition(
            lambda: not s.connection.exists(), timeout=5.0 * self.ENVIRONMENT_WAIT_MULTIPLIER
        )

        self.waitForCount(1)

    def test_logfiles_exist_and_get_recycled(self):
        with self.database.transaction():
            ServiceManager.createOrUpdateService(MockService, "MockService", target_count=1)
        self.waitForCount(1)

        self.assertTrue(
            self.database.waitForCondition(
                lambda: len(os.listdir(self.logDir)) == 1,
                timeout=5.0 * self.ENVIRONMENT_WAIT_MULTIPLIER,
                maxSleepTime=0.001,
            )
        )
        priorFilename = os.listdir(self.logDir)[0]

        self.setCountAndBlock(0)
        self.setCountAndBlock(1)

        self.assertTrue(
            self.database.waitForCondition(
                lambda: len(os.listdir(self.logDir)) == 2,
                timeout=5.0 * self.ENVIRONMENT_WAIT_MULTIPLIER,
                maxSleepTime=0.001,
            )
        )

        newFilename = [x for x in os.listdir(self.logDir) if x != "old"][0]

        self.assertNotEqual(priorFilename, newFilename)

    def test_deploy_imported_module(self):
        with tempfile.TemporaryDirectory() as tf:
            for fname, contents in getTestServiceModule(1).items():
                if not os.path.exists(os.path.join(tf, os.path.dirname(fname))):
                    os.makedirs(os.path.join(tf, os.path.dirname(fname)))

                with open(os.path.join(tf, fname), "w") as f:
                    f.write(contents)

            try:
                sys.path += [tf]

                test_service = __import__("test_service.service")

                with self.database.transaction():
                    ServiceManager.createOrUpdateService(
                        test_service.service.Service, "MockService", target_count=1
                    )

                self.waitForCount(1)
            finally:
                sys.path = [x for x in sys.path if x != tf]
                del sys.modules["test_service.service"]
                del sys.modules["test_service"]

    def test_update_module_code(self):
        serviceName = "MockService"

        def deploy_helper(codebase_version, expected_version, existing_service=None):
            with self.database.transaction():
                try:
                    ServiceManager.createOrUpdateService(
                        "test_service.service.Service",
                        serviceName,
                        target_count=1,
                        codebase=service_schema.Codebase.createFromFiles(
                            getTestServiceModule(codebase_version)
                        ),
                    )
                except Exception:
                    pass

            if existing_service:
                self.assertTrue(
                    self.database.waitForCondition(
                        lambda: not existing_service.connection.exists(),
                        timeout=5.0 * self.ENVIRONMENT_WAIT_MULTIPLIER,
                    )
                )

            self.waitForCount(1)

            with self.database.transaction():
                s = MockServiceLastTimestamp.aliveServices()[0]
                self.assertEqual(s.version, expected_version)

            return s

        def lock_helper():
            with self.database.transaction():
                service = service_schema.Service.lookupAny(name=serviceName)
                self.assertIsNotNone(service)
                service.lock()
                self.assertTrue(service.isLocked)

        def unlock_helper():
            with self.database.transaction():
                service = service_schema.Service.lookupAny(name=serviceName)
                self.assertIsNotNone(service)
                service.unlock()
                self.assertFalse(service.isLocked)

        def prepare_helper():
            with self.database.transaction():
                service = service_schema.Service.lookupAny(name=serviceName)
                self.assertIsNotNone(service)
                service.prepare()
                self.assertFalse(service.isLocked)

        # Initial deploy should succeed
        s = deploy_helper(1, 1)

        # Trying to update the codebase without unlocking should fail
        s = deploy_helper(2, 1)

        # Trying to update the codebase after preparing for deployment should succeed
        prepare_helper()
        s = deploy_helper(3, 3, s)

        # Trying to update the codebase a second time
        # after preparing for deployment should fail
        s = deploy_helper(4, 3)

        # Trying to update the codebase after unlocking should succeed
        unlock_helper()
        s = deploy_helper(5, 5, s)
        s = deploy_helper(6, 6, s)

        # Trying to update the codebase after locking should fail
        lock_helper()
        s = deploy_helper(7, 6)


class ServiceManagerOverProxyTest(ServiceManagerTest):
    PROXY_SERVER_PORT = 8024

    # @pytest.mark.skip(reason='can only run this test once per process')
    # def test_deploy_imported_module(self):
    #     pass
