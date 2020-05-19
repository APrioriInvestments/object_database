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

import logging
import time
import argparse
import os
import sys
import gevent.socket
import gevent.queue
import json
import psutil
import queue
import resource
import threading
import socket
import gevent
import gevent.fileobject

from object_database.util import genToken, validateLogLevel
from object_database import ServiceBase, service_schema
from object_database.message_bus import MessageBus
from object_database.web.AuthPlugin import AuthPluginBase, LdapAuthPlugin
from object_database.web.LoginPlugin import LoginIpPlugin
from object_database.web.ActiveWebServiceSchema import active_webservice_schema

from object_database.web.ActiveWebService_util import (
    Configuration,
    LoginPlugin,
    makeMainView,
    displayAndHeadersForPathAndQueryArgs,
)

from object_database.web.cells import Subscribed, Cells, Card, Text, MAX_FPS, SessionState

from typed_python import OneOf, TupleOf
from typed_python.Codebase import Codebase as TypedPythonCodebase

from gevent import pywsgi, sleep
from gevent.greenlet import Greenlet
from geventwebsocket.handler import WebSocketHandler

from flask import Flask, jsonify, make_response, redirect, request, send_from_directory
from flask_sockets import Sockets
from flask_cors import CORS
from flask_login import LoginManager, current_user, login_required


class GeventPipe:
    """A simple mechanism for triggering the gevent webserver from a thread other than
    the webserver thread. Gevent itself expects everything to happen on greenlets. The
    database connection in the background is not based on gevent, so we cannot use any
    standard gevent-based event or queue objects from the db-trigger thread.
    """

    def __init__(self):
        self.read_fd, self.write_fd = os.pipe()
        self.fileobj = gevent.fileobject.FileObjectPosix(self.read_fd, bufsize=2)
        self.netChange = 0

    def wait(self):
        self.fileobj.read(1)
        self.netChange -= 1

    def trigger(self):
        # it's OK that we don't check if the bytes are written because we're just
        # trying to wake up the other side. If the operating system's buffer is full,
        # then that means the other side hasn't been clearing the bytes anyways,
        # and that it will come back around and read our data.
        if self.netChange > 2:
            return

        self.netChange += 1
        os.write(self.write_fd, b"\n")


class DISCONNECT:
    pass


MAX_PROCESS_MEMORY_HARD_LIMIT = 8 * 1024 ** 3


