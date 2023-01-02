import os
import fcntl

import time
import select
import threading
import logging
import queue
import traceback
import subprocess
import struct
import termios


class InteractiveSubprocess(object):
    def __init__(
        self,
        subprocessArguments,
        onStdOut,
        env=None,
        shell=False,
    ):
        self.shell = shell
        self.onStdOut = onStdOut
        self.subprocessArguments = subprocessArguments
        self.env = env

        self.pipeReadBufferSize = 1024

        self.wakePipeWrite, self.wakePipeRead = None, None

        self.onDisconnected = None
        self.subprocessOutThread = None
        self.isShuttingDown = False
        self.process = None
        self.isStarted = False
        self.messagePumpThread = None
        self.messagePumpQueue = queue.Queue()

        self.ttyParent = None
        self.ttyChild = None

    def start(self):
        assert self.subprocessOutThread is None or not self.subprocessOutThread.is_alive()

        self.ttyParent, self.ttyChild = os.openpty()
        self.wakePipeRead, self.wakePipeWrite = os.pipe()

        # start our reading threads BEFORE we open the process
        self.subprocessOutThread = threading.Thread(target=self.processOutputLoop)

        self.subprocessOutThread.start()

        subprocessEvent = threading.Event()

        def startSubprocess():
            try:

                def preexec_fn():
                    os.setsid()

                self.process = subprocess.Popen(
                    self.subprocessArguments,
                    stdin=self.ttyChild,
                    stdout=self.ttyChild,
                    stderr=self.ttyChild,
                    env=self.env,
                    close_fds=True,
                    shell=self.shell,
                    preexec_fn=preexec_fn,
                )

                subprocessEvent.set()
            except Exception:
                logging.error("Failed to start subprocess:\n%s", traceback.format_exc())

        startSubprocessThread = threading.Thread(target=startSubprocess)
        startSubprocessThread.start()

        subprocessEvent.wait(10.0)

        assert subprocessEvent.isSet(), "Failed to start the subprocess."

        os.close(self.ttyChild)
        self.isStarted = True

        return self

    @property
    def pid(self):
        if self.process is None:
            return None
        else:
            return self.process.pid

    def __str__(self):
        return "Subprocess(isStarted=%s, args=%s)" % (self.isStarted, self.subprocessArguments)

    def write(self, content):
        assert self.isStarted, "Process is not started."
        if isinstance(content, str):
            content = content.encode("utf8")

        os.write(self.ttyParent, content)

    def stop(self, blocking=False):
        try:
            if self.process:
                # disconnect the subprocess
                try:
                    if self.process.poll() is None:
                        self.process.kill()
                except OSError:
                    pass

                if blocking:
                    self.process.wait()
                    assert self.process.poll() is not None

            self.isShuttingDown = True

            if self.subprocessOutThread is not None and not self.isSuprocessOutThread():
                os.write(self.wakePipeWrite, b" ")

                if blocking:
                    self.subprocessOutThread.join()
                    assert not self.subprocessOutThread.is_alive()

            os.close(self.wakePipeWrite)
        finally:
            self.isShuttingDown = False

    def terminate(self):
        assert self.isStarted
        self.process.terminate()

    def wait(self, timeout=None, interval=0.1):
        if timeout is None:
            return self.process.wait()

        toStopTime = time.time() + timeout
        while self.process.poll() is None and time.time() < toStopTime:
            time.sleep(interval)

        return self.process.poll()

    def isSuprocessOutThread(self):
        return threading.currentThread().ident == self.subprocessOutThread.ident

    def isSuprocessErrThread(self):
        return threading.currentThread().ident == self.subprocessOutThread.ident

    def processOutputLoop(self):
        fcntl.fcntl(self.ttyParent, fcntl.F_SETFL, os.O_NONBLOCK)

        buf = b""

        try:
            while not self.isShuttingDown:
                r, _, e = select.select([self.ttyParent, self.wakePipeRead], [], [])

                if self.ttyParent in r:
                    data = os.read(self.ttyParent, self.pipeReadBufferSize)

                    if not data:
                        return

                    buf += data

                    # utf8 is a multi-byte protocol, so we might get
                    # part of a codepoint
                    encodedString, buf = decodePartialUtf8(buf)

                    if encodedString:
                        self.onStdOut(encodedString)
        finally:
            logging.info("InteractiveSubprocess read loop shutting down")
            os.close(self.ttyParent)
            os.close(self.wakePipeRead)

    def setSize(self, rows, cols):
        fcntl.ioctl(
            self.ttyParent,
            termios.TIOCSWINSZ,
            struct.pack("HHHH", rows, cols, rows * 12, cols * 8),
        )
        fcntl.ioctl(
            self.ttyParent,
            termios.TIOCSWINSZ,
            struct.pack("HHHH", rows, cols, rows * 12, cols * 8),
        )


def decodePartialUtf8(buf):
    for badBytes in range(4):
        if badBytes == 0:
            head = buf
            tail = b""
        else:
            head = buf[:-badBytes]
            tail = buf[-badBytes:]

        try:
            return head.decode("utf8"), tail
        except Exception:
            pass

    # if we still don't have valid utf8, just bail
    if len(buf) < 8:
        return "", buf

    # try chopping off the front byte and hoping we get something
    # sensible?
    return decodePartialUtf8(buf[1:])
