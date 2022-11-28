#   Copyright 2017-2021 object_database Authors
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
import tempfile

from object_database.util import genToken
from object_database.persistence import InMemoryPersistence
from object_database.inmem_server import InMemServer
from object_database.logging_transaction_watcher import LoggingTransactionWatcher
from object_database.schema import Schema


schema = Schema("test_schema")


@schema.define
class Object:
    k = int


class LoggingTransactionWatcherTest(unittest.TestCase):
    def setUp(self):
        self.auth_token = genToken()
        self.dir = tempfile.TemporaryDirectory()
        self.mem_store = InMemoryPersistence()
        self.handler = LoggingTransactionWatcher(self.dir.name)
        self.server = InMemServer(
            self.mem_store, self.auth_token, transactionWatcher=self.handler
        )
        self.server._gc_interval = 0.1
        self.server.start()

        self.allConnections = []
        self.allChannels = []

    def tearDown(self):
        for c in self.allConnections:
            c.disconnect(block=True)

        for c in self.allChannels:
            c.stop()

        self.server.stop()
        self.dir.cleanup()

    def createNewDb(self):
        conn = self.server.connect(self.auth_token)
        self.allConnections.append(conn)
        return conn

    def test_can_replay(self):
        db = self.createNewDb()

        db.subscribeToType(Object)

        with db.transaction():
            Object()

        self.handler.flush()

        count = [0]

        def handler(*args):
            count[0] += 1
            print(args)

        LoggingTransactionWatcher.replayEvents(self.dir.name, handler)

        assert count[0]

    def test_can_no_log(self):
        db = self.createNewDb()

        db.subscribeToType(Object)

        with db.transaction():
            Object()

        with db.transaction().noLog():
            Object.lookupOne().k = 10

        with db.transaction().noLog():
            Object()

        with db.transaction():
            Object.lookupOne().k = 20

        self.handler.flush()

        count = [0]

        def handler(*args):
            count[0] += 1
            print(args)

        LoggingTransactionWatcher.replayEvents(self.dir.name, handler)

        assert count[0] == 3  # one for connection, one for create, one for assign
