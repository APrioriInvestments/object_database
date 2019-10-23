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

import ast
import logging
import numpy
import os
import psutil
import sys
import tempfile
import textwrap
import time
import unittest
from flaky import flaky

from object_database.service_manager.ServiceManagerTestCommon import ServiceManagerTestCommon
from object_database.service_manager.ServiceManager import ServiceManager
from object_database.service_manager.ServiceBase import ServiceBase
import object_database.service_manager.ServiceInstance as ServiceInstance
from object_database.web.cells import (
    Button,
    SubscribedSequence,
    Subscribed,
    Text,
    Dropdown,
    Card,
    Plot,
    Code,
    Slot,
    CodeEditor,
    Tabs,
    Grid,
    Flex,
    Sheet,
    ensureSubscribedType,
    SubscribeAndRetry,
    Expands,
    AsyncDropdown,
    ButtonGroup,
    Octicon,
    SplitView,
)

from object_database import (
    Schema,
    Indexed,
    core_schema,
    Index,
    service_schema,
    current_transaction,
)

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

    def doWork(self, shouldStop):
        time.sleep(120)


@schema.define
class TextEditor:
    code = str


class TextEditorService(ServiceBase):
    def initialize(self):
        self.db.subscribeToSchema(core_schema, service_schema, schema)
        self.db.subscribeToType(TextEditor)

        with self.db.transaction():
            code = TextEditor.lookupAny()

            if not code:
                code = TextEditor()
                code.code = "{'x': [1,2,3,4,5], 'y': [1,5,1,5,1]}"

    @staticmethod
    def serviceDisplay(serviceObject, instance=None, objType=None, queryArgs=None):
        ensureSubscribedType(TextEditor)

        toEval = Slot("{'x': [1,2,3,4,5], 'y': [1,5,1,5,1]}")

        def onEnter(buffer, selection):
            toEval.set(buffer)
            TextEditor.lookupAny().code = buffer

        def onTextChange(buffer, selection):
            if TextEditor.lookupAny() is not None:
                TextEditor.lookupAny().code = buffer

        ed = CodeEditor(
            keybindings={"Enter": onEnter},
            noScroll=True,
            minLines=50,
            onTextChange=onTextChange,
        )

        def makePlotData():
            # data must be a list or dict here, but this is checked/asserted
            # down the line in cells. Sending anything that is not a dict/list
            # will break the entire plot.
            try:
                data = ast.literal_eval(toEval.get())
            except (AttributeError, SyntaxError):
                data = {}
            return {"data": data}

        def onCodeChange():
            if TextEditor.lookupAny() is not None:
                if ed.getContents() != TextEditor.lookupAny().code:
                    ed.setContents(TextEditor.lookupAny().code)

        # return Columns(ed, Card(Plot(makePlotData).height("100%").width("100%")))
        #        + Subscribed(onCodeChange)
        return SplitView([(ed, 1), (Card(Plot(makePlotData)), 1)]) + Subscribed(onCodeChange)


