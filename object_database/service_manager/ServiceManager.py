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


from object_database.view import revisionConflictRetry
from object_database.core_schema import core_schema
from object_database.service_manager.ServiceSchema import service_schema
from object_database.reactor import Reactor
from typed_python.Codebase import Codebase as TypedPythonCodebase

import psutil
import logging
import traceback
import time
import sys


class ServiceManager(object):
    DEFAULT_SHUTDOWN_TIMEOUT = 10.0

    def __init__(
        self,
        dbConnectionFactory,
        sourceDir,
        placementGroup,
        ownHostname,
        maxGbRam=4,
        maxCores=4,
        shutdownTimeout=None,
        metricUpdateInterval=2.0,
    ):
        object.__init__(self)
        self.shutdownTimeout = shutdownTimeout or ServiceManager.DEFAULT_SHUTDOWN_TIMEOUT
        self.ownHostname = ownHostname
        self.sourceDir = sourceDir
        self.isMaster = placementGroup == "Master"
        self.placementGroup = placementGroup
        self.maxGbRam = maxGbRam
        self.maxCores = maxCores
        self.serviceHostObject = None
        self.dbConnectionFactory = dbConnectionFactory
        self.db = dbConnectionFactory()
        self.db.subscribeToSchema(core_schema, service_schema)
        self.metricUpdateInterval = metricUpdateInterval
        self._lastMetricUpdateTimestamp = 0.0
        self.reactor = Reactor(self.db, self.doWork, metricUpdateInterval)

        self._logger = logging.getLogger(__name__)

    def start(self):
        with self.db.transaction():
            self.serviceHostObject = service_schema.ServiceHost(
                connection=self.db.connectionObject,
                placementGroup=self.placementGroup,
                maxGbRam=self.maxGbRam,
                maxCores=self.maxCores,
            )
            self.serviceHostObject.hostname = self.ownHostname

        self.reactor.start()

    def stop(self):
        self.reactor.stop()

    @staticmethod
    def createOrUpdateService(
        serviceClass,
        serviceName,
        target_count=None,
        placement=None,
        isSingleton=None,
        coresUsed=None,
        gbRamUsed=None,
        inferCodebase=True,
        extensions=(".py"),
    ):
        service = service_schema.Service.lookupAny(name=serviceName)

        if not service:
            service = service_schema.Service(
                name=serviceName,
                validPlacementGroups=(placement,) if placement else ("Master",),
            )

        service.service_module_name = serviceClass.__module__
        service.service_class_name = serviceClass.__qualname__

        if service.service_module_name.startswith("object_database."):
            inferCodebase = False

        if inferCodebase is True:
            # find the root of the codebase
            module = sys.modules[serviceClass.__module__]

            root_path = TypedPythonCodebase.rootlevelPathFromModule(module)

            tpCodebase = service_schema.Codebase.createFromRootlevelPath(
                root_path, extensions=extensions
            )

            service.setCodebase(tpCodebase)

        if target_count is not None:
            service.target_count = target_count

        if placement is not None:
            service.validPlacementGroups = (placement,)

        if coresUsed is not None:
            service.coresUsed = coresUsed
        else:
            service.coresUsed = serviceClass.coresUsed

        if gbRamUsed is not None:
            service.gbRamUsed = gbRamUsed
        else:
            service.gbRamUsed = serviceClass.gbRamUsed

        return service

    @staticmethod
    def createOrUpdateServiceWithCodebase(
        codebase,
        className,
        serviceName,
        targetCount=None,
        placement=None,
        coresUsed=None,
        gbRamUsed=None,
        isSingleton=None,
    ):

        assert (
            len(className.split(".")) > 1
        ), "className should be a fully-qualified module.classname"

        service = service_schema.Service.lookupAny(name=serviceName)

        if not service:
            service = service_schema.Service(
                name=serviceName,
                validPlacementGroups=(placement,) if placement is not None else ("Master",),
            )

        service.setCodebase(
            codebase, ".".join(className.split(".")[:-1]), className.split(".")[-1]
        )

        if isSingleton is not None:
            service.isSingleton = isSingleton

        if coresUsed is not None:
            service.coresUsed = coresUsed

        if gbRamUsed is not None:
            service.gbRamUsed = gbRamUsed

        if targetCount is not None:
            service.target_count = targetCount

        if placement is not None:
            service.validPlacementGroups = (placement,)

        return service

    @staticmethod
    def startService(serviceName, targetCount=1):
        service = service_schema.Service.lookupOne(name=serviceName)
        service.target_count = targetCount

    @staticmethod
    def waitRunning(db, serviceName, timeout=5.0):
        def isRunning():
            service = service_schema.Service.lookupAny(name=serviceName)
            if not service:
                return False

            instances = service_schema.ServiceInstance.lookupAll(service=service)
            if any(inst.isRunning() for inst in instances):
                return True
            return False

        return db.waitForCondition(isRunning, timeout)

    @staticmethod
    def stopService(serviceName):
        service = service_schema.Service.lookupOne(name=serviceName)
        service.target_count = 0

    @staticmethod
    def waitStopped(db, serviceName, timeout=5.0):
        def isStopped():
            service = service_schema.Service.lookupAny(name=serviceName)
            if not service:
                return True

            instances = service_schema.ServiceInstance.lookupAll(service=service)
            if any(not inst.isNotActive() for inst in instances):
                return False
            return True

        return db.waitForCondition(isStopped, timeout)

    def stopAllServices(self, timeout):
        with self.db.transaction():
            for s in service_schema.Service.lookupAll():
                s.target_count = 0

        def allStopped():
            instances = service_schema.ServiceInstance.lookupAll()
            if any(not inst.isNotActive() for inst in instances):
                return False
            return True

        return self.db.waitForCondition(allStopped, timeout)

    def doWork(self):
        self.updateServiceHostStats()

        # redeploy our own services
        self.redeployServicesIfNecessary()

        # if we're the master, do some allocation
        if self.isMaster:
            self.collectDeadHosts()
            self.collectDeadConnections()
            self.createInstanceRecords()

        instances = self.instanceRecordsToBoot()

        bad_instances = {}

        for i in instances:
            try:
                with self.db.view():
                    service = i.service
                self.startServiceWorker(service, i._identity)

            except Exception:
                self._logger.exception("Failed to start a worker for instance %s:", i)
                bad_instances[i] = traceback.format_exc()

        if bad_instances:
            with self.db.transaction():
                for i in bad_instances:
                    i.markFailedToStart(bad_instances[i])

        self.cleanup()

    def updateServiceHostStats(self):
        if time.time() - self._lastMetricUpdateTimestamp > self.metricUpdateInterval:
            self._lastMetricUpdateTimestamp = time.time()
            with self.db.transaction():
                self.serviceHostObject.cpuUse = psutil.cpu_percent() / 100.0
                self.serviceHostObject.actualMemoryUseGB = (
                    psutil.virtual_memory().used / 1024 ** 3
                )
                self.serviceHostObject.statsLastUpdateTime = time.time()

    @revisionConflictRetry
    def collectDeadHosts(self):
        # reset the state
        with self.db.transaction():
            for serviceHost in service_schema.ServiceHost.lookupAll():
                instances = service_schema.ServiceInstance.lookupAll(host=serviceHost)

                if not serviceHost.connection.exists():
                    for sInst in instances:
                        sInst.delete()
                    serviceHost.delete()
                else:
                    actualRam = sum([i.service.gbRamUsed for i in instances if i.isActive()])
                    actualCores = sum([i.service.coresUsed for i in instances if i.isActive()])

                    if serviceHost.gbRamUsed != actualRam:
                        serviceHost.gbRamUsed = actualRam

                    if serviceHost.coresUsed != actualCores:
                        serviceHost.coresUsed = actualCores

    @revisionConflictRetry
    def collectDeadConnections(self):
        with self.db.transaction():
            for serviceInstance in service_schema.ServiceInstance.lookupAll():
                if (
                    not serviceInstance.host.exists()
                    or serviceInstance.connection
                    and not serviceInstance.connection.exists()
                    or serviceInstance.owner is not None
                    and not serviceInstance.owner.exists()
                ):
                    if serviceInstance.owner is None:
                        if serviceInstance.state == "FailedToStart":
                            serviceInstance.service.timesBootedUnsuccessfully += 1
                            serviceInstance.service.lastFailureReason = (
                                serviceInstance.failureReason
                            )
                        elif serviceInstance.state == "Crashed":
                            serviceInstance.service.timesCrashed += 1
                            serviceInstance.service.lastFailureReason = (
                                serviceInstance.failureReason
                            )
                    serviceInstance.delete()

    def redeployServicesIfNecessary(self):
        needRedeploy = []
        with self.db.view():
            for i in service_schema.ServiceInstance.lookupAll(host=self.serviceHostObject):
                if (
                    i.service.codebase != i.codebase
                    and i.connection is not None
                    and not i.shouldShutdown
                ):
                    needRedeploy.append(i)

            if needRedeploy:
                self._logger.info(
                    "The following services need to be stopped "
                    "because their codebases are out of date: %s",
                    "\n".join(
                        [
                            "  "
                            + i.service.name
                            + "."
                            + str(i._identity)
                            + ". "
                            + str(i.service.codebase)
                            + " != "
                            + str(i.codebase)
                            for i in needRedeploy
                        ]
                    ),
                )

        if needRedeploy:
            self.stopServices(needRedeploy)

    @revisionConflictRetry
    def stopServices(self, needRedeploy):
        with self.db.transaction():
            for i in needRedeploy:
                if i.exists():
                    i.triggerShutdown()

        # wait for them to be down before proceeding
        self.db.waitForCondition(
            lambda: not [x for x in needRedeploy if x.exists()], self.shutdownTimeout * 2.0
        )

    @revisionConflictRetry
    def createInstanceRecords(self):
        actual_by_service = {}

        with self.db.view():
            for service in service_schema.Service.lookupAll():
                actual_by_service[service] = [
                    x
                    for x in service_schema.ServiceInstance.lookupAll(service=service)
                    if x.isActive() and x.owner is None
                ]

        for service, actual_records in actual_by_service.items():
            with self.db.transaction():
                if service.effectiveTargetCount() != len(actual_records):
                    self._updateService(service, actual_records)

    def _pickHost(self, service):
        for h in service_schema.ServiceHost.lookupAll():
            if h.connection.exists():
                canPlace = h.placementGroup in service.validPlacementGroups

                if (
                    canPlace
                    and h.gbRamUsed + service.gbRamUsed <= h.maxGbRam
                    and h.coresUsed + service.coresUsed <= h.maxCores
                ):
                    return h

    def _updateService(self, service, actual_records):
        while service.effectiveTargetCount() > len(actual_records):
            host = self._pickHost(service)
            if not host:
                if service.unbootable_count != service.effectiveTargetCount() - len(
                    actual_records
                ):
                    service.unbootable_count = service.effectiveTargetCount() - len(
                        actual_records
                    )
                return
            else:
                host.gbRamUsed = host.gbRamUsed + service.gbRamUsed
                host.coresUsed = host.coresUsed + service.coresUsed

            instance = service_schema.ServiceInstance(
                service=service, host=host, state="Booting", start_timestamp=time.time()
            )

            actual_records.append(instance)

        if service.unbootable_count:
            service.unbootable_count = 0

        while service.effectiveTargetCount() < len(actual_records):
            sInst = actual_records.pop()
            sInst.triggerShutdown()

    def instanceRecordsToBoot(self):
        res = []
        with self.db.view():
            for i in service_schema.ServiceInstance.lookupAll(host=self.serviceHostObject):
                if i.state == "Booting":
                    res.append(i)
        return res

    def startServiceWorker(self, service, instanceIdentity):
        """
        Args:
            service (service_schema.Service): The service for which to start a worker
            instanceIdentity (int): The identity of the instance we want to start.
                The worker gets handed this identifier and calls `service_schema.
                ServiceInstance.fromIdentity(instanceIdentity)` to recover the
                relevant ServiceInstance from the object_database.
        """
        raise NotImplementedError()

    def cleanup(self):
        pass
