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
import os
import subprocess
import tempfile
import time

import object_database
from object_database.util import genToken
from object_database.service_manager.ServiceManager import ServiceManager

from object_database import core_schema, connect, service_schema
from object_database.frontends import service_manager

ownDir = os.path.dirname(os.path.abspath(__file__))

VERBOSE = True
# Turn VERBOSE off on TravisCI because subprocess.PIPE seems to lock things up
VERBOSE = False if os.environ.get("TRAVIS_CI", None) else VERBOSE


class ServiceManagerTestCommon(object):
    # set to False if you want your test harness to dump logs of individual services
    # directly into the test harness. This can be very verbose if you have lots of
    # services, and make it hard to see the test output, so its off by default.
    LOGS_IN_FILES = True

    ENVIRONMENT_WAIT_MULTIPLIER = 5 if os.environ.get("TRAVIS_CI", None) is not None else 1

    # set to an integer to test running the services over a proxy port.
    PROXY_SERVER_PORT = None
    ODB_PORT = 8023

    def schemasToSubscribeTo(self):
        """Subclasses can override to extend the schema set."""
        return []

    def waitRunning(self, serviceName):
        self.assertTrue(
            ServiceManager.waitRunning(
                self.database, serviceName, 5.0 * self.ENVIRONMENT_WAIT_MULTIPLIER
            ),
            "Service " + serviceName + " never came up.",
        )

    def timeElapsed(self):
        return time.time() - self.test_start_time

    def setUp(self):
        self.logger = logging.getLogger(__name__)
        self.test_start_time = time.time()
        self.token = genToken()
        self.tempDirObj = tempfile.TemporaryDirectory()
        self.tempDirectoryName = self.tempDirObj.name
        object_database.service_manager.Codebase.setCodebaseInstantiationDirectory(
            self.tempDirectoryName, forceReset=True
        )

        os.makedirs(os.path.join(self.tempDirectoryName, "source"))
        os.makedirs(os.path.join(self.tempDirectoryName, "storage"))
        os.makedirs(os.path.join(self.tempDirectoryName, "logs"))

        self.logDir = os.path.join(self.tempDirectoryName, "logs")

        logLevelName = logging.getLevelName(logging.getLogger(__name__).getEffectiveLevel())

        self.server = service_manager.startServiceManagerProcess(
            self.tempDirectoryName,
            self.ODB_PORT,
            self.token,
            loglevelName=logLevelName,
            sslPath=os.path.join(ownDir, "..", "..", "testcert.cert"),
            verbose=VERBOSE,
            proxyPort=self.PROXY_SERVER_PORT,
            logDir=self.LOGS_IN_FILES,
        )

        try:
            self.database = connect(
                "localhost", self.PROXY_SERVER_PORT or self.ODB_PORT, self.token, retry=True
            )
            self.database.subscribeToSchema(
                core_schema, service_schema, *self.schemasToSubscribeTo()
            )
        except Exception:
            self.logger.error("Failed to initialize for test")
            self.server.terminate()
            self.server.wait()
            self.tempDirObj.cleanup()
            raise

    def newDbConnection(self):
        return connect(
            "localhost", self.PROXY_SERVER_PORT or self.ODB_PORT, self.token, retry=True
        )

    def tearDown(self):
        self.server.terminate()
        try:
            self.server.wait(timeout=15.0)
        except subprocess.TimeoutExpired:
            self.logger.warning(
                "Failed to gracefully terminate service manager. Sending KILL signal"
            )
            self.server.kill()
            try:
                self.server.wait(timeout=5.0)
            except subprocess.TimeoutExpired:
                self.logger.error("Failed to kill service manager process.")

        try:
            self.tempDirObj.cleanup()
        except Exception:
            # race conditions can cause problems here
            try:
                time.sleep(1.0)
                self.tempDirObj.cleanup()
            except Exception:
                pass
