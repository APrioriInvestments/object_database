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


from object_database.web.cells.cell import Cell
from object_database.web.cells.reactor import SimpleReactor


class Effect(Cell):
    """A contentless cell that's allowed to make state-changes to the Slots and the ODB.

    Effects just hold a single Reactor.

    They let us formalize the idea that cells sometimes want to cause dependent actions to
    happen in the UI in order to cure some state.  The Effect cell gives us a formal ordering
    in which this can happen.

    An Effect cell produces no content, but it registers an 'effect' function that gets
    to run as soon as the cell is created. It may look at some combination of ODB objects
    and slots and apply whatever changes it wants to either of them. Like a reactor, it will
    re-run if any of the values that it reads are modified.  If you're not careful, you may
    easily end up in a cycle of changes, so be judicious with these.
    """

    def __init__(self, effector):
        super().__init__()

        self.reactors.add(SimpleReactor(effector))

    def recalculate(self):
        pass

    def cellJavascriptClassName(self):
        return "PassthroughCell"
