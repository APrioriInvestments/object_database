#   Coyright 2017-2019 Nativepython Authors
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

from object_database.web import cells as cells
from object_database.web.CellsTestPage import CellsTestPage


class BasicCollapsiblePanel(CellsTestPage):
    def cell(self):
        isExpanded = cells.Slot(False)

        return cells.Subscribed(
            lambda: cells.Button(
                "Close" if isExpanded.get() else "Open",
                lambda: isExpanded.set(not isExpanded.get()),
            )
        ) + cells.CollapsiblePanel(
            panel=cells.SubscribedSequence(
                lambda: [1],
                lambda i: cells.Text("PANE") + cells.Subscribed(lambda: "Some Text"),
            ),
            content=cells.ResizablePanel(
                cells.Subscribed(lambda: cells.Card("I am some content")),
                cells.Subscribed(lambda: cells.Card("I am the other half of content")),
            ),
            isExpanded=lambda: isExpanded.get(),
        )

    def text(self):
        return "You should see a non-expanded collapsible panel."
