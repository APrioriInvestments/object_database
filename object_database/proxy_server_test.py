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

import pytest
import unittest
import os

from object_database.util import configureLogging, genToken
from object_database.messages import setHeartbeatInterval, getHeartbeatInterval
from object_database.persistence import InMemoryPersistence
from object_database.inmem_proxy_server import InMemProxyServer
from object_database.inmem_server import InMemServer
from object_database.database_test import Counter, ObjectDatabaseTests


class ExecuteOdbTestsOnProxyServer(unittest.TestCase, ObjectDatabaseTests):
    # set to True to get printouts on every message being sent
    VERBOSE = False
    USE_SINGLE_PROXY = False

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
        self.allProxies = []

    def tearDown(self):
        for c in self.allConnections:
            c.disconnect(block=True)

        for c in self.allChannels:
            c.stop()

        for p in self.allProxies:
            p.tearDown()

        self.server.stop()

    def createNewProxyServer(self):
        conn = self.server.getChannel()

        self.allChannels.append(conn)

        proxy = InMemProxyServer(conn, self.auth_token, verbose=self.VERBOSE)
        self.allProxies.append(proxy)

        if self.VERBOSE:
            conn.markVerbose("Server", f"Proxy({id(proxy)})")

        proxy.authenticate()

        return proxy

    def createNewDb(self, forceNotProxy=False):
        if forceNotProxy:
            return self.server.connect(self.auth_token)

        if self.allProxies and self.USE_SINGLE_PROXY:
            return self.allProxies[0].connect()

        return self.createNewProxyServer().connect()

    # these tests don't make sense with the proxy since the proxy itself doesn't
    # have a lazy load trigger
    def test_lazy_subscriptions_read(self):
        pass

    def test_lazy_subscriptions_write(self):
        pass

    def test_lazy_subscriptions_exists(self):
        pass

    def test_lazy_subscriptions_delete(self):
        pass

    def test_max_tid(self):
        pass


class ExecuteOdbTestsOnSingleProxyServer(ExecuteOdbTestsOnProxyServer):
    USE_SINGLE_PROXY = True

    @pytest.mark.skip(reason="single proxy server doesnt have subscribe callback")
    def test_adding_while_subscribing_and_moving_into_index(self):
        pass

    @pytest.mark.skip(reason="single proxy server doesnt have subscribe callback")
    def test_adding_while_subscribing(self):
        pass

    @pytest.mark.skip(reason="single proxy server doesnt have subscribe callback")
    def test_adding_while_subscribing_to_index(self):
        pass

    @pytest.mark.skip(
        reason="test has dependency on specifics of tids "
        "that are not maintained in this setup"
    )
    def test_object_versions_robust(self):
        pass


class ProxyServerTestsDirect(unittest.TestCase):
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
        self.allProxies = []

    def tearDown(self):
        for c in self.allConnections:
            c.disconnect(block=True)

        for c in self.allChannels:
            c.stop()

        for p in self.allProxies:
            p.tearDown()

        self.server.stop()

    def createNewProxyServer(self):
        conn = self.server.getChannel()
        conn.markVerbose("Server", "Proxy")

        self.allChannels.append(conn)

        proxy = InMemProxyServer(conn, self.auth_token, verbose=True)
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

        assert dbRoot.waitForCondition(lambda: not db1.connectionObject.exists(), 1.0)
        assert dbRoot.waitForCondition(lambda: not db2.connectionObject.exists(), 1.0)

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

            assert dbRoot.waitForCondition(lambda: not db1Conn.exists(), 1.0)

        finally:
            setHeartbeatInterval(old_interval)

    def test_subscribe_to_index_basic(self):
        dbRoot = self.createNewDb()
        dbRoot.subscribeToType(Counter)

        with dbRoot.transaction():
            c10 = Counter(k=10)
            c9 = Counter(k=9)

        p1 = self.createNewProxyServer()
        db1 = p1.connect()
        db1.subscribeToIndex(Counter, k=10, timeout=1.0)

        db1.flush()

        with db1.view():
            assert Counter.lookupAll() == (c10,)
            assert Counter.lookupAll(k=10) == (c10,)
            assert not c9.exists()

        # verify we see writes
        with dbRoot.transaction():
            c10.x = 123

        assert db1.waitForCondition(lambda: c10.x == 123, timeout=1.0)

    def test_move_object_into_index(self):
        dbRoot = self.createNewDb()
        dbRoot.subscribeToType(Counter)

        with dbRoot.transaction():
            c = Counter(k=9)

        p1 = self.createNewProxyServer()
        db1 = p1.connect()
        db1.subscribeToIndex(Counter, k=10, timeout=1.0)

        db1.flush(timeout=1)

        with db1.view():
            assert Counter.lookupAll() == ()
            assert Counter.lookupAll(k=10) == ()
            assert not c.exists()

        with dbRoot.transaction():
            c.k = 10

        db1.flush(timeout=1)

        with db1.view():
            assert Counter.lookupAll() == (c,)
            assert Counter.lookupAll(k=10) == (c,)
            assert c.exists()

    def test_subscribed_to_our_own_creations(self):
        dbRoot = self.createNewDb()
        dbRoot.subscribeToType(Counter)

        p1 = self.createNewProxyServer()
        db1 = p1.connect()
        db1.subscribeToNone(Counter)

        with db1.transaction():
            c = Counter(k=0, x=0)

        assert dbRoot.waitForCondition(lambda: c.exists(), 1.0)

        with dbRoot.transaction():
            c.x = 10

        assert db1.waitForCondition(lambda: c.exists(), 1.0)

    def test_subscribe_lazy(self):
        dbRoot = self.createNewDb()
        dbRoot.subscribeToType(Counter)

        with dbRoot.transaction():
            c1 = Counter(k=1)

        p1 = self.createNewProxyServer()
        db1 = p1.connect()
        db1.subscribeToType(Counter, lazySubscription=True)

        with db1.transaction():
            assert c1.exists()
            assert c1.k == 1

        with dbRoot.transaction():
            c1.k = 2

        db1.flush()
        with db1.transaction():
            assert c1.k == 2

    def test_commit_in_one_proxy_read_another(self):
        p1 = self.createNewProxyServer()
        p2 = self.createNewProxyServer()

        db1 = p1.connect()
        db2 = p2.connect()

        db1.subscribeToNone(Counter)
        db2.subscribeToType(Counter)

        with db1.transaction():
            c = Counter()

        db2.flush()

        with db2.view():
            assert c.exists()

    def test_commit_a_lot_in_one_proxy_read_another(self):
        p1 = self.createNewProxyServer()
        p2 = self.createNewProxyServer()

        db1 = p1.connect()
        db2 = p2.connect()

        db1.subscribeToType(Counter)
        db2.subscribeToType(Counter)

        with db1.transaction():
            for _ in range(10000):
                Counter(k=123, x=1)
            Counter()

        db2.flush()

        with db2.view():
            assert len(Counter.lookupAll()) == 10001
