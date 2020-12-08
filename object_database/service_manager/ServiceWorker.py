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

from object_database.core_schema import core_schema
from object_database.service_manager.ServiceSchema import service_schema
from object_database.service_manager.ServiceBase import ServiceBase, ServiceRuntimeConfig
from object_database.reactor import Reactor

import logging
import os
import threading
import time
import traceback


class ServiceWorker:
    def __init__(
        self, db, dbConnectionFactory, instance_id, storageRoot, authToken, ownIpAddress
    ):
        self._logger = logging.getLogger(__name__)
        self.dbConnectionFactory = dbConnectionFactory
        self.db = db
        self.db.subscribeToSchema(core_schema)

        # explicitly don't subscribe to everyone else's service hosts!
        self.db.subscribeToType(service_schema.Service)
        self.db.subscribeToType(service_schema.Codebase, lazySubscription=True)
        self.db.subscribeToType(service_schema.File, lazySubscription=True)

        self.instance = service_schema.ServiceInstance.fromIdentity(instance_id)
        self.instanceId = instance_id

        self.runtimeConfig = ServiceRuntimeConfig(
            dbConnectionFactory, storageRoot, authToken, ownIpAddress, self.instance
        )

        if not os.path.exists(storageRoot):
            os.makedirs(storageRoot)

        self.db.subscribeToObject(self.instance)

        with self.db.view():
            if self.instance.service.codebase is not None:
                self.instance.service.codebase.instantiate()

        with self.db.view():
            host = self.instance.host
        self.db.subscribeToObject(host)

        self.serviceObject = None
        self.serviceName = None

        self.serviceWorkerThread = threading.Thread(
            target=self.synchronouslyRunService, daemon=True
        )
        self.shouldStop = threading.Event()
        self.exitedGracefully = threading.Event()

        self.shutdownPollReactor = Reactor(self.db, self.checkForShutdown)

    def initialize(self):
        if not self.db.waitForCondition(lambda: self.instance.exists(), 5.0):
            raise Exception("Failed to find Service Instance")

        with self.db.transaction():
            if not self.instance.exists():
                raise Exception("Service Instance object %s doesn't exist" % self.instanceId)
            if not self.instance.service.exists():
                msg = "Service object %s doesn't exist" % self.instance.service._identity
                with self.db.transaction():
                    self.instance.markFailedToStart(msg)
                raise Exception(msg)

            self.serviceName = self.instance.service.name
            self.instance.connection = self.db.connectionObject
            self.instance.codebase = self.instance.service.codebase
            self.instance.start_timestamp = time.time()
            self.instance.state = "Initializing"

            try:
                self.serviceObject = self._instantiateServiceObject()
            except Exception:
                self._logger.exception("Service thread for %s failed:", self.instanceId)
                self.instance.markFailedToStart(traceback.format_exc())
                return
        try:
            self._logger.info("Initializing service object for %s", self.instanceId)
            self.serviceObject.initialize()
        except Exception:
            self._logger.exception("Service thread for %s failed:", self.instanceId)

            self.serviceObject = None

            with self.db.transaction():
                self.instance.markFailedToStart(traceback.format_exc())
                return

    def checkForShutdown(self):
        try:
            with self.db.view():
                if not self.instance.exists():
                    self.shouldStop.set()
                elif self.instance.shouldShutdown:
                    self.shouldStop.set()
        except Exception:
            # If the connection to DB drops, we also want to trigger shouldStop.
            self.shouldStop.set()

    def synchronouslyRunService(self):
        self.initialize()

        if self.serviceObject is None:
            self.shouldStop.set()
            return

        with self.db.transaction():
            self.instance.state = "Running"

        try:
            self._logger.info("Starting runloop for service object %s", self.instanceId)
            self.serviceObject.doWork(self.shouldStop)
        except Exception:
            self._logger.exception("Service %s/%s failed:", self.serviceName, self.instanceId)

            with self.db.transaction():
                self.instance.state = "Crashed"
                self.instance.end_timestamp = time.time()
                self.instance.failureReason = traceback.format_exc()
                return
        else:
            with self.db.transaction():
                self._logger.info(
                    "Service %s/%s exited gracefully. Setting stopped flag.",
                    self.serviceName,
                    self.instanceId,
                )

                self.instance.state = "Stopped"
                self.instance.end_timestamp = time.time()
                self.exitedGracefully.set()

    def start(self):
        self.serviceWorkerThread.start()
        self.shutdownPollReactor.start()

    def runAndWaitForShutdown(self):
        self.start()
        self.serviceWorkerThread.join()
        return self.exitedGracefully.is_set()

    def stop(self):
        self.shouldStop.set()
        if self.serviceWorkerThread.is_alive():
            self.serviceWorkerThread.join()

        self.shutdownPollReactor.stop()
        return self.exitedGracefully.is_set()

    def _instantiateServiceObject(self):
        service_type = self.instance.service.instantiateServiceType()

        assert isinstance(service_type, type), service_type
        assert issubclass(service_type, ServiceBase), service_type

        service = service_type(self.db, self.instance.service, self.runtimeConfig)

        return service

    def isRunning(self):
        return self.serviceWorkerThread.is_alive()
