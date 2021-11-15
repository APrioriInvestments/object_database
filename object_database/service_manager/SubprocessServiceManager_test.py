import time

from .SubprocessServiceManager import SubprocessServiceManager
from .logfiles_test import makeLogFile


def test_deleteLogsIfOverLimit(tmpdir):
    logsDir = str(tmpdir)

    sleepAmt = 0.015  # this seems sufficient to allow distinguishing between file mod-times

    service1 = "test_service1"
    instance11 = 11
    instance12 = 12

    service2 = "test_service2"
    instance21 = 21
    instance22 = 22
    instance23 = 23

    filesize = len("s1.1.1")

    log121 = makeLogFile("s1.2.1", service1, instance12, logsDir, backupCount=1, isOld=True)
    time.sleep(sleepAmt)

    log120 = makeLogFile("s1.2.0", service1, instance12, logsDir, backupCount=0, isOld=True)
    time.sleep(sleepAmt)

    # this file is newer but should be deleted first
    log231 = makeLogFile("s2.3.1", service2, instance23, logsDir, backupCount=1, isOld=True)
    time.sleep(sleepAmt)

    log230 = makeLogFile("s2.3.0", service2, instance23, logsDir, backupCount=0, isOld=True)
    time.sleep(sleepAmt)

    log221 = makeLogFile("s2.2.1", service2, instance22, logsDir, backupCount=1, isOld=True)
    time.sleep(sleepAmt)

    log220 = makeLogFile("s2.2.0", service2, instance22, logsDir, backupCount=0, isOld=True)
    time.sleep(sleepAmt)

    log211 = makeLogFile("s2.1.1", service2, instance21, logsDir, backupCount=1, isOld=False)
    time.sleep(sleepAmt)

    log210 = makeLogFile("s2.1.0", service2, instance21, logsDir, backupCount=0, isOld=False)
    time.sleep(sleepAmt)

    log112 = makeLogFile("s1.1.2", service1, instance11, logsDir, backupCount=2, isOld=False)
    time.sleep(sleepAmt)

    log111 = makeLogFile("s1.1.1", service1, instance11, logsDir, backupCount=1, isOld=False)
    time.sleep(sleepAmt)

    log110 = makeLogFile("s1.1.0", service1, instance11, logsDir, backupCount=0, isOld=False)
    time.sleep(sleepAmt)

    allFiles = set(
        [
            log110,
            log111,
            log112,
            log120,
            log121,
            log210,
            log211,
            log220,
            log221,
            log230,
            log231,
        ]
    )
    activeFileCount = sum(1 for file in allFiles if file.isActive)
    assert activeFileCount == 2

    def getTotalSize():
        return sum(file.size for file in allFiles)

    assert getTotalSize() == 11 * filesize

    # Shorthand name to improve code visually
    cleanupLogs = SubprocessServiceManager._deleteLogsIfOverLimit

    # We are below the limit, no deletions happen
    toDel, failures = cleanupLogs(logsDir, getTotalSize() + 10)
    assert toDel == -10
    assert failures == []
    for file in allFiles:
        assert file.exists()

    # We are at the limit, no deletions happen
    toDel, failures = cleanupLogs(logsDir, getTotalSize())
    assert toDel == 0
    assert failures == []
    for file in allFiles:
        assert file.exists()

    # We need to delete 1 byte: the oldest file of the service that has 2 old
    # log-sequences gets deleted
    toDel, failures = cleanupLogs(logsDir, getTotalSize() - 1)
    assert toDel == -(filesize - 1)
    assert failures == []
    assert not log231.exists()
    allFiles.remove(log231)
    for file in allFiles:
        assert file.exists()

    # We need to delete 1 more byte: log230 gets deleted
    toDel, failures = cleanupLogs(logsDir, getTotalSize() - 1)
    assert toDel == -(filesize - 1)
    assert failures == []
    assert not log230.exists()
    allFiles.remove(log230)
    for file in allFiles:
        assert file.exists()

    # We need to delete 1 more byte: log121 gets deleted
    toDel, failures = cleanupLogs(logsDir, getTotalSize() - 1)
    assert toDel == -(filesize - 1)
    assert failures == []
    assert not log121.exists()
    allFiles.remove(log121)
    for file in allFiles:
        assert file.exists()

    # We need to delete 1 more byte: log122 gets deleted
    toDel, failures = cleanupLogs(logsDir, getTotalSize() - 1)
    assert toDel == -(filesize - 1)
    assert failures == []
    assert not log120.exists()
    allFiles.remove(log120)
    for file in allFiles:
        assert file.exists()

    # We need to delete 1 more byte: log221 gets deleted
    toDel, failures = cleanupLogs(logsDir, getTotalSize() - 1)
    assert toDel == -(filesize - 1)
    assert failures == []
    assert not log221.exists()
    allFiles.remove(log221)
    for file in allFiles:
        assert file.exists()

    # We need to delete 1 more byte: log220 gets deleted
    toDel, failures = cleanupLogs(logsDir, getTotalSize() - 1)
    assert toDel == -(filesize - 1)
    assert failures == []
    assert not log220.exists()
    allFiles.remove(log220)
    for file in allFiles:
        assert file.exists()

    # We need to delete 1 more byte: log112 gets deleted because s1 has more logs
    # (even though they're newer)
    toDel, failures = cleanupLogs(logsDir, getTotalSize() - 1)
    assert toDel == -(filesize - 1)
    assert failures == []
    assert not log112.exists()
    allFiles.remove(log112)
    for file in allFiles:
        assert file.exists()

    # We need to delete 1 more byte: log211 gets deleted because s1 & s2 have the same
    # logs and s2's is older
    toDel, failures = cleanupLogs(logsDir, getTotalSize() - 1)
    assert toDel == -(filesize - 1)
    assert failures == []
    assert not log211.exists()
    allFiles.remove(log211)
    for file in allFiles:
        assert file.exists()

    # We need to delete 1 more byte: log111 gets deleted because s1 has more logs
    toDel, failures = cleanupLogs(logsDir, getTotalSize() - 1)
    assert toDel == -(filesize - 1)
    assert failures == []
    assert not log111.exists()
    allFiles.remove(log111)
    for file in allFiles:
        assert file.exists()

    # The only remaining logs now are active and cannot be deleted
    for file in allFiles:
        assert file.isActive
    assert len(allFiles) == activeFileCount

    toDel, failures = cleanupLogs(logsDir, getTotalSize() - 1)
    assert toDel == 1
    assert failures == []

    for file in allFiles:
        assert file.exists()
