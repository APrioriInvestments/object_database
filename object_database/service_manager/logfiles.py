import os
import re

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

    Logfiles must belog to the same service, but may belong to different processes,
    all of which except for possibly one are old and no longer active.
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

    def deleteOldest(self) -> int:
        """ Returns the number of bytes that were deleted. """
        if self._oldest is None:
            return 0

        toDelete = self._oldest

        deletedBytes = toDelete.delete()
        if not toDelete.exists():
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
