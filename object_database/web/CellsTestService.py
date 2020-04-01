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

import traceback
import textwrap
import urllib
import sys

from inspect import getsourcelines
from object_database.service_manager.ServiceBase import ServiceBase
from typed_python.Codebase import Codebase

import object_database.web.cells as cells
import object_database as object_database
from object_database.web.CellsTestPage import CellsTestPage
from object_database import Schema

schema = Schema("core.web.CellsTestService")


@schema.define
class Counter:
    value = int


_pagesCache = {}


def getPages():
    if _pagesCache:
        return _pagesCache

    # force us to actually import everything in object database
    odbCodebase = Codebase.FromRootlevelModule(object_database)
    # these are all the cell_demo cells
    for name, value in odbCodebase.allModuleLevelValues():
        if (
            isinstance(value, type)
            and issubclass(value, CellsTestPage)
            and value is not CellsTestPage
        ):
            try:
                instance = value()
                _pagesCache.setdefault(instance.category(), {})[value.__name__] = instance
            except Exception:
                traceback.print_exc()

    return _pagesCache


class CellsTestService(ServiceBase):
    gbRamUsed = 0
    coresUsed = 0

    @staticmethod
    def serviceDisplay(serviceObject, instance=None, objType=None, queryArgs=None):
        queryArgs = queryArgs or {}

        if "category" in queryArgs and "name" in queryArgs:
            page = getPages()[queryArgs["category"]][queryArgs["name"]]

            contentsBuffer = cells.Slot(
                textwrap.dedent("".join(getsourcelines(page.cell.__func__)[0]))
            )
            contentsToEvaluate = cells.Slot(contentsBuffer.getWithoutRegisteringDependency())

            def actualDisplay():
                if contentsToEvaluate.get() is not None:
                    try:
                        locals = {}
                        exec(
                            contentsToEvaluate.get(),
                            sys.modules[type(page).__module__].__dict__,
                            locals,
                        )
                        return locals["cell"](page).tagged("demo_root")
                    except Exception:
                        return cells.Traceback(traceback.format_exc())

                return page.cell.tagged("demo_root")

            def onEnter(buffer, selection):
                contentsToEvaluate.set(buffer)

            ed = cells.CodeEditor(
                keybindings={"Enter": onEnter},
                noScroll=True,
                minLines=20,
                onTextChange=lambda buffer, selection: contentsBuffer.set(buffer),
                textToDisplayFunction=lambda: contentsBuffer.get(),
            )

            description = page.text()
        else:
            page = None
            description = ""
            ed = cells.Card("pick something")

            def actualDisplay():
                return cells.Card(cells.Text("nothing to display"), padding=10)

        resultArea = cells.SplitView(
            [
                (cells.Subscribed(actualDisplay), 4),
                (cells.Card(cells.Text(description), padding=2), 0),
            ],
            split="horizontal",
        )

        inputArea = cells.SplitView([(selectionPanel(page), 2), (ed, 9)])

        return cells.ResizablePanel(resultArea, inputArea, split="horizontal")

    def doWork(self, shouldStop):
        while not shouldStop.is_set():
            shouldStop.wait(100.0)


def reload():
    """Force the process to kill itself. When you refresh,
    it'll be the new code."""
    import os

    os._exit(0)


def selectionPanel(page):
    substringFilter = cells.Slot("")

    def getAvailableCells():
        availableCells = []
        for _, category in sorted(getPages().items()):
            for _, item in sorted(category.items()):
                displayName = "{}.{}".format(item.category(), item.name())
                url = "CellsTestService?{}".format(
                    urllib.parse.urlencode(dict(category=item.category(), name=item.name()))
                )
                clickable = cells.Clickable(displayName, url, makeBold=item is page)
                # ignore case when filtering
                if substringFilter.get().lower() in displayName.lower():
                    availableCells.append(clickable)
        return availableCells

    reloadInput = cells.Button(cells.Octicon("sync"), reload)
    filterBox = cells.SingleLineTextBox(substringFilter)
    header = cells.HorizontalSequence([reloadInput, filterBox])

    return cells.Panel(
        cells.Sequence(
            [header, cells.Subscribed(lambda: cells.Flex(cells.Sequence(getAvailableCells())))]
        )
    )
