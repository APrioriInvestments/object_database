#   Coyright 2017-2022 Nativepython Authors
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

from object_database.web.CellsTestPage import CellsTestPage
from object_database.web import cells as cells
from object_database import service_schema
from object_database.service_manager.TerminalSession import terminal_schema


class TerminalDemo(CellsTestPage):
    def cell(self):
        return cells.Terminal(stream=cells.PopenStream(["/usr/bin/bash", "-i"]))

    def text(self):
        return "you should see a terminal running bash locally"


class TerminalProcessDemo(CellsTestPage):
    def cell(self):
        def makeCell():
            cells.ensureSubscribedSchema(service_schema)
            cells.ensureSubscribedSchema(terminal_schema)

            activeTerminal = cells.Slot(None)

            def setTerminal(session):
                logging.info("Activating Session: %s", session)
                activeTerminal.set(session)

            return (
                cells.Button(
                    "Create New",
                    lambda: service_schema.TerminalSession.create(
                        host=service_schema.ServiceHost.lookupAny(),
                        command=["/usr/bin/bash", "-i"],
                    ),
                )
                + cells.Scrollable(
                    cells.Table(
                        colFun=lambda: ["id", "command", "activate", "delete"],
                        headerFun=lambda x: x,
                        rowFun=lambda: service_schema.TerminalSession.lookupAll(),
                        rendererFun=lambda service, col: cells.Subscribed(
                            lambda: service._identity
                            if col == "id"
                            else str(service.command)
                            if col == "command"
                            else cells.Button("activate", lambda: setTerminal(service))
                            if col == "activate"
                            else cells.Button("delete", lambda: service.deleteSelf())
                            if col == "delete"
                            else ""
                        ),
                        maxRowsPerPage=100,
                    )
                )
                + cells.Subscribed(
                    lambda: str(len(terminal_schema.TerminalState.lookupAll()))
                    + " total TerminalState totalling " +
                    str(sum(x.topByteIx - x.bottomByteIx for x in terminal_schema.TerminalState.lookupAll()))
                )
                + cells.Subscribed(
                    lambda: None
                    if activeTerminal.get() is None
                    else activeTerminal.get().cell()
                )
            )

        return cells.Subscribed(makeCell)

    def text(self):
        return (
            "you should see a table of terminal sessions. you can "
            "create a new and connect to one"
        )


class DoubleTerminalProcessDemo(CellsTestPage):
    def cell(self):
        return cells.ResizablePanel(
            TerminalProcessDemo().cell(),
            TerminalProcessDemo().cell()
        )

    def text(self):
        return (
            "you should see two tables of terminal sessions. you can "
            "create a new and connect to one in either the left or right panes"
        )
