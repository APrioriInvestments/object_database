#   Copyright 2017-2021 object_database Authors
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


from object_database.web.cells.cell import Cell


class Dropdown(Cell):
    def __init__(self, title, headersAndLambdas, singleLambda=None):
        """
        Initialize a Dropdown menu.

            title - a cell containing the current value.
            headersAndLambdas - a list of pairs containing (cell, callback) for each menu item.

        OR

            title - a cell containing the current value.
            headersAndLambdas - a list of pairs containing cells for each item
            callback - a primary callback to call with the selected cell
        """
        super().__init__()

        if singleLambda is not None:

            def makeCallback(cell):
                def callback():
                    singleLambda(cell)

                return callback

            self.headersAndLambdas = [
                (header, makeCallback(header)) for header in headersAndLambdas
            ]
        else:
            self.headersAndLambdas = headersAndLambdas

        self.title = Cell.makeCell(title)

    def sortsAs(self):
        return self.title.sortsAs()

    def recalculate(self):
        self.children["title"] = self.title
        self.children["dropdownItems"] = []
        self.exportData["dropdownItemInfo"] = {}

        itemsToAdd = []
        for i in range(len(self.headersAndLambdas)):
            header, onDropdown = self.headersAndLambdas[i]
            childCell = Cell.makeCell(header)
            itemsToAdd.append(childCell)
            if not isinstance(onDropdown, str):
                self.exportData["dropdownItemInfo"][i] = "callback"
            else:
                self.exportData["dropdownItemInfo"][i] = onDropdown

        self.children["dropdownItems"] = itemsToAdd

    def onMessage(self, msgFrame):
        onMessageFun = self.headersAndLambdas[msgFrame["ix"]][1]

        if isinstance(onMessageFun, str):
            self.scheduleMessage(dict(action="redirect", url=onMessageFun))
        else:
            # execute the lambda directly
            onMessageFun()
