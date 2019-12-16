import pytest
from object_database import InMemServer
from object_database.util import genToken


@pytest.fixture
def odb_token():
    return genToken()


@pytest.fixture
def in_mem_server(odb_token):
    server = InMemServer(auth_token=odb_token)
    server.start()
    yield server
    server.stop()


@pytest.fixture
def in_mem_connection(odb_token, in_mem_server):
    conn = in_mem_server.connect(odb_token)
    return conn
