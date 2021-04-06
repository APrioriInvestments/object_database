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
from object_database.service_manager.aws.AwsWorkerBootService import schema as aws_schema
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

    def checkAwsImageHash(self, pathToImageHash):
        """Check the image hash in the AwsWorkerBootService against the image in the path.

        Args:
            pathToImageHash (str) - the path to a writeable file containing the docker
                image we want to have booted.

        Returns:
            True if we wrote a new docker image to the file and should exit.
        """
        with open(pathToImageHash, "r") as f:
            existingHashOnDisk = f.read().strip()

        self.db.subscribeToSchema(aws_schema)
        with self.db.view():
            config = aws_schema.Configuration.lookupAny()

            # it's weird if AWS is not configured, but we shouldn't just
            # start rebooting because we have nothing to replace our existing
            # image
            if not config:
                return False

            hashInAws = config.docker_image

        if hashInAws != existingHashOnDisk:
            with open(pathToImageHash, "w") as f:
                f.write(hashInAws + "\n")

            return True

        return False

    @staticmethod
    def inferCodebase(moduleName, extensions=(".py")):
        # find the root of the codebase
        module = sys.modules[moduleName]

        root_path = TypedPythonCodebase.rootlevelPathFromModule(module)

        codebase = service_schema.Codebase.createFromRootlevelPath(
            root_path, extensions=extensions
        )
        return codebase

    @staticmethod
    def createOrUpdateService(
        serviceClassOrName,
        serviceName,
        target_count=None,
        placement=None,
        isSingleton=None,
        coresUsed=None,
        gbRamUsed=None,
        inferCodebase=True,
        codebase=None,
        extensions=(".py"),
    ):
        if isinstance(serviceClassOrName, str):
            assert (
                len(serviceClassOrName.split(".")) > 1
            ), "serviceClassOrName should be a fully-qualified module.classname"
            moduleName = ".".join(serviceClassOrName.split(".")[:-1])
            className = serviceClassOrName.split(".")[-1]
        else:
            assert isinstance(serviceClassOrName, type)
            moduleName = serviceClassOrName.__module__
            className = serviceClassOrName.__qualname__
            if gbRamUsed is None:
                gbRamUsed = serviceClassOrName.gbRamUsed
            if coresUsed is None:
                coresUsed = serviceClassOrName.coresUsed

        service = service_schema.Service.lookupAny(name=serviceName)

        if not service:
            service = service_schema.Service(
                name=serviceName,
                validPlacementGroups=(placement,) if placement else ("Master",),
            )

        if moduleName.startswith("object_database."):
            inferCodebase = False

        if codebase is None and inferCodebase:
            codebase = ServiceManager.inferCodebase(moduleName, extensions)

        service.setCodebase(codebase, moduleName, className)

        if target_count is not None:
            service.target_count = target_count

        if placement is not None:
            service.validPlacementGroups = (placement,)

        if coresUsed is not None:
            service.coresUsed = coresUsed

        if gbRamUsed is not None:
            service.gbRamUsed = gbRamUsed

        if isSingleton is not None:
            service.isSingleton = isSingleton

        return service

    @staticmethod
    def startService(serviceName, targetCount=1):
        service = service_schema.Service.lookupOne(name=serviceName)
        service.target_count = targetCount

    @staticmethod
    def waitRunning(db, serviceName, timeout=5.0) -> bool:
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
    def waitStopped(db, serviceName, timeout=5.0) -> bool:
        def isStopped():
            service = service_schema.Service.lookupAny(name=serviceName)
            if not service:
                return True

            instances = service_schema.ServiceInstance.lookupAll(service=service)
            if any(not inst.isNotActive() for inst in instances):
                return False
            return True

        return db.waitForCondition(isStopped, timeout)

    @staticmethod
    def removeService(serviceName, force=False):
        service = service_schema.Service.lookupOne(name=serviceName)
        instances = service_schema.ServiceInstance.lookupAll(service=service)
        if not force and any(not inst.isNotActive() for inst in instances):
            raise Exception(
                f"Failed to remove service '{serviceName}' because of active ServiceInstances."
                "Try stopping the service first, or set force to True"
            )
        for inst in instances:
            inst.delete()
        service.delete()

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
        self.collectOrphanInstances()
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
                    service = i.service if i.service.exists() else None

                if service is not None:
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
    def collectOrphanInstances(self):
        """ Remove instances whose associated service no longer exists. """
        orphans = []
        with self.db.transaction():
            for instance in service_schema.ServiceInstance.lookupAll(
                host=self.serviceHostObject
            ):
                if not instance.service.exists():
                    orphans.append(instance)

        self.stopServices(orphans)
        with self.db.transaction():
            for instance in orphans:
                if instance.exists():
                    instance.delete()

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
                    serviceInstance.isNotActive()
                    or not serviceInstance.host.exists()
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
                    i.service.exists()
                    and i.service.codebase != i.codebase
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
    def stopServices(self, serviceInstances):
        if len(serviceInstances) == 0:
            return

        with self.db.transaction():
            for i in serviceInstances:
                if i.exists():
                    i.triggerShutdown()

        # wait for them to be down before proceeding
        success = self.db.waitForCondition(
            lambda: not [x for x in serviceInstances if not x.isNotActive()],
            self.shutdownTimeout * 2.0,
        )
        if not success:
            with self.db.view():
                self._logger.warning(
                    "Failed to stop services: "
                    f"{[x for x in serviceInstances if not x.isNotActive()]}"
                )
        return success

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
        with self.db.transaction():
            for i in service_schema.ServiceInstance.lookupAll(host=self.serviceHostObject):
                if i.state == "Booting":
                    if i.shouldShutdown:
                        i.delete()
                    else:
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
