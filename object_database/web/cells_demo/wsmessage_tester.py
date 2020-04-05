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

from object_database.web import cells as cells
from object_database.web.CellsTestPage import CellsTestPage


class WSMessageTesterExample(CellsTestPage):
    def cell(self):
        contents = cells.Slot("")
        text = """def cell(self):
        contents = cells.Slot("No Text Entered Yet!")

        textToDisplayFunction = lambda: "some text"

        def onTextChange(content, selection):
            contents.set(content)

        return cells.CodeEditor(
                textToDisplayFunction=textToDisplayFunction,
                onTextChange=onTextChange, firstVisibleRow=5
                )
        """
        text *= 5

        def onTextChange(buffer, selection):
            contents.set(buffer)

        codeEditor = cells.CodeEditor(
            onTextChange=onTextChange, textToDisplayFunction=lambda: text
        )

        return cells.ResizablePanel(
            cells.WSMessageTester(codeEditor.setFirstVisibleRow, rowNum=10), codeEditor
        )

    def text(self):
        return "You should see some buttons in various styles."
