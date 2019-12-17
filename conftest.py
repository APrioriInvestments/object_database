import ssl
import pytest
from pytest_lazyfixture import lazy_fixture

from object_database.RedisTestHelper import RedisTestHelper
from object_database.persistence import InMemoryPersistence, RedisPersistence
from object_database import InMemServer
from object_database.tcp_server import TcpServer
from object_database.util import genToken


@pytest.fixture
def odb_token():
    """ Returns an authentication token for the ODB. """
    return genToken()


@pytest.fixture
def in_mem_odb_server(odb_token):
    """ Returns an in-memory ODB server. """
    server = InMemServer(auth_token=odb_token)
    server.start()
    yield server
    server.stop()


@pytest.fixture
def in_mem_odb_connection(odb_token, in_mem_odb_server):
    """ Returns a connection to the in-memory ODB server. """
    conn = in_mem_odb_server.connect(odb_token)
    yield conn
    conn.disconnect(block=True)


@pytest.fixture
def redis_process_port():
    """ Creates a Redis process and returns its port. """
    redisProcess = RedisTestHelper(port=1115)
    yield 1115
    redisProcess.tearDown()


@pytest.fixture
def redis_odb_server(odb_token, redis_process_port):
    """ Returns an ODB server with a Redis backend. """
    mem_store = RedisPersistence(port=redis_process_port)
    server = InMemServer(mem_store, odb_token)
    server.start()
    yield server
    server.stop()


@pytest.fixture
def redis_odb_connection(odb_token, redis_odb_server):
    """ Returns a connection to the Redis-backed ODB server. """
    conn = redis_odb_server.connect(odb_token)
    yield conn
    conn.disconnect()


@pytest.fixture
def tcp_odb_server(odb_token):
    """ Returns an ODB server over TCP. """
    sc = ssl.create_default_context(ssl.Purpose.CLIENT_AUTH)
    sc.load_cert_chain("testcert.cert", "testcert.key")

    server = TcpServer(
        host="localhost",
        port=8888,
        mem_store=InMemoryPersistence(),
        ssl_context=sc,
        auth_token=odb_token,
    )
    server._gc_interval = 0.1
    server.start()
    yield server
    server.stop()


@pytest.fixture
def tcp_odb_connection(odb_token, tcp_odb_server):
    """ Returns a connection to the TCP ODB server. """
    conn = tcp_odb_server.connect(odb_token, useSecondaryLoop=False)
    conn.initialized.wait()
    yield conn
    conn.disconnect()


@pytest.fixture(
    params=[
        lazy_fixture("in_mem_odb_connection"),
        lazy_fixture("redis_odb_connection"),
        lazy_fixture("tcp_odb_connection"),
    ]
)
def db(request):
    """ Returns an ODB connection (one of multiple kinds). """
    connection = request.param
    return connection