class GraphDisplayService(ServiceBase):
    def initialize(self):
        self.db.subscribeToSchema(core_schema, service_schema, schema)
        with self.db.transaction():
            if not Feigenbaum.lookupAny():
                Feigenbaum(y=2.0, density=800)

    @staticmethod
    def addAPoint():
        PointsToShow(timestamp=time.time(), y=len(PointsToShow.lookupAll()) ** 2.2)

    @staticmethod
    def serviceDisplay(serviceObject, instance=None, objType=None, queryArgs=None):
        ensureSubscribedType(PointsToShow)
        ensureSubscribedType(Feigenbaum)
        depth = Slot(50)

        def twinned():
            data = {
                "PointsToShow": {
                    "timestamp": [1500000000 + x for x in range(1000)],
                    "y": [numpy.sin(x) for x in range(1000)],
                }
            }
            slot = Slot(None)
            p1 = Plot(lambda: data, xySlot=slot)
            p2 = Plot(lambda: data, xySlot=slot)

            def synchronize():
                if slot.get() is not None:
                    p1.setXRange(*slot.get()[0])
                    p2.setXRange(*slot.get()[0])

            return p1 + p2 + Subscribed(synchronize)

        return Tabs(
            Overlay=Card(
                Plot(
                    lambda: {
                        "single_array": [1, 2, 3, 1, 2, 3],
                        "xy": {"x": [1, 2, 3, 1, 2, 3], "y": [4, 5, 6, 7, 8, 9]},
                    }
                )
                .width(600)
                .height(400)
                + Code("HI")
            ),
            AGrid=Grid(
                colFun=lambda: ["A", "B", "B"],
                rowFun=lambda: ["1", "2", "2"],
                headerFun=lambda x: x,
                rowLabelFun=None,
                rendererFun=lambda row, col: row + col,
            ),
            ASheet=Sheet(
                ["A", "B", "C"],
                1000000,
                lambda rowIx: ["(%s) ts" % rowIx, rowIx, rowIx + 1, rowIx + 2],
            )
            .width("calc(100vw - 70px)")
            .height("calc(100vh - 150px)"),
            Timestamps=(
                Button("Add a point!", GraphDisplayService.addAPoint)
                + Card(Plot(GraphDisplayService.chartData)).width(600).height(400)
            ),
            Twinned=Subscribed(twinned),
            feigenbaum=(
                Dropdown(
                    "Depth",
                    [(val, depth.setter(val)) for val in [10, 50, 100, 250, 500, 750, 1000]],
                )
                + Dropdown(
                    "Polynomial",
                    [1.0, 1.5, 2.0],
                    lambda polyVal: setattr(Feigenbaum.lookupAny(), "y", float(polyVal)),
                )
                + Dropdown(
                    "Density",
                    list(range(100, 10000, 100)),
                    lambda polyVal: setattr(Feigenbaum.lookupAny(), "density", float(polyVal)),
                )
                + Card(Plot(lambda graph: GraphDisplayService.feigenbaum(graph, depth.get())))
                .width(600)
                .height(400)
            ),
        )

    @staticmethod
    def chartData(linePlot):
        points = sorted(PointsToShow.lookupAll(), key=lambda p: p.timestamp)

        return {
            "PointsToShow": {
                "timestamp": [p.timestamp for p in points],
                "y": [p.y for p in points],
            }
        }

    @staticmethod
    def feigenbaum(linePlot, depth):
        if linePlot.curXYRanges.get() is None:
            left, right = 0.0, 4.0
        else:
            left, right = linePlot.curXYRanges.get()[0]
            left = max(0.0, left) if left is not None else 3
            right = min(4.0, right) if right is not None else 4
            left = min(left, right - 1e-6)
            right = max(left + 1e-6, right)

        values = numpy.linspace(left, right, Feigenbaum.lookupAny().density, endpoint=True)

        y = Feigenbaum.lookupAny().y

        def feigenbaum(values):
            x = numpy.ones(len(values)) * 0.5
            for _ in range(10000):
                x = (values * x * (1 - x)) ** ((y) ** 0.5)

            its = []
            for _ in range(depth):
                x = (values * x * (1 - x)) ** ((y) ** 0.5)
                its.append(x)

            return numpy.concatenate(its)

        fvals = feigenbaum(values)

        return {
            "feigenbaum": {
                "x": numpy.concatenate([values] * (len(fvals) // len(values))),
                "y": fvals,
                "type": "scattergl",
                "mode": "markers",
                "opacity": 0.5,
                "marker": {"size": 2},
            }
        }


class DropdownTestService(ServiceBase):
    def initialize(self):
        pass

    @staticmethod
    def serviceDisplay(serviceObject, instance=None, objType=None, queryArgs=None):
        return Card(
            AsyncDropdown("Dropdown", DropdownTestService.delayAndDisplay, Text("LOADING..."))
        )

    @staticmethod
    def delayAndDisplay():
        time.sleep(1)
        return Text("NOW WE HAVE LOADED")


bigGrid = Schema("core.test.biggrid")


@bigGrid.define
class GridValue:
    row = int
    col = int
    row_and_col = Index("row", "col")

    value = int


ROW_COUNT = 100
COL_COUNT = 10
GRID_INTERVAL = 0.1


class BigGridTestService(ServiceBase):
    @staticmethod
    def serviceDisplay(serviceObject, instance=None, objType=None, queryArgs=None):
        ensureSubscribedType(GridValue)

        return Grid(
            colFun=lambda: list(range(COL_COUNT)),
            rowFun=lambda: list(range(ROW_COUNT)),
            headerFun=lambda x: x,
            rowLabelFun=None,
            rendererFun=lambda row, col: Subscribed(
                lambda: GridValue.lookupAny(row_and_col=(row, col)).value
            ),
        )

    def doWork(self, shouldStop):
        self.db.subscribeToType(GridValue)

        with self.db.transaction():
            for row in range(ROW_COUNT):
                for col in range(COL_COUNT):
                    GridValue(row=row, col=col, value=0)

        passIx = 0
        while not shouldStop.is_set():
            #  print("WRITNG ", passIx)
            passIx += 1
            time.sleep(GRID_INTERVAL)
            rows_and_cols = [
                (row, col) for row in range(ROW_COUNT) for col in range(COL_COUNT)
            ]
            numpy.random.shuffle(rows_and_cols)

            for row, col in rows_and_cols:
                with self.db.transaction():
                    GridValue.lookupAny(row_and_col=(row, col)).value = passIx


happy = Schema("core.test.happy")


@happy.define
class Happy:
    i = int

    def display(self, queryParams=None):
        ensureSubscribedType(Happy)
        return "Happy %s. " % self.i + str(queryParams)


class HappyService(ServiceBase):
    def initialize(self):
        pass

    @staticmethod
    def serviceDisplay(serviceObject, instance=None, objType=None, queryArgs=None):
        if not current_transaction().db().isSubscribedToType(Happy):
            raise SubscribeAndRetry(lambda db: db.subscribeToType(Happy))

        if instance:
            return instance.display(queryArgs)

        return (
            Card(
                Subscribed(
                    lambda: Text(
                        "There are %s happy objects <this should not have lessthans>"
                        % len(Happy.lookupAll())
                    )
                )
                + Expands(
                    Text("Closed"),
                    Subscribed(lambda: HappyService.serviceDisplay(serviceObject)),
                )
            )
            + Button("go to google", "http://google.com/")
            + Flex(
                SubscribedSequence(
                    lambda: Happy.lookupAll(),
                    lambda h: Button("go to the happy", serviceObject.urlForObject(h, x=10)),
                )
            )
            + Subscribed(
                lambda: ButtonGroup(
                    [
                        Button(Octicon("list-unordered"), lambda: None, active=lambda: True),
                        Button(Octicon("terminal"), lambda: None, active=lambda: True),
                        Button(Octicon("graph"), lambda: None, active=lambda: True),
                    ]
                ).nowrap()
            )
        )

    def doWork(self, shouldStop):
        self.db.subscribeToSchema(happy)

        with self.db.transaction():
            h = Happy(i=1)
            h = Happy(i=2)

        while not shouldStop.is_set():
            time.sleep(0.5)
            with self.db.transaction():
                h = Happy()
            time.sleep(0.5)
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
        self.assertTrue(
            self.database.waitForCondition(
                lambda: MockServiceLastTimestamp.aliveCount() == count,
                timeout=timeout * self.ENVIRONMENT_WAIT_MULTIPLIER,
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

            ServiceManager.waitStopped(self.database, svcName, timeout=timeout)

            with self.database.view():
                self.assertIsNotNone(Stopped.lookupAny())

            with self.database.transaction():
                for obj in Initialized.lookupAll():
                    obj.delete()

                for obj in Stopped.lookupAll():
                    obj.delete()

        for ix in range(10):
            test_once()

    def test_racheting_service_count_up_and_down(self):
        with self.database.transaction():
            ServiceManager.createOrUpdateService(MockService, "MockService", target_count=1)

        numpy.random.seed(42)

        for count in numpy.random.choice(6, size=20):
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

    def test_conflicting_codebases(self):
        with self.database.transaction():
            v1 = service_schema.Codebase.createFromFiles(
                {
                    "test_service/__init__.py": "",
                    "test_service/helper/__init__.py": "g = 1",
                    "test_service/service.py": textwrap.dedent(
                        """
                    import test_service.helper as helper
                    def f():
                        assert helper.g == 1
                        return 1
                """
                    ),
                }
            )

            v2 = service_schema.Codebase.createFromFiles(
                {
                    "test_service/__init__.py": "",
                    "test_service/helper/__init__.py": "g = 2",
                    "test_service/service.py": textwrap.dedent(
                        """
                    import test_service.helper as helper
                    def f():
                        assert helper.g == 2
                        return 2
                """
                    ),
                }
            )

            i1 = v1.instantiate("test_service.service")
            i2 = v2.instantiate("test_service.service")
            i12 = v1.instantiate("test_service.service")
            i22 = v2.instantiate("test_service.service")

            self.assertEqual(i1.f(), 1)
            self.assertEqual(i2.f(), 2)
            self.assertEqual(i12.f(), 1)
            self.assertEqual(i22.f(), 2)

            self.assertIs(i1, i12)
            self.assertIs(i2, i22)

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
            ServiceManager.createOrUpdateServiceWithCodebase(
                service_schema.Codebase.createFromFiles(getTestServiceModule(2)),
                "test_service.service.Service",
                "HangingService",
                10,
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

    def DISABLEDtest_throughput_with_many_workers(self):
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

    def test_update_module_code(self):
        serviceName = "MockService"

        def deploy_helper(codebase_version, expected_version, existing_service=None):
            with self.database.transaction():
                try:
                    ServiceManager.createOrUpdateServiceWithCodebase(
                        service_schema.Codebase.createFromFiles(
                            getTestServiceModule(codebase_version)
                        ),
                        "test_service.service.Service",
                        serviceName,
                        targetCount=1,
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
