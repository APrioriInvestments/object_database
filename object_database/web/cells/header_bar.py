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


class HeaderBar(Cell):
    def __init__(self, leftItems, centerItems=None, rightItems=None):
        super().__init__()
        self.leftItems = leftItems
        self.centerItems = centerItems
        self.rightItems = rightItems

        self.children.addFromDict(
            {
                "leftItems": self.leftItems,
                "centerItems": self.centerItems,
                "rightItems": self.rightItems,
            }
        )
