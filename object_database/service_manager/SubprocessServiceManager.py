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
import shutil
import subprocess
import threading
import time
import sys

from object_database.service_manager.ServiceManager import ServiceManager
from object_database.service_manager.ServiceSchema import service_schema
from object_database.service_manager.logfiles import Logfile, LogsDirectoryQuotaManager
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


class SubprocessServiceManager(ServiceManager):
    SERVICE_NAME = "odb_server"

    def __init__(
        self,
        ownHostname,
        host,
        port,
        sourceDir,
        storageDir,
        authToken,
        placementGroup,
        startTs,
        maxGbRam=4,
        maxCores=4,
        logfileDirectory=None,
        shutdownTimeout=None,
        logLevelName="INFO",
        metricUpdateInterval=2.0,
        start_new_session=False,
        subprocessCheckTimeout=0.0,
        logMaxMegabytes=100.0,
        logMaxTotalMegabytes=20000.0,
        logBackupCount=99,
    ):
        """
        Args:
            ownHostname: see ServiceManager
            host
            port
            sourceDir: see ServiceManager
            storageDir (str): path to where stuff is stored
            authToken
            placementGroup: see ServiceManager
            maxGbRam: see ServiceManager
            maxCores: see ServiceManager
            logfileDirectory (str or None): where to store logs.
            shutdownTimeout: see ServiceManager
            logLevelName (str): One of "CRITICAL", "ERROR", "WARNING", "INFO", "DEBUG"
            metricUpdateInterval (float): see ServiceManager
            start_new_session (bool)
            subprocessCheckTimeout (float)
            logMaxMegabytes (float): number of megabytes an individual logfile
                is allowed to reach
            logMaxTotalMegabytes (float): number of megabytes all the logfiles
                collectively are allowed to reach before clean-up deletions begin.
            logBackupCount (int): the number of backup log files allowed in
                addition to the "front" one, for a live process.
            startTs (int): the start timestamp of the process.
        """
        self.cleanupLock = threading.Lock()
        self.host = host
        self.port = port
        self.storageDir = storageDir
        self.authToken = authToken
        self.logfileDirectory = logfileDirectory
        self.logLevelName = validateLogLevel(logLevelName, fallback="INFO")
        self.start_new_session = start_new_session
        self.subprocessCheckTimeout = subprocessCheckTimeout
        self.logMaxMegabytes = logMaxMegabytes
        self.logMaxTotalBytes = int(logMaxTotalMegabytes * 1024 ** 2)
        self.logBackupCount = logBackupCount

        self.startTs = startTs

        self.failures = set()
        self.lock = threading.Lock()

        self.logsManager = None
        if logfileDirectory:
            if not os.path.exists(logfileDirectory):
                os.makedirs(logfileDirectory)

            self._makeOldLogfileDirectoryIfNeeded()

            self.logsManager = LogsDirectoryQuotaManager(
                self.logfileDirectory, self.logMaxTotalBytes
            )

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
                kwargs = dict(
                    cwd=self.storageDir,
                    start_new_session=self.start_new_session,
                    stderr=subprocess.DEVNULL,
                )

                if self.logfileDirectory is not None:
                    kwargs["stdout"] = subprocess.DEVNULL

                cmd = [
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
                ]

                if self.logfileDirectory is not None:
                    logfileName = service.name + "-" + str(instanceIdentity) + ".log"
                    output_file_path = os.path.join(self.logfileDirectory, logfileName)
                    cmd.extend(["--log-path", output_file_path])
                    cmd.extend(["--log-max-megabytes", str(self.logMaxMegabytes)])
                    cmd.extend(["--log-backup-count", str(self.logBackupCount)])

                else:
                    output_file_path = None
                    logfileName = None

                process = subprocess.Popen(cmd, **kwargs)

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
                        if process.stderr:
                            error = b"".join(process.stderr.readlines())
                            msg += "\n" + error.decode("utf-8")

                        process.terminate()
                        process.wait()
                        raise Exception(msg)

                self._logger.info(
                    f"Started service_entrypoint.py subprocess with PID={process.pid} "
                    "logging to {logfileName}"
                )

                self.serviceProcesses[instanceIdentity] = process

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
            self.cleanupStorageDir()
            self.cleanupSourceDir()

    def moveCoverageFiles(self):
        if self.storageDir:
            with self.lock:
                if os.path.isdir(self.storageDir):
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

                            target = os.path.join(repoDir(), stringifiedInstanceId)

                            try:
                                shutil.move(path, target)

                            except Exception:
                                self._logger.exception("Failed to move %s to %s", path, target)

    def _makeOldLogfileDirectoryIfNeeded(self):
        oldPath = os.path.join(self.logfileDirectory, "old")
        if not os.path.exists(oldPath):
            os.makedirs(oldPath)
        return oldPath

    def _moveLogfile(self, file, oldPath):
        srcPath = os.path.join(self.logfileDirectory, file)
        dstPath = os.path.join(oldPath, file)
        try:
            shutil.move(srcPath, dstPath)

        except Exception as e:
            self._logger.exception("Failed to move %s to %s: %s", srcPath, dstPath, str(e))

    def cleanupOldLogfiles(self):
        if self.logfileDirectory:
            with self.lock:
                if os.path.isdir(self.logfileDirectory):
                    # 1. make old/ path if it doesn't exist
                    oldPath = self._makeOldLogfileDirectoryIfNeeded()

                    # 2. move logs of completed service instances to old/
                    for file in os.listdir(self.logfileDirectory):

                        matches = Logfile.parseLogfileName(file)

                        if matches is not None:
                            service, instanceId, backupCount = matches
                            if service == self.SERVICE_NAME:
                                if instanceId != self.startTs:
                                    self._moveLogfile(file, oldPath)

                            else:
                                if not self._isLiveService(instanceId):
                                    self._moveLogfile(file, oldPath)

                    # 3. delete logs if we exceeded limit
                    bytesToDelete = self.logsManager.deleteLogsIfOverQuota()

                    if bytesToDelete > 0:
                        self._logger.error(
                            f"Failed to delete enough logfiles to reduce log footprint to "
                            f"{self.logMaxTotalBytes/(1.0 * 1024 ** 2):.2f}MB. "
                            f"Needed to delete {bytesToDelete} more bytes"
                        )
                        return False

                    else:
                        return True

    def cleanupStorageDir(self):
        if self.storageDir:
            with self.lock:
                if os.path.isdir(self.storageDir):
                    for instanceIdStr in os.listdir(self.storageDir):
                        path = os.path.join(self.storageDir, instanceIdStr)
                        if os.path.isdir(path) and not self._isLiveService(instanceIdStr):
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

    def cleanupSourceDir(self):
        if self.sourceDir:
            with self.lock:
                if os.path.isdir(self.sourceDir):
                    for instanceIdStr in os.listdir(self.sourceDir):
                        if not self._isLiveService(instanceIdStr):
                            try:
                                path = os.path.join(self.sourceDir, instanceIdStr)
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
