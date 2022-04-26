#!/usr/bin/env python3

#   Copyright 2018 Braxton Mckee
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

import sys
import tempfile
import time

from object_database.service_manager.ServiceManager import ServiceManager

from object_database.web.CellsTestService import CellsTestService

from object_database.web.ActiveWebServiceSchema import active_webservice_schema
from object_database.web.ActiveWebService import ActiveWebService
from object_database import connect, core_schema, service_schema
from object_database.frontends.service_manager import startServiceManagerProcess
from object_database.util import genToken
from object_database.web.LoginPlugin import LoginIpPlugin


def main(argv=None):
    if argv is None:
        argv = sys.argv

    token = genToken()
    httpPort = 8000
    odbPort = 8020
    loglevel_name = "INFO"

    with tempfile.TemporaryDirectory() as tmpDirName:
        server = None
        try:
            server = startServiceManagerProcess(
                tmpDirName, odbPort, token, loglevelName=loglevel_name, logDir=False
            )

            database = connect("localhost", odbPort, token, retry=True)
            database.subscribeToSchema(core_schema, service_schema, active_webservice_schema)

            with database.transaction():
                service = ServiceManager.createOrUpdateService(
                    ActiveWebService, "ActiveWebService", target_count=0
                )

            ActiveWebService.configureFromCommandline(
                database,
                service,
                [
                    "--port",
                    str(httpPort),
                    "--internal-port",
                    "8001",
                    "--host",
                    "0.0.0.0",
                    "--log-level",
                    loglevel_name,
                ],
            )

            ActiveWebService.setLoginPlugin(
                database,
                service,
                LoginIpPlugin,
                [None],
                config={"company_name": "A Testing Company"},
            )

            with database.transaction():
                ServiceManager.startService("ActiveWebService", 1)

            with database.transaction():
                service = ServiceManager.createOrUpdateService(
                    CellsTestService, "CellsTestService", target_count=1
                )

            while True:
                time.sleep(0.1)
        finally:
            if server is not None:
                server.terminate()
                server.wait()

    return 0


if __name__ == "__main__":
    sys.exit(main())
