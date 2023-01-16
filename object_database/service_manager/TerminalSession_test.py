#   Copyright 2017-2023 object_database Authors
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

from object_database.schema import Indexed, Schema
from object_database.inmem_server import InMemServer
from object_database.persistence import InMemoryPersistence

from object_database.service_manager.TerminalSession import service_schema
from object_database.service_manager.TerminalSession import terminal_schema

class TerminalSessionTest(unittest.TestCase):
    def setUp(self):
        self.token = "auth"
        self.mem_store = InMemoryPersistence()
        self.server = InMemServer(self.mem_store, self.token)
        self.server.start()

    def createNewDb(self):
        db = self.server.connect(self.token)
        db.subscribeToSchema(service_schema)
        db.subscribeToSchema(terminal_schema)
        return db

    def tearDown(self):
        self.server.stop()

    def test_push_to_terminal(self):
        db = self.createNewDb()

        with db.transaction():
            session = service_schema.TerminalSession()
            state = terminal_schema.TerminalState(session=session)
            state.maxBytesToKeep = 1024 * 16
            state.maxBlockSize = 1024

        totalBuffer = [""]
        def write(x):
            totalBuffer[0] += x
            state.writeDataFromSubprocessIntoBuffer(x)

        with db.transaction():
            for lineIx in range(10000):
                write(f"{lineIx}\n")

                # make sure we keep enough bytes around
                assert state.topByteIx == len(totalBuffer[0])
                assert state.bottomByteIx <= max(0, state.topByteIx - state.maxBytesToKeep + state.maxBlockSize * 2)

                # and that if we request them we get what we expect
                readFrom = state.bottomByteIx
                assert state.readBytesFrom(readFrom)[0] == totalBuffer[0][readFrom:]
                assert state.topByteIx - state.bottomByteIx <= state.maxBytesToKeep
                assert len(state.readBytesFrom(0)[0]) == state.topByteIx - state.bottomByteIx
