#   Copyright 2019-2020 Object Database Authors
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

from object_database.web.ActiveWebService_util import Configuration, LoginPlugin

from object_database.web.cells import Card, Text

from typed_python import OneOf, TupleOf

from gevent import pywsgi
from gevent.greenlet import Greenlet
from geventwebsocket.handler import WebSocketHandler

from flask import Flask, jsonify, make_response, redirect, request, send_from_directory
from flask_sockets import Sockets
from flask_cors import CORS
from flask_login import LoginManager, current_user, login_required

from object_database.web.CellsSession import CellsSession, DISCONNECT


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


MAX_PROCESS_MEMORY_HARD_LIMIT = 8 * 1024 ** 3


class ActiveWebService(ServiceBase):
    """
    See object_database.frontends.object_database_webtest.py for example
    useage.
    """

    coresUsed = 0

    def __init__(self, db, serviceObject, serviceRuntimeConfig):
        ServiceBase.__init__(self, db, serviceObject, serviceRuntimeConfig)
        self._logger = logging.getLogger(__name__)

    @staticmethod
    def configure(db, serviceObject, hostname, port, level_name="INFO"):
        db.subscribeToType(Configuration)

        with db.transaction():
            c = Configuration.lookupAny(service=serviceObject)
            if not c:
                c = Configuration(service=serviceObject)

            c.hostname = hostname
            c.port = port
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

        with self.db.view():
            config = Configuration.lookupAny(service=self.serviceObject)
            assert config, "No configuration available."
            self._logger.setLevel(config.log_level)
            host, port = config.hostname, config.port

            login_config = config.login_plugin

            codebase = login_config.codebase
            if codebase is not None:
                codebase.instantiate()

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
