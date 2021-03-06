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

import os
import shutil
import subprocess
import sys
import logging
import threading
import time

from object_database.service_manager.ServiceManager import ServiceManager
from object_database.service_manager.ServiceSchema import service_schema
from object_database.util import validateLogLevel
from object_database import connect


ownDir = os.path.dirname(os.path.abspath(__file__))
_repoDir = None


def repoDir():
    global _repoDir
    if _repoDir is None:
        parentDir = os.path.abspath(os.path.join(ownDir, ".."))
        assert parentDir.endswith("object_database"), parentDir
        _repoDir = os.path.abspath(os.path.join(ownDir, "..", ".."))
    return _repoDir


def parseLogfileToInstanceid(fname):
    """Parse a file name and return the integer instance id for the service."""
    if not fname.endswith(".log.txt") or "-" not in fname:
        return
    try:
        return int(fname[:-8].split("-")[-1])
    except ValueError:
        return


class SubprocessServiceManager(ServiceManager):
    def __init__(
        self,
        ownHostname,
        host,
        port,
        sourceDir,
        storageDir,
        authToken,
        placementGroup,
        maxGbRam=4,
        maxCores=4,
        logfileDirectory=None,
        shutdownTimeout=None,
        logLevelName="INFO",
        metricUpdateInterval=2.0,
        start_new_session=False,
        capture=True,
        subprocessCheckTimeout=0.0,
    ):
        self.cleanupLock = threading.Lock()
        self.host = host
        self.port = port
        self.storageDir = storageDir
        self.authToken = authToken
        self.logfileDirectory = logfileDirectory
        self.logLevelName = validateLogLevel(logLevelName, fallback="INFO")
        self.start_new_session = start_new_session
        self.capture = capture
        self.subprocessCheckTimeout = subprocessCheckTimeout

        self.lock = threading.Lock()

        if logfileDirectory is not None:
            if not os.path.exists(logfileDirectory):
                os.makedirs(logfileDirectory)

        if not os.path.exists(storageDir):
            os.makedirs(storageDir)

        if not os.path.exists(sourceDir):
            os.makedirs(sourceDir)

        def dbConnectionFactory():
            return connect(host, port, self.authToken)

        ServiceManager.__init__(
            self,
            dbConnectionFactory,
            sourceDir,
            placementGroup,
            ownHostname,
            maxGbRam=maxGbRam,
            maxCores=maxCores,
            shutdownTimeout=shutdownTimeout,
            metricUpdateInterval=metricUpdateInterval,
        )
        self.serviceProcesses = {}
        self._logger = logging.getLogger(__name__)

    def startServiceWorker(self, service, instanceIdentity):
        assert isinstance(instanceIdentity, int)

        with self.db.view():
            if instanceIdentity in self.serviceProcesses:
                return

            with self.lock:
                logfileName = service.name + "-" + str(instanceIdentity) + ".log.txt"
                if self.logfileDirectory is not None:
                    output_file_path = os.path.join(self.logfileDirectory, logfileName)
                    output_file_descr = open(output_file_path, "w")
                else:
                    output_file_path = None
                    output_file_descr = None

                kwargs = dict(cwd=self.storageDir, start_new_session=self.start_new_session)
                if self.capture:
                    kwargs.update(
                        dict(
                            stdin=subprocess.DEVNULL,
                            stdout=output_file_descr,
                            stderr=subprocess.STDOUT,
                        )
                    )

                process = subprocess.Popen(
                    [
                        sys.executable,
                        os.path.join(ownDir, "..", "frontends", "service_entrypoint.py"),
                        service.name,
                        self.host,
                        str(self.port),
                        str(instanceIdentity),
                        os.path.join(self.sourceDir, str(instanceIdentity)),
                        os.path.join(self.storageDir, str(instanceIdentity)),
                        self.authToken,
                        "--log-level",
                        self.logLevelName,
                    ],
                    **kwargs,
                )
                try:
                    # this should throw a subprocess.TimeoutExpired exception
                    # if the service did not crash
                    process.wait(self.subprocessCheckTimeout)
                except subprocess.TimeoutExpired:
                    pass
                except Exception:
                    import traceback

                    traceback.format_exc()
                else:
                    if process.returncode:
                        msg = (
                            f"Failed to start service_entrypoint.py "
                            f"for service '{service.name}'"
                            f" (retcode:{process.returncode})"
                        )
                        if not self.capture and process.stderr:
                            error = b"".join(process.stderr.readlines())
                            msg += "\n" + error.decode("utf-8")

                        process.terminate()
                        process.wait()
                        raise Exception(msg)

                self._logger.info(
                    f"Started service_entrypoint.py subprocess with PID={process.pid}"
                )

                self.serviceProcesses[instanceIdentity] = process

                if output_file_descr:
                    output_file_descr.close()

            if output_file_path:
                self._logger.info(
                    "Started a service logging to %s with pid %s",
                    output_file_path,
                    process.pid,
                )
            else:
                self._logger.info(
                    "Started service %s/%s with pid %s",
                    service.name,
                    instanceIdentity,
                    process.pid,
                )

    def stop(self, gracefully=True):
        if gracefully:
            if not self.stopAllServices(self.shutdownTimeout):
                self._logger.error(
                    "Failed to gracefully stop all services "
                    f"within {self.shutdownTimeout} seconds"
                )

        ServiceManager.stop(self)
        self.moveCoverageFiles()

        with self.lock:
            for instanceIdentity, workerProcess in self.serviceProcesses.items():
                workerProcess.terminate()

            t0 = time.time()

            def timeRemaining():
                return max(0.0, self.shutdownTimeout - (time.time() - t0))

            for instanceIdentity, workerProcess in self.serviceProcesses.items():
                timeout = timeRemaining()
                self._logger.info(
                    f"Will terminate instance '{instanceIdentity}' (timeout={timeout})"
                )
                try:
                    workerProcess.wait(timeout)
                except subprocess.TimeoutExpired:
                    self._logger.warning(
                        f"Worker Process '{instanceIdentity}' failed to gracefully terminate"
                        + f" within {self.shutdownTimeout} seconds. Sending KILL signal."
                    )

                    # don't update serviceProcesses because we're iterating through it
                    self._killWorkerProcess(instanceIdentity, workerProcess)

            self.serviceProcesses = {}

        self.moveCoverageFiles()

    def _dropServiceProcess(self, identity):
        with self.lock:
            if identity in self.serviceProcesses:
                del self.serviceProcesses[identity]

    def _killWorkerProcess(self, identity, workerProcess):
        if workerProcess:
            workerProcess.kill()
            try:
                workerProcess.wait(timeout=5.0)
            except subprocess.TimeoutExpired:
                self._logger.error(f"Failed to kill Worker Process '{identity}'")

    def cleanup(self):
        with self.cleanupLock:
            with self.lock:
                toCheck = list(self.serviceProcesses.items())

            for identity, workerProcess in toCheck:
                if workerProcess.poll() is not None:  # i.e., the process has terminated
                    workerProcess.wait()
                    self._dropServiceProcess(identity)

            with self.lock:
                toCheck = list(self.serviceProcesses.items())

            with self.db.view():
                for identity, workerProcess in toCheck:
                    serviceInstance = service_schema.ServiceInstance.fromIdentity(identity)

                    if not serviceInstance.exists():
                        if workerProcess.poll() is None:
                            self._logger.info(
                                f"Worker Process '{identity}' shutting down because the "
                                f"server removed its serviceInstance entirely. "
                                f"Sending KILL signal."
                            )
                            self._killWorkerProcess(identity, workerProcess)
                        self._dropServiceProcess(identity)

                    elif (
                        serviceInstance.shouldShutdown
                        and time.time() - serviceInstance.shutdownTimestamp
                        > self.shutdownTimeout
                    ):
                        if workerProcess.poll() is None:
                            self._logger.warning(
                                f"Worker Process '{identity}' failed to gracefully terminate"
                                + f" within {self.shutdownTimeout} seconds."
                                + f" Sending KILL signal. PID={workerProcess.pid}"
                            )
                            self._killWorkerProcess(identity, workerProcess)
                        self._dropServiceProcess(identity)

            self.moveCoverageFiles()
            self.cleanupOldLogfiles()

    def extractLogData(self, targetInstanceId, maxBytes):
        assert isinstance(targetInstanceId, int)

        if self.logfileDirectory:
            with self.lock:
                for file in os.listdir(self.logfileDirectory):
                    instanceId = parseLogfileToInstanceid(file)
                    if instanceId and instanceId == targetInstanceId:
                        fpath = os.path.join(self.logfileDirectory, file)
                        with open(fpath, "r") as f:
                            f.seek(0, 2)
                            curPos = f.tell()
                            f.seek(max(curPos - maxBytes, 0))

                            return f.read()

        return "<logfile not found>"

    def moveCoverageFiles(self):
        if self.storageDir:
            with self.lock:
                if os.path.exists(self.storageDir):
                    for stringifiedInstanceId in os.listdir(self.storageDir):
                        path = os.path.join(self.storageDir, stringifiedInstanceId)
                        if stringifiedInstanceId.startswith(".coverage.") and os.path.isfile(
                            path
                        ):
                            self._logger.debug(
                                "Moving '%s' from %s to %s",
                                stringifiedInstanceId,
                                self.storageDir,
                                repoDir(),
                            )
                            shutil.move(path, os.path.join(repoDir(), stringifiedInstanceId))

    def cleanupOldLogfiles(self):
        if self.logfileDirectory:
            with self.lock:
                for file in os.listdir(self.logfileDirectory):
                    instanceId = parseLogfileToInstanceid(file)

                    if instanceId is not None and not self._isLiveService(instanceId):
                        if not os.path.exists(os.path.join(self.logfileDirectory, "old")):
                            os.makedirs(os.path.join(self.logfileDirectory, "old"))
                        shutil.move(
                            os.path.join(self.logfileDirectory, file),
                            os.path.join(self.logfileDirectory, "old", file),
                        )

        if self.storageDir:
            with self.lock:
                if os.path.exists(self.storageDir):
                    for stringifiedInstanceId in os.listdir(self.storageDir):
                        path = os.path.join(self.storageDir, stringifiedInstanceId)
                        if os.path.isdir(path) and not self._isLiveService(
                            stringifiedInstanceId
                        ):
                            try:
                                self._logger.debug(
                                    "Removing storage at path %s for dead service.", path
                                )
                                shutil.rmtree(path)
                            except Exception:
                                self._logger.exception(
                                    "Failed to remove storage at path %s for dead service:",
                                    path,
                                )

        if self.sourceDir:
            with self.lock:
                if os.path.exists(self.sourceDir):
                    for stringifiedInstanceId in os.listdir(self.sourceDir):
                        if not self._isLiveService(stringifiedInstanceId):
                            try:
                                path = os.path.join(self.sourceDir, stringifiedInstanceId)
                                self._logger.info(
                                    "Removing source caches at path %s for dead service.", path
                                )
                                shutil.rmtree(path)
                            except Exception:
                                self._logger.exception(
                                    "Failed to remove source cache at path %s "
                                    "for dead service:",
                                    path,
                                )

    def _isLiveService(self, instanceId):
        if isinstance(instanceId, str):
            try:
                instanceId = int(instanceId)
            except ValueError:
                return False

        return instanceId in self.serviceProcesses