class ActiveWebService(ServiceBase):
    """
    See object_database.frontends.object_database_webtest.py for example
    useage.
    """

    def __init__(self, db, serviceObject, serviceRuntimeConfig):
        ServiceBase.__init__(self, db, serviceObject, serviceRuntimeConfig)
        self._logger = logging.getLogger(__name__)

    @staticmethod
    def configure(db, serviceObject, hostname, port, internal_port, level_name="INFO"):
        db.subscribeToType(Configuration)

        with db.transaction():
            c = Configuration.lookupAny(service=serviceObject)
            if not c:
                c = Configuration(service=serviceObject)

            c.hostname = hostname
            c.port = port
            c.internal_port = port
            c.log_level = logging.getLevelName(level_name)

    @staticmethod
    def setLoginPlugin(
        db, serviceObject, loginPluginFactory, authPlugins, codebase=None, config=None
    ):
        db.subscribeToType(Configuration)
        db.subscribeToType(LoginPlugin)

        config = config or {}

        with db.transaction():
            c = Configuration.lookupAny(service=serviceObject)
            if not c:
                c = Configuration(service=serviceObject)
            login_plugin = LoginPlugin(
                name="an auth plugin",
                login_plugin_factory=loginPluginFactory,
                auth_plugins=TupleOf(OneOf(None, AuthPluginBase))(authPlugins),
                codebase=codebase,
                config=config,
            )
            c.login_plugin = login_plugin

    @staticmethod
    def configureFromCommandline(db, serviceObject, args):
        """
            Subclasses should take the remaining args from the commandline and
            configure using them.
        """
        db.subscribeToType(Configuration)

        parser = argparse.ArgumentParser("Configure a webservice")
        parser.add_argument("--hostname", type=str)
        parser.add_argument("--port", type=int)
        parser.add_argument("--internal-port", type=int)
        # optional arguments
        parser.add_argument("--log-level", type=str, required=False, default="INFO")

        parser.add_argument("--ldap-hostname", type=str, required=False)
        parser.add_argument("--ldap-base-dn", type=str, required=False)
        parser.add_argument("--ldap-ntlm-domain", type=str, required=False)
        parser.add_argument("--authorized-groups", type=str, required=False, nargs="+")
        parser.add_argument("--company-name", type=str, required=False)

        parsedArgs = parser.parse_args(args)

        with db.transaction():
            c = Configuration.lookupAny(service=serviceObject)
            if not c:
                c = Configuration(service=serviceObject)

            level_name = parsedArgs.log_level.upper()
            level_name = validateLogLevel(level_name, fallback="INFO")

            c.port = parsedArgs.port
            c.internal_port = parsedArgs.internal_port
            c.hostname = parsedArgs.hostname

            c.log_level = logging.getLevelName(level_name)

        if parsedArgs.ldap_base_dn is not None:
            ActiveWebService.setLoginPlugin(
                db,
                serviceObject,
                LoginIpPlugin,
                [
                    LdapAuthPlugin(
                        parsedArgs.ldap_hostname,
                        parsedArgs.ldap_base_dn,
                        parsedArgs.ldap_ntlm_domain,
                        parsedArgs.authorized_groups,
                    )
                ],
                config={"company_name": parsedArgs.company_name},
            )

    def initialize(self):
        # dict from session id (cookie really) to a a list of
        # [cells.SessionState]
        self.sessionStates = {}

        self.db.subscribeToType(Configuration)
        self.db.subscribeToType(LoginPlugin)
        self.db.subscribeToSchema(service_schema)
        self.db.subscribeToSchema(active_webservice_schema)

        with self.db.transaction():
            self.app = Flask(__name__)
            CORS(self.app)
            self.sockets = Sockets(self.app)
            self.configureApp()
        self.login_manager = LoginManager(self.app)
        self.login_manager.login_view = "login"

    def doWork(self, shouldStop):
        resource.setrlimit(resource.RLIMIT_AS, (MAX_PROCESS_MEMORY_HARD_LIMIT, -1))

        self.memoryUsageMonitorThread = threading.Thread(target=self.monitorMemoryUsage)
        self.memoryUsageMonitorThread.daemon = True
        self.memoryUsageMonitorThread.start()

        with self.db.view():
            session = active_webservice_schema.Session.lookupAny(
                executingInstance=self.runtimeConfig.serviceInstance
            )

        self._logger.info(
            "ActiveWebService initializing as %s", "main" if session is None else "child"
        )

        if session is not None:
            self.serviceSingleSession(session)
        else:
            self.serviceWebsocketLoop()

    def serviceWebsocketLoop(self):
        self._logger.info("Configuring ActiveWebService")

        with self.db.view() as view:
            config = Configuration.lookupAny(service=self.serviceObject)
            assert config, "No configuration available."
            self._logger.setLevel(config.log_level)
            host, port = config.hostname, config.port

            login_config = config.login_plugin

            codebase = login_config.codebase
            if codebase is None:
                ser_ctx = TypedPythonCodebase.coreSerializationContext()
            else:
                ser_ctx = codebase.instantiate().serializationContext
            view.setSerializationContext(ser_ctx)

            self.login_plugin = login_config.login_plugin_factory(
                self.db, login_config.auth_plugins, login_config.config
            )

            # register `load_user` method with login_manager
            self.login_plugin.load_user = self.login_manager.user_loader(
                self.login_plugin.load_user
            )

            self.authorized_groups_text = self.login_plugin.authorized_groups_text

            self.login_plugin.init_app(self.app)

        self._logger.info("ActiveWebService listening on %s:%s", host, port)

        server = pywsgi.WSGIServer((host, port), self.app, handler_class=WebSocketHandler)

        server.serve_forever()

    def monitorMemoryUsage(self):
        while True:
            time.sleep(1.0)
            if psutil.Process().memory_info().rss > MAX_PROCESS_MEMORY_HARD_LIMIT:
                logging.error("Exiting because memory usage is too high.")
                sys.stdout.flush()
                sys.stderr.flush()
                os._exit(0)

    def configureApp(self):
        self.app.config["SECRET_KEY"] = os.environ.get("SECRET_KEY") or genToken()

        self.app.add_url_rule("/", endpoint="index", view_func=lambda: redirect("/services"))
        self.app.add_url_rule(
            "/content/<path:path>", endpoint=None, view_func=self.sendContent
        )
        self.app.add_url_rule("/services", endpoint=None, view_func=self.sendPage)
        self.app.add_url_rule("/services/<path:path>", endpoint=None, view_func=self.sendPage)
        self.app.add_url_rule("/status", view_func=self.statusPage)
        self.sockets.add_url_rule("/socket/<path:path>", None, self.mainSocket)

    def statusPage(self):
        return make_response(jsonify("STATUS: service is up"))

    @login_required
    def sendPage(self, path=None):
        self._logger.info("Sending 'page.html'")
        return self.sendContent("page.html")

    @login_required
    def mainSocket(self, ws, path):
        self._logger.info(
            "ActiveWebService new incoming connection for user %s", current_user.username
        )

        ws.stream.handler.socket.setsockopt(socket.IPPROTO_TCP, socket.TCP_NODELAY, True)

        # a websocket just connected to us. Boot another copy of the process
        # that will actually run the connection
        with self.db.transaction():
            childInstance = self.runtimeConfig.serviceInstance.spawnChild()

            assert childInstance is not None

            session = active_webservice_schema.Session(
                executingInstance=childInstance,
                path=str(path),
                queryArgs=dict(request.args.items()),
                sessionId=request.cookies.get("session"),
                user=current_user.username,
                authorized_groups_text=self.authorized_groups_text,
            )

        if not self.db.waitForCondition(lambda: session.listening_port is not None, 5.0):
            # the session couldn't connect. just close it an exit.
            self._logger.error("Failed to connect to our backend instance %s", childInstance)
            ws.close()
            return

        with self.db.view():
            otherPort = session.listening_port

        toSendUpToWs = queue.Queue()
        hasWsMessage = GeventPipe()

        def onEvent(event):
            if event.matches.IncomingMessage:
                toSendUpToWs.put(event.message)
                hasWsMessage.trigger()

            if (
                event.matches.OutgoingConnectionFailed
                or event.matches.OutgoingConnectionClosed
            ):
                toSendUpToWs.put(DISCONNECT)
                hasWsMessage.trigger()

        # connect to the other service
        messageBus = MessageBus(
            busIdentity="bus_" + str(session._identity),
            endpoint=None,
            inMessageType=str,
            outMessageType=str,
            onEvent=onEvent,
            authToken=self.runtimeConfig.authToken,
        )
        messageBus.start()

        connId = messageBus.connect(("localhost", otherPort))

        def readThread():
            while not ws.closed:
                res = ws.receive()
                if res is None:
                    ws.close()
                    toSendUpToWs.put(DISCONNECT)
                    hasWsMessage.trigger()
                    return
                else:
                    messageBus.sendMessage(connId, res)

        def writeThread():
            while not ws.closed:
                try:
                    toSend = toSendUpToWs.get(block=False)
                except queue.Empty:
                    toSend = None

                if toSend is DISCONNECT:
                    ws.close()

                if toSend is None:
                    hasWsMessage.wait()
                else:
                    ws.send(toSend)

        readGreenlet = Greenlet.spawn(readThread)
        writeGreenlet = Greenlet.spawn(writeThread)

        readGreenlet.join()
        writeGreenlet.join()
        messageBus.stop()

        with self.db.transaction():
            childInstance.triggerShutdown()

    def serviceSingleSession(self, session: active_webservice_schema.Session):
        """We are servicing a single host."""

        inMessage = queue.Queue()
        connectionQueue = queue.Queue()

        def onEvent(event):
            if event.matches.NewIncomingConnection:
                connectionQueue.put(event.connectionId)

            if event.matches.IncomingMessage:
                inMessage.put(event.message)

            if event.matches.IncomingConnectionClosed:
                session.stop()

        messageBus = MessageBus(
            busIdentity="bus",
            endpoint=("localhost", 0),
            inMessageType=str,
            outMessageType=str,
            onEvent=onEvent,
            authToken=self.runtimeConfig.authToken,
        )
        messageBus.start()

        try:
            # tell the main server who we are
            with self.db.transaction():
                session.listening_port = messageBus.listeningEndpoint.port

            try:
                conn = connectionQueue.get(timeout=10.0)
            except queue.Empty:
                self._logger.error(
                    "ActiveWebService single session booted but never got a connection"
                )

            with self.db.view():
                path = session.path.split("/")
                queryArgs = session.queryArgs
                sessionId = session.sessionId
                currentUser = session.user
                authorized_groups_text = session.authorized_groups_text

            session = CellsSession(
                self.db,
                inMessage,
                lambda msg: messageBus.sendMessage(conn, msg),
                path,
                queryArgs,
                sessionId,
                currentUser,
                authorized_groups_text,
            )

            session.run()
        finally:
            messageBus.stop()

    @login_required
    def echoSocket(self, ws):
        while not ws.closed:
            message = ws.receive()
            if message is not None:
                ws.send(message)

    @login_required
    def sendContent(self, path):
        own_dir = os.path.dirname(__file__)
        return send_from_directory(os.path.join(own_dir, "content"), path)

    @staticmethod
    def serviceDisplay(serviceObject, instance=None, objType=None, queryArgs=None):
        c = Configuration.lookupAny(service=serviceObject)

        return Card(Text("Host: " + c.hostname) + Text("Port: " + str(c.port)))


