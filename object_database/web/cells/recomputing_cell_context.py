#   Copyright 2017-2022 object_database Authors
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


_cur_cell = threading.local()


class RecomputingCellContext:
    """Context variable specifying the current Cell instance that's recalculating contents."""
    def __init__(self, cell):
        self.cell = cell

    @staticmethod
    def get():
        return getattr(_cur_cell, "cell", None)

    def __enter__(self):
        assert getattr(_cur_cell, "cell", None) is None
        _cur_cell.cell = self.cell

    def __exit__(self, *args):
        _cur_cell.cell = None
