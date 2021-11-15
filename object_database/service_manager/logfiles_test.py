import os
import pytest
import time

from .logfiles import Logfile, LogfileSet


def test_parseLogfileName():
    checks = [
        ("asdf-1234.log", ("asdf", 1234, None)),
        ("asdf-1234.log.1", ("asdf", 1234, 1)),
        ("asdf-1234.log.223", ("asdf", 1234, 223)),
        ("asdf-asdf-1234.log.223", ("asdf-asdf", 1234, 223)),
        ("asdf-asdf-12-34.log.223", ("asdf-asdf-12", 34, 223)),
        ("asdf-1234.log.", None),
        ("asdf-1234.log..", None),
        ("asdf-1234.lo", None),
        ("asdf-1234_log", None),
        ("asdf_1234.log", None),
    ]

    for fname, res in checks:
        assert Logfile.parseLogfileName(fname) == res

        if res:
            assert Logfile.parseLogfileToInstanceid(fname) == res[1]
        else:
            assert Logfile.parseLogfileToInstanceid(fname) is None


def makeLogFile(contents, service, instance: int, logsDir, isOld=False, backupCount=0):
    filename = f"{service}-{instance}.log"
    if backupCount > 0:
        filename = filename + f".{backupCount}"

    if isOld:
        path = os.path.join(logsDir, "old")
        if not os.path.isdir(path):
            os.makedirs(path)
    else:
        path = logsDir

    filepath = os.path.join(path, filename)
    with open(filepath, "w") as f:
        f.write(contents)

    log = Logfile(filename, path)
    assert log.exists()
    return log


def test_logfile(tmpdir):
    logsDir = str(tmpdir)

    with pytest.raises(FileNotFoundError):
        Logfile("asdf", logsDir)

    with open(os.path.join(logsDir, "asdf"), "w") as f:
        f.write("LOGS, LOGS, LOGS!")

    with pytest.raises(ValueError, match="Invalid filename"):
        Logfile("asdf", logsDir)

    contents = "logs, Logs, LOGS!!!"
    size = len(contents)
    service = "logfile_test"
    instance = 789

    # Front log of active process (active log)
    log0 = makeLogFile(contents, service, instance, logsDir)
    path, filename = os.path.split(log0.filepath)
    assert path == logsDir
    assert log0.service in filename
    assert str(log0.instance) in filename

    assert log0.service == service
    assert log0.instance == instance
    assert log0.backupCount == 0
    assert log0.isOld is False
    assert log0.size == len(contents)
    assert log0.modtime == os.path.getmtime(log0.filepath)

    assert log0.exists()
    assert log0.delete() == 0
    assert log0.exists()
    assert os.path.isfile(log0.filepath)

    # Log of old process
    log1 = makeLogFile(contents, service, instance, logsDir, isOld=True)
    assert log1.isOld is True
    assert log1.size == size
    assert log1.modtime is not None

    assert log1.exists()
    assert log1.delete() == size
    assert not log1.exists()
    assert not os.path.isfile(log1.filepath)

    # Backup log of active process
    log2 = makeLogFile(contents, service, instance, logsDir, backupCount=1)
    log3 = Logfile.fromFilepath(log2.filepath)
    assert log2 is not log3

    assert log2.backupCount == 1
    assert log2.size == size
    assert log2.modtime is not None

    assert log2.exists()
    assert log2.delete() == size
    assert not log2.exists()
    assert not os.path.isfile(log2.filepath)

    assert not log3.exists()
    assert log3.delete() == 0

    assert log0 != log1
    assert log0 != log2
    assert log1 != log2
    assert log2 == log3

    assert hash(log0) != hash(log1)
    assert hash(log0) != hash(log2)
    assert hash(log1) != hash(log2)
    assert hash(log2) == hash(log3)

    assert hash(log2) == hash(log2.filepath)
    assert log2 == log2.filepath
    assert log2 != 42


def test_logset(tmpdir):
    logsDir = str(tmpdir)
    service = "logfile_test"
    logSet = LogfileSet(service)
    assert logSet.size == 0
    assert logSet.service == service

    newInstance = 789
    oldInstance = 678
    size = len("new 0")

    sleepAmt = 0.005
    log5 = makeLogFile("old 2", service, oldInstance, logsDir, backupCount=2, isOld=True)
    time.sleep(sleepAmt)  # ensure different mod-times
    log4 = makeLogFile("old 1", service, oldInstance, logsDir, backupCount=1, isOld=True)
    time.sleep(sleepAmt)  # ensure different mod-times
    log3 = makeLogFile("old 0", service, oldInstance, logsDir, isOld=True)

    time.sleep(sleepAmt)  # ensure different mod-times
    log2 = makeLogFile("new 2", service, newInstance, logsDir, backupCount=2)
    time.sleep(sleepAmt)  # ensure different mod-times
    log1 = makeLogFile("new 1", service, newInstance, logsDir, backupCount=1)
    time.sleep(sleepAmt)  # ensure different mod-times
    log0 = makeLogFile("new 0", service, newInstance, logsDir)

    # only add the front log, which cannot be deleted
    logSet.addLogfile(log0)
    assert len(logSet) == 1
    assert logSet.oldest == log0
    assert logSet.size == size
    assert logSet.deleteOldest() == 0

    # now add all the logs
    logs = [log0, log1, log2, log3, log4, log5]

    for log in logs:
        logSet.addLogfile(log)

    assert len(logSet) == len(logs)
    assert len(logSet) == logSet.logCount()
    assert logSet.instanceCount() == 2
    assert logSet.size == size * len(logs)
    assert logSet.oldest == log5

    # adding all the logs again should not change anything
    for log in logs:
        logSet.addLogfile(log)

    assert len(logSet) == len(logs)
    assert len(logSet) == logSet.logCount()
    assert logSet.instanceCount() == 2
    assert logSet.size == size * len(logs)
    assert logSet.oldest == log5

    # Deleting logs starting from the oldest
    ix = 0
    while len(logSet) > 1:
        assert logSet.deleteOldest() == size
        ix += 1
        assert len(logSet) == len(logs) - ix
        assert logSet.size == size * (len(logs) - ix)
        if ix < 3:
            assert logSet.instanceCount() == 2
        else:
            assert logSet.instanceCount() == 1

        assert logSet.oldest == logs[-(ix + 1)]

    log6 = makeLogFile(
        "ooo 2", "other_service", oldInstance, logsDir, backupCount=2, isOld=True
    )
    with pytest.raises(ValueError):
        logSet.addLogfile(log6)
