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

from object_database.database_connection import DatabaseConnection
from object_database._types import DatabaseConnectionPumpLoop
from object_database.server import Server
from object_database.proxy_server import ProxyServer
from object_database.message_bus import MessageBus
from object_database.messages import ClientToServer, ServerToClient, getHeartbeatInterval
from object_database.persistence import InMemoryPersistence

from .channel import ServerToClientChannel, ClientToServerChannel

from typed_python import serialize, deserialize
import logging
import ssl
import time
import threading
import socket
import atexit


class PumpLoopChannel(ClientToServerChannel):
    def __init__(self, SendT, RecvT, nativePumpLoop, socket, ssl, ssl_ctx):
        self._nativePumpLoop = nativePumpLoop
        self.SendT = SendT
        self.RecvT = RecvT
        self._socket = socket
        self._ssl = ssl
        self._ssl_context = ssl_ctx

        self._threads = [
            threading.Thread(target=self.writeLoop, daemon=True),
            threading.Thread(target=self.readLoop, daemon=True),
        ]

        self._nativePumpLoop.setHeartbeatMessage(
            serialize(ClientToServer, ClientToServer.Heartbeat()), getHeartbeatInterval()
        )

        self._lock = threading.Lock()
        self._messageHandler = None
        self._pendingMessages = []

        self._hasClosed = False
        self._onClosed = None

        atexit.register(self._atExit)

        for t in self._threads:
            t.start()

    def sendMessage(self, msg):
        self.write(msg)

    def setServerToClientHandler(self, handler):
        while True:
            messagesToProcess = []

            with self._lock:
                if self._pendingMessages:
                    messagesToProcess = self._pendingMessages
                    self._pendingMessages = []
                else:
                    assert self._messageHandler is None
                    self._messageHandler = handler
                    return

            for m in messagesToProcess:
                try:
                    handler(m)
                except Exception:
                    logging.exception("PumpLoopChannel callback threw unexpected exception")

    def setOnClosed(self, onClosed):
        with self._lock:
            if not self._hasClosed:
                self._onClosed = onClosed
                return

        # if we're here, we are already closed. Just trigger directly
        onClosed()

    def _stopHeartbeating(self):
        self._nativePumpLoop.setHeartbeatMessage(
            serialize(ClientToServer, ClientToServer.Heartbeat()), 0.0
        )

    def readLoop(self):
        try:
            self._nativePumpLoop.readLoop(self.onMessage)
        except Exception:
            logging.exception("PumpLoopChannel.readLoop had unexpected exception")

        with self._lock:
            self._hasClosed = True
            callback = self._onClosed

        pumpLoop = self._nativePumpLoop
        if pumpLoop is not None:
            pumpLoop.close()

        if callback is not None:
            callback()

    def writeLoop(self):
        try:
            self._nativePumpLoop.writeLoop()
        except Exception:
            logging.exception("PumpLoopChannel.writeLoop had unexpected exception")

        with self._lock:
            self._hasClosed = True
            callback = self._onClosed

        pumpLoop = self._nativePumpLoop
        if pumpLoop is not None:
            pumpLoop.close()

        if callback is not None:
            callback()

    def onMessage(self, msgBytes):
        try:
            msg = deserialize(self.RecvT, msgBytes)

            with self._lock:
                if self._messageHandler is not None:
                    handler = self._messageHandler
                else:
                    self._pendingMessages.append(msg)
                    return

            handler(msg)
        except Exception:
            logging.exception("PumpLoopChannel callback threw unexpected exception")

    def _atExit(self):
        self.close(True, needsRemove=False)

    def close(self, block=False, needsRemove=True):
        with self._lock:
            pumpLoop = self._nativePumpLoop

            self._nativePumpLoop = None

            if isinstance(pumpLoop, int):
                pumpLoop = None

            if pumpLoop is None:
                return

        pumpLoop.close()

        if block:
            for t in self._threads:
                t.join()

        self._threads = None
        self._ssl_context = None
        self._ssl = None
        self._socket = None

        if needsRemove:
            atexit.unregister(self._atExit)

    def write(self, msg):
        with self._lock:
            if self._nativePumpLoop is not None:
                pumpLoop = self._nativePumpLoop
            else:
                return

        pumpLoop.write(serialize(self.SendT, msg))


def _connectedChannel(host, port, auth_token, timeout=10.0, retry=False):
    t0 = time.time()

    # With CLIENT_AUTH we are setting up the SSL to use encryption only, which is what we want.
    # If we also wanted authentication, we would use SERVER_AUTH.
    ssl_ctx = ssl.create_default_context(ssl.Purpose.CLIENT_AUTH)

    nativePumpLoop = None
    while nativePumpLoop is None:
        try:
            sock = socket.create_connection((host, port))
            sock.setsockopt(socket.IPPROTO_TCP, socket.TCP_NODELAY, True)

            sock.setblocking(False)

            peername = sock.getpeername()
            sockname = sock.getsockname()

            ssock = ssl_ctx.wrap_socket(sock, do_handshake_on_connect=False)

            # different versions of python stash the SSL context object in
            # different places.
            if hasattr(ssock._sslobj, "_sslobj"):
                nativePumpLoop = DatabaseConnectionPumpLoop(ssock._sslobj._sslobj)
            else:
                nativePumpLoop = DatabaseConnectionPumpLoop(ssock._sslobj)
        except Exception:
            if not retry or time.time() - t0 > timeout * 0.8:
                raise
            time.sleep(min(timeout, max(timeout / 100.0, 0.01)))

    if nativePumpLoop is None:
        raise ConnectionRefusedError()

    connectionDict = dict(peername=peername, socket=sock, sockname=sockname)

    return (
        PumpLoopChannel(ClientToServer, ServerToClient, nativePumpLoop, sock, ssock, ssl_ctx),
        connectionDict,
    )


