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


from object_database.web.cells.subscribed import Subscribed
from object_database.web.cells.leaves import Traceback
from object_database.web.cells.computing_cell_context import ComputingCellContext


# map from type -> [(ContextMatcher, displayFun)]
# contains all the registered cell handlers.
_typeToDisplay = {}


class ContextMatcher:
    """Checks if a cell matches a context dict."""

    def __init__(self, contextDict):
        """Initialize a context matcher."""
        self.contextDict = contextDict

    def matchesCell(self, cell):
        for key, value in self.contextDict.items():
            ctx = cell.getContext(key)
            if callable(value):
                if not value(ctx):
                    return False
            else:
                if ctx != value:
                    return False
        return True


def ContextualDisplay(value):
    """Display an arbitrary python object by checking registered display handlers"""

    def computeDisplay():
        currentCell = ComputingCellContext.get()

        if not currentCell:
            return None

        if type(value) in _typeToDisplay:
            for context, dispFun in _typeToDisplay[type(value)]:
                if context.matchesCell(currentCell):
                    return dispFun(value)

        if hasattr(value, "cellDisplay"):
            return value.cellDisplay()

        return Traceback(f"Invalid object of type {type(value)}")

    return Subscribed(computeDisplay)


def registerDisplay(type, **context):
    """Register a display function for any instances of a given type. For instance

    @registerDisplay(MyType, size="small")
    def display(value):
        return cells.Text("For small values")

    @registerDisplay(MyType)
    def display(value):
        return cells.Text("For any other kinds of values")

    Arguments:
        type - the type object to display. Instances of _exactly_ this type
            will match this if we don't have a display for the object already.
        context - a dict from str->value. we'll only use this display if this context
            is exactly matched in the parent cell. We'll check contexts in the
            order in which they were registered.
    """

    def registrar(displayFunc):
        _typeToDisplay.setdefault(type, []).append((ContextMatcher(context), displayFunc))

        return displayFunc

    return registrar