class CellsSession:
    def __init__(
        self,
        db,
        inboundMessageQueue,
        sendMessage,
        path,
        queryArgs,
        sessionId,
        currentUser,
        authorized_groups_text,
    ):
        self.inboundMessageQueue = inboundMessageQueue
        self._logger = logging.getLogger(__name__)
        self.sendMessage = sendMessage
        self.db = db
        self.path = path
        self.queryArgs = queryArgs
        self.sessionId = sessionId
        self.currentUser = currentUser
        self.authorized_groups_text = authorized_groups_text
        self.shouldStop = threading.Event()

        self.lastDumpTimestamp = time.time()
        self.lastDumpMessages = 0
        self.lastDumpFrames = 0
        self.lastDumpTimeSpentCalculating = 0.0
        self.frameTimestamps = []

        self.sessionState = SessionState()

        self.cells = Cells(self.db).withRoot(
            Subscribed(lambda: self.displayForPathAndQueryArgs(path, queryArgs)),
            serialization_context=self.db.serializationContext,
            session_state=self.sessionState,
        )

        self.largeMessageAck = queue.Queue()

        self.readThread = None

    def readThreadLoop(self):
        while not self.shouldStop.is_set():
            msg = self.inboundMessageQueue.get()

            if msg is DISCONNECT:
                self.largeMessageAck.put(DISCONNECT)
                return

            try:
                jsonMsg = json.loads(msg)

                if "ACK" in jsonMsg:
                    self.largeMessageAck.put(jsonMsg["ACK"])
                else:
                    cell_id = jsonMsg.get("target_cell")
                    cell = self.cells[cell_id]

                    if cell is not None:
                        cell.onMessageWithTransaction(jsonMsg)
            except Exception:
                self._logger.exception("Exception in inbound message:")

            self.cells.triggerIfHasDirty()

        self.largeMessageAck.put(DISCONNECT)

    def writeJsonMessage(self, message):
        """Send a message over the websocket.

        We chunk it into small frames of 32 kb apiece to keep the browser
        from getting overloaded.
        """
        FRAME_SIZE = 32 * 1024
        FRAMES_PER_ACK = 10

        msg = json.dumps(message)

        # split msg into small frames
        frames = []
        i = 0
        while i < len(msg):
            frames.append(msg[i : i + FRAME_SIZE])
            i += FRAME_SIZE

        if len(frames) >= FRAMES_PER_ACK:
            self._logger.info(
                "Sending large message of %s bytes over %s frames", len(msg), len(frames)
            )

        self.sendMessage(json.dumps(len(frames)))

        for index, frame in enumerate(frames):
            self.sendMessage(frame)

            # block until we get the ack for FRAMES_PER_ACK frames ago. That
            # way we always have FRAMES_PER_ACK frames in the buffer.
            framesSent = index + 1
            if framesSent % FRAMES_PER_ACK == 0 and framesSent > FRAMES_PER_ACK:
                ack = self.largeMessageAck.get()

                if ack is DISCONNECT:
                    return 0
                else:
                    assert ack == framesSent - FRAMES_PER_ACK, (
                        ack,
                        framesSent - FRAMES_PER_ACK,
                    )

        framesSent = len(frames)

        if framesSent >= FRAMES_PER_ACK:
            finalAckIx = framesSent - (framesSent % FRAMES_PER_ACK)

            ack = self.largeMessageAck.get()

            if ack is DISCONNECT:
                return 0
            else:
                assert ack == finalAckIx, (ack, finalAckIx)

        return len(message)

    def onFrame(self):
        """Notice that we ticked a frame, log, and throttle so we don't jam the browser."""
        self.lastDumpFrames += 1

        # log slow messages
        if time.time() - self.lastDumpTimestamp > 60.0:
            self._logger.info(
                "In the last %.2f seconds, spent %.2f seconds"
                " calculating %s messages over %s frames",
                time.time() - self.lastDumpTimestamp,
                self.lastDumpTimeSpentCalculating,
                self.lastDumpMessages,
                self.lastDumpFrames,
            )

            self.lastDumpFrames = 0
            self.lastDumpMessages = 0
            self.lastDumpTimeSpentCalculating = 0
            self.lastDumpTimestamp = time.time()

        self.frameTimestamps.append(time.time())

        if len(self.frameTimestamps) > MAX_FPS:
            self.frameTimestamps = self.frameTimestamps[-MAX_FPS + 1 :]

            if time.time() - self.frameTimestamps[0] < 1.0:
                maxTime = time.time() + 1.0 / MAX_FPS + 0.001

                while time.time() < maxTime:
                    sleep(0.01)

                    if self.shouldStop.is_set():
                        return

    def run(self):
        self.readThread = threading.Thread(target=self.readThreadLoop)
        self.readThread.start()

        try:
            while not self.shouldStop.is_set():
                t0 = time.time()
                messages = self.cells.renderMessages()
                self.lastDumpTimeSpentCalculating += time.time() - t0

                if messages:
                    bytesSent = 0

                    for message in messages:
                        bytesSent += self.writeJsonMessage(message)

                        self.lastDumpMessages += 1

                    if bytesSent > 100 * 1024:
                        self._logger.info(
                            "Sent a large message packet of %.2f mb", bytesSent / 1024.0 ** 2
                        )

                    # tell the browser to execute the postscripts that its built up
                    self.writeJsonMessage("postscripts")

                    # request an ACK from the browser before sending any more data
                    # otherwise it can get overloaded and crash because it can't
                    # keep up with the data volume
                    self.writeJsonMessage("request_ack")

                    ack = self.largeMessageAck.get()

                    if ack is DISCONNECT:
                        return

                    self.onFrame()

                self.cells.wait()

        except Exception:
            self._logger.exception("Websocket handler error:")

        finally:
            self.shouldStop.set()
            self.inboundMessageQueue.put(DISCONNECT)

            self.readThread.join()
            self.cells.cleanupCells()

    def displayForPathAndQueryArgs(self, path, queryArgs):
        display, toggles = displayAndHeadersForPathAndQueryArgs(path, queryArgs)
        return makeMainView(display, toggles, self.currentUser, self.authorized_groups_text)

    def stop(self):
        self.shouldStop.set()
        self.inboundMessageQueue.put(DISCONNECT)
        self.largeMessageAck.put(DISCONNECT)
