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

import unittest
import queue
import threading
import time
import os

from flaky import flaky
from object_database.message_bus import MessageBus
from object_database.bytecount_limited_queue import BytecountLimitedQueue


TIMEOUT = 5.0


class TestMessageBus(unittest.TestCase):
    def setUp(self):
        assert os.path.exists(
            "testcert.cert"
        ), "run 'make testcert.cert' to ensure the test certs are present."

        self.messageQueue1 = queue.Queue()
        self.messageBus1 = MessageBus(
            "bus1",
            ("localhost", 8000),
            str,
            str,
            self.messageQueue1.put,
            None,
            None,
            "testcert.cert",
        )

        self.messageQueue2 = queue.Queue()
        self.messageBus2 = MessageBus(
            "bus2",
            ("localhost", 8001),
            str,
            str,
            self.messageQueue2.put,
            None,
            None,
            "testcert.cert",
        )

        self.messageBus1.start()
        self.messageBus2.start()

    def tearDown(self):
        self.messageBus1.stop(timeout=TIMEOUT)
        self.messageBus2.stop(timeout=TIMEOUT)

    def test_starting_and_stopping(self):
        for _ in range(100):
            messageBus3 = MessageBus(
                "bus3",
                ("localhost", 8003),
                str,
                str,
                self.messageQueue1.put,
                None,
                None,
                "testcert.cert",
            )
            messageBus3.start()
            messageBus3.stop(timeout=TIMEOUT)

    @flaky(max_runs=3, min_passes=1)
    def test_worker_can_send_messages(self):
        conn1 = self.messageBus1.connect(("localhost", 8001))

        # the bus should be happy to tell us we got a message
        self.assertTrue(self.messageBus1.sendMessage(conn1, "hi"))

        # the first bus knows we connected
        self.assertTrue(
            self.messageQueue1.get(timeout=TIMEOUT).matches.OutgoingConnectionEstablished
        )

        # the incoming bus gets a IncomingMessage
        channelMsg = self.messageQueue2.get(timeout=TIMEOUT)
        self.assertTrue(channelMsg.matches.NewIncomingConnection)

        # we should then get a message that knows which ID it is
        dataMsg = self.messageQueue2.get(timeout=TIMEOUT)
        self.assertTrue(dataMsg.matches.IncomingMessage)
        self.assertTrue(dataMsg.message, "hi")
        self.assertEqual(dataMsg.connectionId, channelMsg.connectionId)

        # we can respond on this channel
        self.assertTrue(self.messageBus2.sendMessage(dataMsg.connectionId, "Response"))

        # we should get back the message on the first channel
        self.assertEqual(self.messageQueue1.get(timeout=TIMEOUT).message, "Response")

    def test_invalid_connection(self):
        self.messageBus1.connect(("localhost", 9010))
        self.assertTrue(
            self.messageQueue1.get(timeout=TIMEOUT).matches.OutgoingConnectionFailed
        )

    def test_stopping_triggers_disconnects(self):
        self.messageBus1.connect(("localhost", 8001))
        self.assertTrue(
            self.messageQueue1.get(timeout=TIMEOUT).matches.OutgoingConnectionEstablished
        )
        self.assertTrue(self.messageQueue2.get(timeout=TIMEOUT).matches.NewIncomingConnection)

        self.messageBus2.connect(("localhost", 8000))
        self.assertTrue(
            self.messageQueue2.get(timeout=TIMEOUT).matches.OutgoingConnectionEstablished
        )
        self.assertTrue(self.messageQueue1.get(timeout=TIMEOUT).matches.NewIncomingConnection)

        # stop the second bus
        self.messageBus2.stop(timeout=TIMEOUT)
        self.assertTrue(self.messageQueue2.get(timeout=TIMEOUT).matches.Stopped)

        # we should see our connections get closed
        msg1 = self.messageQueue1.get(timeout=TIMEOUT)
        msg2 = self.messageQueue1.get(timeout=TIMEOUT)

        if msg2.matches.IncomingConnectionClosed:
            msg1, msg2 = msg2, msg1

        self.assertTrue(msg1.matches.IncomingConnectionClosed, msg1)
        self.assertTrue(msg2.matches.OutgoingConnectionClosed, msg2)

    def test_actively_closing(self):
        for passIx in range(100):
            connId = self.messageBus1.connect(("localhost", 8001))
            self.assertTrue(
                self.messageQueue1.get(timeout=TIMEOUT).matches.OutgoingConnectionEstablished
            )
            self.assertTrue(
                self.messageQueue2.get(timeout=TIMEOUT).matches.NewIncomingConnection
            )

            self.messageBus1.closeConnection(connId)
            self.assertTrue(
                self.messageQueue1.get(timeout=TIMEOUT).matches.OutgoingConnectionClosed
            )
            self.assertTrue(
                self.messageQueue2.get(timeout=TIMEOUT).matches.IncomingConnectionClosed
            )

    def test_closing_incoming(self):
        self.messageBus1.connect(("localhost", 8001))
        self.assertTrue(
            self.messageQueue1.get(timeout=TIMEOUT).matches.OutgoingConnectionEstablished
        )

        # queue2 should see this
        msgIncoming = self.messageQueue2.get(timeout=TIMEOUT)
        self.assertTrue(msgIncoming.matches.NewIncomingConnection)

        # if queue2 closes it
        self.messageBus2.closeConnection(msgIncoming.connectionId)

        # then queue 1 should see it
        self.assertTrue(
            self.messageQueue1.get(timeout=TIMEOUT).matches.OutgoingConnectionClosed
        )

    def test_callbacks_basic(self):
        q = queue.Queue()

        def sender(i):
            return lambda: q.put(i)

        for i in range(10):
            self.messageBus1.scheduleCallback(sender(i))

        for i in range(10):
            self.assertEqual(q.get(timeout=TIMEOUT), i)

    def test_callbacks_with_exceptions_are_ok(self):
        q = queue.Queue()

        def sender(i):
            return lambda: q.put(i)

        def excepter():
            assert False

        for i in range(10):
            self.messageBus1.scheduleCallback(sender(i))
            self.messageBus1.scheduleCallback(excepter)

        for i in range(10):
            self.assertEqual(q.get(timeout=0.1), i)

    def test_callbacks_in_odd_ordering(self):
        q = queue.Queue()

        def sender(i):
            return lambda: q.put(i)

        def excepter():
            assert False

        t0 = time.time()
        for i in range(10):
            self.messageBus1.scheduleCallback(sender(i), atTimestamp=t0 + 0.05 - i / 1000.0)

        for i in reversed(range(10)):
            self.assertEqual(q.get(timeout=TIMEOUT), i)

    @flaky(max_runs=3, min_passes=1)
    def test_callbacks_intermixed_with_messages(self):
        q = queue.Queue()

        def sender(i):
            return lambda: q.put(i)

        for i in range(100):
            self.messageBus1.scheduleCallback(sender(i), delay=i / 100.0)

        connId1 = self.messageBus1.connect(("localhost", 8001))
        connId2 = self.messageBus2.connect(("localhost", 8000))
        read1 = [0]
        read2 = [0]

        self.messageBus1.sendMessage(connId1, "A")

        def conn1Reader():
            while True:
                msg = self.messageQueue1.get()
                if msg.matches.Stopped:
                    return
                read1[0] += 1
                try:
                    self.messageBus1.sendMessage(connId1, "A")
                except Exception:
                    return

        def conn2Reader():
            while True:
                msg = self.messageQueue2.get()
                if msg.matches.Stopped:
                    return
                read2[0] += 1
                try:
                    self.messageBus2.sendMessage(connId2, "A")
                except Exception:
                    return

        t1 = threading.Thread(target=conn1Reader, daemon=True)
        t2 = threading.Thread(target=conn2Reader, daemon=True)
        t1.start()
        t2.start()

        for i in range(100):
            self.assertEqual(q.get(timeout=0.1), i)

        self.messageBus1.stop(timeout=TIMEOUT)
        self.messageBus2.stop(timeout=TIMEOUT)

        t1.join()
        t2.join()

        self.assertGreater(read1[0], 100)
        self.assertGreater(read2[0], 100)

    def test_auth(self):
        # bus1 requires auth
        self.messageBus1.stop(timeout=TIMEOUT)
        self.messageQueue1 = queue.Queue()
        self.messageBus1 = MessageBus(
            "bus1",
            ("localhost", 8000),
            str,
            str,
            self.messageQueue1.put,
            "auth_token",
            None,
            "testcert.cert",
        )
        self.messageBus1.start()

        # # connecting to the other bus fails. Note that this will
        # # trigger an 'Invalid wire type encountered' deserialization error
        # # which makes sense because we're sending an auth message when none is
        # # required, and the receiver will attempt to deserialize it as a Message
        # self.messageBus1.connect(("localhost", 8001))

        # self.assertTrue(self.messageQueue1.get(timeout=TIMEOUT).OutgoingConnectionEstablished)
        # self.assertTrue(self.messageQueue1.get(timeout=TIMEOUT).OutgoingConnectionClosed)

        # now bus2 requires auth, but different auth
        # self.messageBus2.stop(timeout=TIMEOUT)
        # self.messageQueue2 = queue.Queue()
        # self.messageBus2 = MessageBus(
        #     "bus2",
        #     ("localhost", 8001),
        #     str,
        #     str,
        #     self.messageQueue2.put,
        #     "auth_token_other",
        #     None,
        #     "testcert.cert",
        # )
        # self.messageBus2.start()

        # # connecting to the other bus fails
        # self.messageBus1.connect(("localhost", 8001))
        # self.assertTrue(self.messageQueue1.get(timeout=TIMEOUT).OutgoingConnectionEstablished)
        # self.assertTrue(self.messageQueue1.get(timeout=TIMEOUT).OutgoingConnectionClosed)

        # but if they have the same token it works
        self.messageBus2.stop(timeout=TIMEOUT)
        self.messageQueue2 = queue.Queue()
        self.messageBus2 = MessageBus(
            "bus2",
            ("localhost", 8001),
            str,
            str,
            self.messageQueue2.put,
            "auth_token",
            None,
            "testcert.cert",
        )
        self.messageBus2.start()

        conn = self.messageBus1.connect(("localhost", 8001))
        self.messageBus1.sendMessage(conn, "msg_good")
        self.assertTrue(self.messageQueue1.get(timeout=TIMEOUT).OutgoingConnectionEstablished)

        self.assertTrue(self.messageQueue2.get(timeout=TIMEOUT).NewIncomingConnection)
        self.assertEqual(self.messageQueue2.get(timeout=TIMEOUT).message, "msg_good")

    def test_message_throttles(self):
        self.messageBus1.setMaxWriteQueueSize(1024 * 1024)

        # use a bytecount-limited queue for bus 2
        self.messageBus2.stop(timeout=TIMEOUT)
        self.messageQueue2 = BytecountLimitedQueue(len, 1024 ** 2)

        def onEvent(event):
            if event.matches.IncomingMessage:
                self.messageQueue2.put(event.message)

        self.messageBus2 = MessageBus(
            "bus2", ("localhost", 8001), str, str, onEvent, None, None, "testcert.cert"
        )
        self.messageBus2.start()

        conn1 = self.messageBus1.connect(("localhost", 8001))

        writeCount = [0]

        def writeThread():
            while writeCount[0] < 1000:
                self.messageBus1.sendMessage(conn1, " " * 1024 * 700)

                writeCount[0] += 1

        thread = threading.Thread(target=writeThread, daemon=True)
        thread.start()

        readCount = [0]

        while readCount[0] < 1000:
            time.sleep(0.001)
            self.messageQueue2.get(timeout=10)
            readCount[0] += 1

            # the actual buffer can vary from OS to OS because there is
            # variation on how much the TCP stack is willing to hold for us.
            self.assertLess(writeCount[0], readCount[0] + 25)

        thread.join()
