import os
import time
import struct
import threading

from typed_python.SerializationContext import SerializationContext


class LoggingTransactionWatcher:
    def __init__(self, logDir):
        try:
            if not os.path.exists(logDir):
                os.makedirs(logDir)
        except OSError:
            pass

        self.file = open(os.path.join(logDir, f"transactions_{time.time()}"), "wb")
        self.serializationContext = SerializationContext()

        self.lock = threading.Lock()
        self.shouldStop = threading.Event()
        self.flushThread = threading.Thread(target=self.flushLoop)
        self.flushThread.daemon = True
        self.flushThread.start()

    def stop(self):
        self.shouldStop.set()
        self.flushThread.join()
        self.file.close()

    def onTransaction(
        self,
        connectionId,
        key_value,
        prerequisites,
        set_adds,
        set_removes,
        keys_to_check_versions,
        indices_to_check_versions,
        as_of_version,
        transaction_id,
        transaction_guid,
        channelConnsSentTo,
        succeeded,
        conflictingKeyIfFailed,
        errorOrNone,
    ):
        serializedBytes = self.serializationContext.serialize(
            dict(
                connectionId=connectionId,
                key_value=key_value,
                prerequisites=prerequisites,
                set_adds=set_adds,
                set_removes=set_removes,
                keys_to_check_versions=keys_to_check_versions,
                indices_to_check_versions=indices_to_check_versions,
                as_of_version=as_of_version,
                errorOrNone=errorOrNone,
                transaction_id=transaction_id,
                transaction_guid=transaction_guid,
                succeeded=succeeded,
                conflictingKeyIfFailed=conflictingKeyIfFailed,
                channelConnsSentTo=channelConnsSentTo,
            )
        )
        with self.lock:
            self.file.write(struct.pack("q", len(serializedBytes)))
            self.file.write(serializedBytes)

    def flush(self):
        with self.lock:
            self.file.flush()

    def flushLoop(self):
        while not self.shouldStop.is_set():
            self.shouldStop.wait(0.1)

            with self.lock:
                self.file.flush()

    @staticmethod
    def replayEvents(logDir, onEvent):
        tsToPath = {}

        for path in os.listdir(logDir):
            if path.startswith("transactions_"):
                tsToPath[float(path.split("_")[1])] = os.path.join(logDir, path)

        for timestamp, path in sorted(tsToPath.items()):
            LoggingTransactionWatcher.replayEventsFromFile(open(path, "rb"), onEvent)

    @staticmethod
    def replayEventsFromFile(file, onEvent):
        PACKET_HEADER_SIZE = struct.calcsize("q")

        while True:
            dat = file.read(PACKET_HEADER_SIZE)

            if len(dat) != PACKET_HEADER_SIZE:
                return

            packetSize = struct.unpack("q", dat)[0]

            dat = file.read(packetSize)

            if len(dat) != packetSize:
                return

            packet = SerializationContext().deserialize(dat)

            onEvent(
                packet["connectionId"],
                packet["key_value"],
                packet["prerequisites"],
                packet["set_adds"],
                packet["set_removes"],
                packet["keys_to_check_versions"],
                packet["indices_to_check_versions"],
                packet["as_of_version"],
                packet["transaction_id"],
                packet["transaction_guid"],
                packet["succeeded"],
                packet["conflictingKeyIfFailed"],
                packet["channelConnsSentTo"],
                packet["errorOrNone"],
            )
