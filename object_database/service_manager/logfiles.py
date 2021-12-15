import logging
import os
import re

from object_database.util import getDirectorySize


Timestamp = float


class Logfile:
    """ Stores a filepath corresponing to a log-file and some pre-computed stuff about it. """

    @staticmethod
    def fromFilepath(filepath):
        path, filename = os.path.split(filepath)
        return Logfile(filename, path)

    def __init__(self, filename, path):
        """
        Args:
            filename (str): the filename of the log file
            path (str): the full path of the parent directory
        """
        filepath = os.path.join(path, filename)
        if not os.path.isfile(filepath):
            raise FileNotFoundError(filepath)

        res = self.parseLogfileName(filename)
        if res is None:
            raise ValueError(f"Invalid filename '{filename}'.")

        self._parentDir = path
        self._filename = filename
        self._filepath = filepath
        self._service = res[0]
        self._instance = res[1]
        self._backupCount = res[2] if res[2] is not None else 0
        self._isOld = path[-4:] == "/old"
        self._isActive = self._backupCount == 0 and not self._isOld

        if self._isActive:
            self._size = None
            self._modtime = None  # will be computed on each call

        else:
            self._size = os.path.getsize(filepath)
            self._modtime = os.path.getmtime(filepath)

    @property
    def filepath(self) -> str:
        return self._filepath

    @property
    def size(self) -> int:
        if self._isActive:
            return os.path.getsize(self._filepath)
        else:
            return self._size

    @property
    def modtime(self) -> Timestamp:
        if self._isActive:
            return os.path.getmtime(self._filepath)

        else:
            return self._modtime

    @property
    def service(self) -> str:
        return self._service

    @property
    def instance(self) -> int:
        return self._instance

    @property
    def backupCount(self) -> int:
        return self._backupCount

    @property
    def isOld(self) -> bool:
        return self._isOld

    @property
    def isActive(self) -> bool:
        return self._isActive

    def exists(self) -> bool:
        return os.path.isfile(self._filepath)

    def delete(self) -> bool:
        """ Returns the number of bytes that were deleted. """
        if self._isActive:
            # refuse to delete an active front log slice
            return 0

        try:
            os.remove(self._filepath)
            return self._size

        except FileNotFoundError:
            return 0

    def __hash__(self):
        return hash(self._filepath)

    def __eq__(self, other):
        if isinstance(other, Logfile):
            return self._filepath == other.filepath

        elif isinstance(other, str):
            return self._filepath == other

        else:
            return False

    _regex = None  # class level variable: caches compiled regex

    @classmethod
    def _getRegex(cls):
        if cls._regex is None:
            # pattern: (service-name)-(instanceID).log[.backup-number]
            # where:
            #    service-name is an arbitrary string
            #    instanceID is a non-zero sequence of digits [0-9]
            #    [.backup-number] is optional and it's a dot followed by a
            #        non-zero sequence of digits

            # NOTE: using an r-string to disable unicode interpretation of \d
            pattern = r"(.*)-(\d+)\.log(\.(\d+))?"
            cls._regex = re.compile(pattern)
        return cls._regex

    @classmethod
    def parseLogfileName(cls, fname):
        """Parse a file name and return the integer instance id for the service."""
        match = cls._getRegex().fullmatch(fname)
        if match is None:
            return

        serviceName = match.group(1)

        try:
            instanceId = int(match.group(2))

        except ValueError:
            return

        backupCount = match.group(4)
        try:
            if backupCount is not None:
                backupCount = int(backupCount)
        except ValueError:
            return

        return serviceName, instanceId, backupCount

    @classmethod
    def parseLogfileToInstanceid(cls, fname):
        matches = cls.parseLogfileName(fname)
        return None if matches is None else matches[1]


class LogfileSet:
    """ A sequence of Logfile objects for a specific service.

    Logfiles must belog to the same service, but may belong to different processes.
    Each process may have multple logfiles with .1, .2, etc extensions.
    """

    def __init__(self, service: str):
        self._service = service
        # map of instance -> SetOf[Logfile]
        self._logfilesByInstance = {}

        self._size = 0
        self._len = 0
        self._oldest = None

    @property
    def service(self):
        return self._service

    @property
    def size(self):
        return self._size

    @property
    def oldest(self):
        return self._oldest

    @property
    def oldestModtime(self):
        if self._oldest is not None:
            return self._oldest.modtime
        else:
            return 0.0

    def instanceCount(self):
        return len(self._logfilesByInstance.keys())

    def logCount(self):
        return self._len

    def __len__(self):
        return self._len

    def addLogfile(self, logfile: Logfile):
        if logfile.service != self._service:
            raise ValueError(
                f"Cannot add Lofgile for service '{logfile.service}' "
                f"to LogfileSequence for service '{self._service}'."
            )

        if (
            logfile.instance in self._logfilesByInstance
            and logfile in self._logfilesByInstance[logfile.instance]
        ):
            return

        self._logfilesByInstance.setdefault(logfile.instance, set()).add(logfile)

        self._size += logfile.size
        self._len += 1

        if self._oldest is None or logfile.modtime < self._oldest.modtime:
            self._oldest = logfile

    def deleteOldest(self, alwaysRemoveOldest=True) -> int:
        """ Returns the number of bytes that were deleted.

        Args:
            alwaysRemoveOldest (bool): when False, only remove the oldest Logfile
                from the LogfileSet if it was successfully deleted.
        """
        if self._oldest is None:
            return 0

        toDelete = self._oldest

        deletedBytes = toDelete.delete()
        if alwaysRemoveOldest or not toDelete.exists():
            self._removeExistingLogfile(toDelete)

        return deletedBytes

    def _removeExistingLogfile(self, logfile):
        self._size -= logfile.size
        self._len -= 1

        self._logfilesByInstance[logfile.instance].remove(logfile)
        if len(self._logfilesByInstance[logfile.instance]) == 0:
            del self._logfilesByInstance[logfile.instance]

        self._updateOldest()

    def _updateOldest(self):
        candidates = set(
            logfile
            for instanceLogs in self._logfilesByInstance.values()
            for logfile in instanceLogs
        )
        if len(candidates) == 0:
            self._oldest = None

        else:
            self._oldest = min(candidates, key=lambda logfile: logfile.modtime)


