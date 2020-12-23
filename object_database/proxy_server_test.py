#   Copyright 2017-2020 object_database Authors
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
import threading
import os

from object_database.util import configureLogging, genToken
from object_database.messages import setHeartbeatInterval, getHeartbeatInterval
from object_database.persistence import InMemoryPersistence
from object_database.proxy_server import ProxyServer
from object_database.inmem_server import InMemServer, InMemoryChannel, DatabaseConnection
from object_database.database_test import Counter


class InmemProxyServer(ProxyServer):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)

        self.channels = []
        self.stopped = threading.Event()

    def tearDown(self):
        self._channelToMainServer.stop()

    def getChannel(self):
        channel = InMemoryChannel(self)
        channel.start()

        channel.markVerbose("Proxy", "View")

        self.addConnection(channel)
        self.channels.append(channel)

        return channel

    def connect(self):
        dbc = DatabaseConnection(self.getChannel())
        dbc.authenticate(self.authToken)
        dbc.initialized.wait(timeout=1)
        return dbc


class DatabaseProxyTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        configureLogging("proxy_test")
        cls.PERFORMANCE_FACTOR = 1.0 if os.environ.get("TRAVIS_CI", None) is None else 2.0

    def setUp(self):
        self.auth_token = genToken()

        self.mem_store = InMemoryPersistence()
        self.server = InMemServer(self.mem_store, self.auth_token)
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

    def createNewProxyServer(self):
        conn = self.server.getChannel()

        conn.markVerbose("Server", "Proxy")

        self.allChannels.append(conn)

        proxy = InmemProxyServer(conn, self.auth_token)
        proxy.authenticate()

        return proxy

    def createNewDb(self):
        conn = self.server.connect(self.auth_token)
        self.allConnections.append(conn)
        return conn

    def test_proxy_server_can_see_basic(self):
        db = self.createNewDb()
        db.subscribeToType(Counter, timeout=1.0)

        with db.transaction().withCommitTimeout(1.0):
            c = Counter()

        p = self.createNewProxyServer()

        db2 = p.connect()

        db2.subscribeToType(Counter, timeout=1.0)

        with db2.view():
            assert c.exists()
            assert Counter.lookupAll() == (c,)

        # connect another connection. This one won't require
        # another connection to the server.
        db3 = p.connect()

        db3.subscribeToType(Counter, timeout=1.0)

        with db3.view():
            assert c.exists()
            assert Counter.lookupAll() == (c,)

        # write through the main db view and verify the other view sees it
        with db.transaction().withCommitTimeout(1.0):
            c2 = Counter()

        db2.flush()
        with db2.view():
            assert c2.exists()
            assert Counter.lookupAll() == (c, c2)

        db3.flush()
        with db3.view():
            assert c2.exists()
            assert Counter.lookupAll() == (c, c2)

    def test_two_proxy_servers(self):
        self.createNewDb()

        p1 = self.createNewProxyServer()
        p2 = self.createNewProxyServer()

        db1 = p1.connect()
        db2 = p2.connect()

        db1.subscribeToType(Counter, timeout=1.0)
        db2.subscribeToType(Counter, timeout=1.0)

        with db1.transaction().withCommitTimeout(1.0):
            c = Counter()

        db2.flush()
        with db2.view():
            assert c.exists()

    def test_can_see_connection_to_proxy_servers(self):
        dbRoot = self.createNewDb()
        dbRoot.subscribeToType(type(dbRoot.connectionObject))

        p1 = self.createNewProxyServer()

        db1 = p1.connect()
        db2 = p1.connect()

        dbRoot.flush()

        with dbRoot.view():
            assert db1.connectionObject.exists()
            assert db2.connectionObject.exists()

        p1.tearDown()

        dbRoot.flush()

        with dbRoot.view():
            assert not db1.connectionObject.exists()
            assert not db2.connectionObject.exists()

    def test_stop_heartbeating(self):
        old_interval = getHeartbeatInterval()
        setHeartbeatInterval(0.1)

        try:
            dbRoot = self.createNewDb()
            dbRoot.subscribeToType(type(dbRoot.connectionObject))
            p1 = self.createNewProxyServer()

            db1 = p1.connect()

            dbRoot.flush()
            with dbRoot.view():
                assert db1.connectionObject.exists()

            db1Conn = db1.connectionObject
            db1._stopHeartbeating()

            for _ in range(10):
                p1.checkForDeadConnections()

            assert dbRoot.waitForCondition(lambda: not db1Conn.exists(), 1.0)

        finally:
            setHeartbeatInterval(old_interval)