def connect(host, port, auth_token, timeout=10.0, retry=False):
    t0 = time.time()

    channel, connectionDict = _connectedChannel(host, port, auth_token, timeout, retry)

    conn = DatabaseConnection(channel, connectionDict)

    channel.setOnClosed(conn._onDisconnected)

    conn.authenticate(auth_token)

    conn.initialized.wait(timeout=max(timeout - (time.time() - t0), 0.0))

    assert conn.initialized.is_set()

    return conn


class ServerChannel(ServerToClientChannel):
    def __init__(self, bus, connectionId, source):
        self.bus = bus
        self.connectionId = connectionId
        self.source = source
        self.handler = None

    def write(self, msg):
        self.bus.sendMessage(self.connectionId, msg)

    def sendMessage(self, msg):
        self.bus.sendMessage(self.connectionId, msg)

    def setClientToServerHandler(self, handler):
        self.handler = handler

    def receive(self, message):
        assert self.handler
        self.handler(message)

    def close(self):
        self.bus.closeConnection(self.connectionId)


class TcpServer(Server):
    def __init__(self, host, port, mem_store, ssl_context, auth_token):
        Server.__init__(self, mem_store or InMemoryPersistence(), auth_token)
        self.host = host
        self.port = port
        self.mem_store = mem_store
        self.ssl_ctx = ssl_context
        self.bus = MessageBus(
            "odb_server",
            (host, port),
            ClientToServer,
            ServerToClient,
            self.onEvent,
            sslContext=ssl_context,
            extraMessageSizeCheck=False,
        )
        self._messageBusChannels = {}

        self.stopped = False

    def start(self):
        Server.start(self)
        self.bus.start()
        self.bus.scheduleCallback(self.checkHeartbeatsCallback, delay=getHeartbeatInterval())

    def checkHeartbeatsCallback(self):
        if not self.stopped:
            self.bus.scheduleCallback(
                self.checkHeartbeatsCallback, delay=getHeartbeatInterval()
            )

            try:
                self.checkForDeadConnections()
            except Exception:
                logging.exception("Caught exception in checkForDeadConnections:")

    def stop(self):
        Server.stop(self)
        self.bus.stop()

    def onEvent(self, event):
        if event.matches.NewIncomingConnection:
            channel = ServerChannel(self.bus, event.connectionId, event.source)

            self._messageBusChannels[event.connectionId] = channel

            self.addConnection(channel)

        if event.matches.IncomingConnectionClosed:
            id = event.connectionId
            if id in self._messageBusChannels:
                channel = self._messageBusChannels.pop(id)
                self.dropConnection(channel)

        if event.matches.IncomingMessage:
            id = event.connectionId
            if id in self._messageBusChannels:
                self._messageBusChannels[id].receive(event.message)

    def connect(self, auth_token):
        return connect(self.host, self.port, auth_token)

    def __enter__(self):
        self.start()
        return self

    def __exit__(self, t, v, traceback):
        self.stop()


class TcpProxyServer(ProxyServer):
    def __init__(self, upstreamHost, upstreamPort, ownHost, ownPort, ssl_context, auth_token):
        channel, _ = _connectedChannel(upstreamHost, upstreamPort, auth_token)

        channel.setOnClosed(self._onDisconnected)

        ProxyServer.__init__(self, channel, auth_token)
        self.authenticate()

        self.host = ownHost
        self.port = ownPort
        self.ssl_ctx = ssl_context
        self.bus = MessageBus(
            "odb_server",
            (ownHost, ownPort),
            ClientToServer,
            ServerToClient,
            self.onEvent,
            sslContext=ssl_context,
            extraMessageSizeCheck=False,
        )
        self._messageBusChannels = {}
        self.disconnected = threading.Event()
        self.stopped = False

    def _onDisconnected(self):
        self.disconnected.set()

    def start(self):
        self.bus.start()
        self.bus.scheduleCallback(self.checkHeartbeatsCallback, delay=getHeartbeatInterval())

    def checkHeartbeatsCallback(self):
        if not self.stopped:
            self.bus.scheduleCallback(
                self.checkHeartbeatsCallback, delay=getHeartbeatInterval()
            )

            try:
                self.checkForDeadConnections()
            except Exception:
                logging.exception("Caught exception in checkForDeadConnections:")

    def stop(self):
        self.bus.stop()

    def onEvent(self, event):
        if event.matches.NewIncomingConnection:
            channel = ServerChannel(self.bus, event.connectionId, event.source)

            self._messageBusChannels[event.connectionId] = channel

            self.addConnection(channel)

        if event.matches.IncomingConnectionClosed:
            id = event.connectionId
            if id in self._messageBusChannels:
                channel = self._messageBusChannels.pop(id)
                self.dropConnection(channel)

        if event.matches.IncomingMessage:
            id = event.connectionId
            if id in self._messageBusChannels:
                self._messageBusChannels[id].receive(event.message)

    def connect(self, auth_token):
        return connect(self.host, self.port, auth_token)

    def __enter__(self):
        self.start()
        return self

    def __exit__(self, t, v, traceback):
        self.stop()
