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


class SessionState(CellsTestPage):
    def cell(self):
        ss = cells.sessionState()
        ss.setdefault("counter", 0)

        return cells.Subscribed(
            lambda: cells.Button(
                ss.get("counter") or 0, lambda: ss.set("counter", ss.get("counter") + 1)
            )
        )

    def text(self):
        return (
            "You should see a button with a counter that increases. "
            "If you bounce the browser, it should persist."
        )
