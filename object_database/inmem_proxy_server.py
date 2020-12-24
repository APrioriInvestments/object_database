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

import threading
import time

from object_database.messages import getHeartbeatInterval
from object_database.proxy_server import ProxyServer
from object_database.inmem_server import InMemoryChannel, DatabaseConnection


class InMemProxyServer(ProxyServer):
    def __init__(self, *args, verbose=False, **kwargs):
        super().__init__(*args, **kwargs)

        self.channels = []
        self.stopped = threading.Event()
        self.checkForDeadConnectionsLoopThread = threading.Thread(
            target=self.checkForDeadConnectionsLoop
        )
        self.checkForDeadConnectionsLoopThread.daemon = True
        self.checkForDeadConnectionsLoopThread.start()
        self.verbose = verbose

    def tearDown(self):
        self.stopped.set()

        self._channelToMainServer.stop()
        self.checkForDeadConnectionsLoopThread.join()

    def checkForDeadConnectionsLoop(self):
        lastCheck = time.time()
        while not self.stopped.is_set():
            if time.time() - lastCheck > getHeartbeatInterval():
                self.checkForDeadConnections()
                lastCheck = time.time()
            else:
                self.stopped.wait(
                    max(0.001, min(getHeartbeatInterval(), time.time() - lastCheck))
                )

    def getChannel(self):
        channel = InMemoryChannel(self)
        channel.start()

        self.addConnection(channel)
        self.channels.append(channel)

        return channel

    def connect(self):
        channel = self.getChannel()
        dbc = DatabaseConnection(channel)

        if self.verbose:
            channel.markVerbose(f"Proxy({id(self)})", f"View({id(dbc)})")

        dbc.authenticate(self.authToken)
        dbc.initialized.wait(timeout=1)
        return dbc
