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

from object_database.web import cells
from object_database.web.CellsTestPage import CellsTestPage


class SubscribedErrorInSequence(CellsTestPage):
    def cell(self):
        showError = cells.Slot(True)
        top_button = cells.Button("Toggle Error", lambda: showError.toggle())

        def content():
            if showError.get():
                raise Exception("This is an error")
            else:
                return "This is some text"

        return top_button + cells.Subscribed(content)

    def text(self):
        return "Should show a button allowing you to toggle between text and an exception."


class SubscribedErrorDirect(CellsTestPage):
    def cell(self):
        showError = cells.Slot(True)
        top_button = cells.Button("Toggle Error", lambda: showError.toggle())

        def content():
            if showError.get():
                raise Exception("This is an error")
            else:
                return "This is some text"

        return top_button + cells.Panel(cells.Subscribed(content))

    def text(self):
        return (
            "Should show a button allowing you to toggle between text and "
            "an exception in a panel."
        )


class SubscribedSequenceError(CellsTestPage):
    def cell(self):
        showError = cells.Slot(True)
        top_button = cells.Button("Toggle Error", lambda: showError.toggle())

        def keys():
            if showError.get():
                raise Exception("This is an error")
            else:
                return list(range(10))

        return top_button + cells.SubscribedSequence(keys, lambda i: f"Item {i}")

    def text(self):
        return (
            "Should show a button allowing you to toggle between text and "
            "an exception in a panel."
        )
