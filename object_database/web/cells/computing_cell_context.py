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

import threading


_cur_computing_cell = threading.local()


class ComputingCellContext:
    """Context variable to allow cells to know which parent cell is evaluating."""

    def __init__(self, cell, isProcessingMessage=False):
        self.cell = cell
        self.isProcessingMessage = isProcessingMessage
        self.prior = None

    @staticmethod
    def get():
        return getattr(_cur_computing_cell, "cell", None)

    @staticmethod
    def isProcessingMessage():
        return getattr(_cur_computing_cell, "isProcessingMessage", None)

    def __enter__(self):
        self.prior = (
            getattr(_cur_computing_cell, "cell", None),
            getattr(_cur_computing_cell, "isProcessingMessage", None),
        )

        _cur_computing_cell.cell = self.cell
        _cur_computing_cell.isProcessingMessage = self.isProcessingMessage

    def __exit__(self, *args):
        _cur_computing_cell.cell = self.prior[0]
        _cur_computing_cell.isProcessingMessage = self.prior[1]