class LogsDirectoryQuotaManager:
    """ Object in charge for cleaning up the logs dir if it exceeds a quota. """

    def __init__(self, path, maxBytes):
        self._checkIsDir(path)
        self.path = path

        self.oldsPath = os.path.join(self.path, "old")
        self._checkIsDir(self.oldsPath)

        self.maxBytes = maxBytes

        self.logger = logging.getLogger(__name__)
        self.failures = set()

    @staticmethod
    def _checkIsDir(path):
        if not os.path.exists(path):
            raise FileNotFoundError(f"Path not found '{path}'")

        if not os.path.isdir(path):
            raise FileExistsError(f"Path exists but is not a directory '{path}'")

    def deleteLogsIfOverQuota(self):
        """ Tries to delete enough log files to be within specified quota

        Returns the number of bytes that still need to be deleted to reach the quota,
        or if negative, the number of bytes available for further logging.
        """

        logsByService = self._collectLogsFromPath(self.path)
        oldLogsByService = self._collectLogsFromPath(self.oldsPath)

        totalSize = getDirectorySize(self.path)

        bytesToDelete = totalSize - self.maxBytes
        if bytesToDelete > 0:

            # Try to keep logs for one exited process per service
            deletedBytes = self._deleteOldestAmongServicesWithAtLeastKInstances(
                oldLogsByService, bytesToDelete, K=2
            )
            bytesToDelete -= deletedBytes

            # Failing that, try to keep all the active logs
        if bytesToDelete > 0:
            deletedBytes = self._deleteOldestAmongServicesWithAtLeastKInstances(
                oldLogsByService, bytesToDelete, K=1
            )
            bytesToDelete -= deletedBytes

        if bytesToDelete > 0:
            bytesToDelete -= self._deleteFromLargestLogfileSet(logsByService, bytesToDelete)

        return bytesToDelete

    def _collectLogsFromPath(self, path, logsByService=None):
        if logsByService is None:
            logsByService = {}

        for file in os.listdir(path):
            if os.path.isfile(os.path.join(path, file)):
                failure = f"failed to collect logfile {path}/{file} for cleanup"

                try:
                    log = Logfile(file, path)
                    if log.service not in logsByService:
                        logsByService[log.service] = LogfileSet(log.service)
                    logsByService[log.service].addLogfile(log)

                except (FileNotFoundError, ValueError) as e:
                    if failure not in self.failures:
                        self.failures.add(failure)
                        self.logger.exception(f"{failure}: {str(e)}")

                else:
                    self.failures.discard(failure)

        return logsByService

    @staticmethod
    def _deleteOldestAmongServicesWithAtLeastKInstances(
        logsByService, bytesToDelete: int, K: int
    ) -> int:
        """ Repeatedly delete the oldest logfile among services with K or more instances.

        Returns the number of bytes freed from the disk

        Args:
            logsByService (Dict[service_name:str -> LogfileSet]): known logfiles by service
            bytesToDelete (int): the number of bytes we need to delete
            K (int): the number of instances a service needs to have to qualify for deletions.
        """
        candidates = {
            service: logSet
            for service, logSet in logsByService.items()
            if logSet.instanceCount() >= K
        }

        totalDeletedBytes = 0
        while len(candidates) > 0 and totalDeletedBytes < bytesToDelete:
            oldestLogSet = min(
                (logSet for logSet in candidates.values()),
                key=lambda logSet: logSet.oldest.modtime,
            )
            totalDeletedBytes += oldestLogSet.deleteOldest()
            if oldestLogSet.instanceCount() < K:
                del candidates[oldestLogSet.service]

        return totalDeletedBytes

    @staticmethod
    def _deleteFromLargestLogfileSet(logsByService, bytesToDelete: int):
        """ Repeatedly delete the oldest logfile from the largest LogfileSet.

        Returns the number of bytes freed from the disk

        Args:
            logsByService (Dict[service_name:str -> LogfileSet]): known logfiles by service
            bytesToDelete (int): the number of bytes we need to delete
            K (int): the number of instances a service needs to have to qualify for deletions.
        """
        totalDeletedBytes = 0
        while totalDeletedBytes < bytesToDelete:
            largestLogSet = max(
                (logSet for logSet in logsByService.values()),
                key=lambda logSet: (logSet.size, -logSet.oldest.modtime),
            )
            deletedBytes = largestLogSet.deleteOldest()
            if deletedBytes == 0:
                break

            else:
                totalDeletedBytes += deletedBytes

        return totalDeletedBytes
