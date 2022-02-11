import pytest
import socket

from .socket_watcher import SocketWatcher


@pytest.fixture
def listeningSocket():
    sock = socket.socket(socket.AF_INET, socket.SOCK_STREAM, 0)
    sock.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)

    try:
        sock.bind(("localhost", 0))
        sock.listen(2048)
        sock.setsockopt(socket.IPPROTO_TCP, socket.TCP_NODELAY, True)

        yield sock

    except OSError:
        sock.close()
        raise


def connect(listeningSocket):
    listeningPort = listeningSocket.getsockname()[1]

    clientSocket = socket.create_connection(("localhost", listeningPort))

    serverSocket, socketSource = listeningSocket.accept()
    serverSocket.setsockopt(socket.IPPROTO_TCP, socket.TCP_NODELAY, True)
    serverSocket.setblocking(False)

    return clientSocket, serverSocket


def test_basic(listeningSocket):
    sw = SocketWatcher()

    assert len(sw) == 0
    readReady, writeReady = sw.poll(0.1)
    assert len(readReady) == 0
    assert len(writeReady) == 0

    cs, ss = connect(listeningSocket)

    assert cs not in sw
    assert not sw.canRead(cs)
    assert not sw.canWrite(cs)
    assert not sw.discardForRead(cs)
    assert not sw.discardForWrite(cs)

    assert sw.addForRead(cs)

    assert len(sw) == 1
    assert cs in sw
    assert ss not in sw
    assert sw.canRead(cs)
    assert not sw.canWrite(cs)

    readReady, writeReady = sw.poll(0.01)
    assert len(readReady) == 0
    assert len(writeReady) == 0

    msg = b"asdf"
    ss.send(msg)
    readReady, writeReady = sw.poll(0.01)
    assert len(readReady) == 1
    assert len(writeReady) == 0
    rs = readReady.pop()
    assert rs == cs
    assert rs.recv(1024) == msg

    assert not sw.discardForWrite(cs)
    assert cs in sw
    assert sw.canRead(cs)
    assert not sw.canWrite(cs)

    assert sw.addForWrite(cs)

    assert len(sw) == 1
    assert sw.canRead(cs)
    assert sw.canWrite(cs)

    readReady, writeReady = sw.poll(0.01)

    assert len(readReady) == 0
    assert len(writeReady) == 1
    assert writeReady.pop() == cs

    assert sw.discardForRead(cs)

    assert len(sw) == 1
    assert not sw.canRead(cs)
    assert sw.canWrite(cs)

    assert sw.discardForWrite(cs)

    assert len(sw) == 0

    sw.teardown()


def test_add_discard_with_closed_socket(listeningSocket):
    sw = SocketWatcher()

    cs, ss = connect(listeningSocket)

    assert sw.addForRead(cs)
    assert len(sw) == 1

    cs.close()

    # adding a closed socket causes it to be removed from SocketWatcher
    assert cs in sw
    assert not sw.addForWrite(cs)
    assert cs not in sw
    assert len(sw) == 0

    # adding a closed socket has not effect
    assert not sw.addForRead(cs)
    assert cs not in sw
    assert len(sw) == 0

    # gc removes closed sockets but not others.
    cs, ss = connect(listeningSocket)

    assert sw.addForWrite(cs)
    assert sw.addForWrite(ss)
    assert cs in sw
    assert ss in sw
    cs.close()
    sw.gc()
    assert cs not in sw
    assert ss in sw

    # discarding from a closed socket causes it to be removed from SocketWatcher
    cs, ss = connect(listeningSocket)

    assert sw.addForWrite(cs)
    cs.close()
    assert cs in sw
    assert sw.discardForRead(cs)
    assert cs not in sw


def test_poll_with_closed_socket(listeningSocket):
    sw = SocketWatcher()

    cs, ss = connect(listeningSocket)

    assert sw.addForWrite(cs)
    assert cs in sw

    readReady, writeReady = sw.poll(0.1)
    assert len(readReady) == 0
    assert len(writeReady) == 1

    cs.close()
    readReady, writeReady = sw.poll(0.1)
    assert len(readReady) == 0
    assert len(writeReady) == 0
    assert len(sw) == 1

    sw.gc()
    assert len(sw) == 0
