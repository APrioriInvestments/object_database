import object_database
import logging
import types


from object_database.web.cells.children import Children
from object_database.web.cells.recomputing_cell_context import RecomputingCellContext
from object_database.web.cells.cells_context import CellsContext
from object_database.web.cells.computed_slot import ComputedSlot
from object_database.web.cells.dependency_context import DependencyContext


MAX_TIMEOUT = 1.0
MAX_TRIES = 10


class Cell(object):
    """Base class for all Cell instances."""

    EFFECT = False
    FOCUSABLE = False

    def __init__(self):
        self.cells = None  # will get set when its added to a 'Cells' object

        # the most recent parent we set
        self.parent = None

        # the parent we knew the last time we recalculated
        self.knownParent = None

        # the set of parents - only meaningful while we're recalculating
        self.allParents = set()

        self.level = None
        self.children = Children()
        self.contents = ""  # some contents containing a local node def
        self.isRoot = False
        self._identity = None  # None, or a string
        self._tag = None
        self.context = {}
        self._messagesToSendOnInstall = []
        self.exportData = {}
        self.reactors = set()

    def sessionStateSlot(self, subfield):
        from object_database.web.cells.session_state import sessionState

        return ComputedSlot(
            lambda: sessionState(self).slotFor(self.identityPath + (subfield,)).get(),
            lambda value: sessionState(self)
            .slotFor(self.identityPath + (subfield,))
            .set(value),
        )

    def childHadUserAction(self, directChild, deepChild):
        """Called if one of our children had a user-interface action like a button click.

        Args:
            directChild - our immediate child below which this happened
            deepChild - the actual leaf child who did this.
        """
        if self.parent:
            self.parent.childHadUserAction(self, deepChild)

    @classmethod
    def isBuiltinCell(cls):
        return True

    def cellJavascriptClassName(self):
        return self.__class__.__name__

    def scheduleCallback(self, callback):
        context = DependencyContext.get()

        if context is None:
            raise Exception("Can't schedule a callback outside of a DependencyContenxt")

        context.scheduleCallback(callback)

    def scheduleMessage(self, message):
        context = DependencyContext.get()

        if context is None:
            raise Exception("Can't schedule a message outside of a DependencyContenxt")

        context.scheduleMessage(self, message)

    def onRemovedFromTree(self):
        """Called when a cell is removed from the tree. This shouldn't update any slots,
        but may schedule callbacks."""
        pass

    def treeToString(self, indent=0):
        return "\n".join(
            [" " * indent + str(self)]
            + [x.treeToString(indent + 2) for x in self.children.allChildren]
        )

    def subscribedSlotChanged(self, slot):
        """Called when a slot we're subscribed to changes."""
        self.markDirty()

    def subscribedOdbValueChanged(self, odbKey):
        """Called when an object database key we depend on changes."""
        self.markDirty()

    def getDisplayExportData(self):
        """Get the version of 'self.exportData' we should actually use."""
        return self.exportData

    def getDisplayChildren(self):
        """Get the version of 'self.children' that we should use when displaying this cell.

        Cells that have children who are collapsed into their parent are
        responsible for flattening the tree here.
        """
        return self.children

    def install(self, cells, parent, identity):
        assert self.cells is None
        self.cells = cells
        self.parent = parent
        self.knownParent = parent
        self.allParents.add(parent)

        self.level = parent.level + 1 if parent is not None else 0
        self._identity = identity
        self._identityPath = None

        if self._messagesToSendOnInstall:
            self.cells.markPendingMessages(self, self._messagesToSendOnInstall)
            self._messagesToSendOnInstall = []

    @property
    def identityPath(self):
        """Return a stable unique id for this cell representing its position in the tree."""
        if self.cells is None:
            return ()

        if self.parent is None:
            return ()

        if self._identityPath is None:
            self._identityPath = self.parent.identityPath + (
                self.parent.identityOfChild(self),
            )

        return self._identityPath

    def identityOfChild(self, child):
        try:
            return self.children.allChildren.index(child)
        except ValueError:
            return child._identity

    def __repr__(self):
        return f"{type(self).__name__}(id={self._identity})"

    def applyCellDecorator(self, decorator):
        """Return a new cell which applies the function 'decorator' to 'self'.

        By default we just call the function. But some subclasses may want to apply
        the decorator to child cells instead.
        """
        return decorator(self)

    def tagged(self, tag):
        """Give a tag to the cell, which can help us find interesting cells during test."""
        self._tag = tag
        self.exportData["_tag"] = tag
        return self

    def findChildrenByTag(self, tag, stopSearchingAtFoundTag=False):
        """Search the cell and its children for all cells with the given tag.

        If `stopSearchingAtFoundTag`, we don't search recursively the children of a
        cell that matched our search.
        """
        cells = []

        if self._tag == tag:
            cells.append(self)
            if stopSearchingAtFoundTag:
                return cells

        for child in self.children.allChildren:
            cells.extend(child.findChildrenByTag(tag, stopSearchingAtFoundTag))

        return cells

    def visitAllChildren(self, visitor):
        visitor(self)
        for child in self.children.allChildren:
            child.visitAllChildren(visitor)

    def findChildrenMatching(self, filtr):
        res = []

        def visitor(cell):
            if filtr(cell):
                res.append(cell)

        self.visitAllChildren(visitor)

        return res

    def childByIndex(self, ix):
        return self.children[sorted(self.children.names())[ix]]

    def childrenWithExceptions(self):
        return self.findChildrenMatching(
            lambda cell: isinstance(cell, object_database.web.cells.leaves.Traceback)
            or ("exception" in cell.exportData)
        )

    def prepareForCalculation(self):
        """Prepare for recalculation."""
        self.exportData.pop("exception", None)

    def sortsAs(self):
        return None

    def isActive(self):
        """Is this cell installed in the tree and active?"""
        return self.cells and self._identity is not None and self.parent is not None

    def isOrphaned(self):
        return self.cells is not None and self.parent is None

    def isMoved(self):
        return self.isActive() and self.parent is not self.knownParent

    def moveToParent(self, newParent):
        assert newParent.isActive()

        self.allParents.add(newParent)
        self.parent = newParent

        return self.parent is not self.knownParent

    def onMoved(self):
        assert self.parent is not None

        if len(self.allParents) > 1:
            for p in self.allParents:
                p.onError(Exception(f"Child cell({self}) can't have two parents"))

        if self.isAncestorOf(self.parent):
            raise Exception(
                f"Somehow {self} is an ancestor of {self.parent} which "
                f"would create a cycle."
            )

        logging.info("Cell %s moved from %s to %s", self, self.knownParent, self.parent)

        self.knownParent = self.parent

    def removeParent(self, oldParent):
        self.allParents.discard(oldParent)

        if self.parent is oldParent:
            if self.allParents:
                self.parent = list(self.allParents)[0]
            else:
                self.parent = None

    def uninstall(self):
        self.cells = None
        self._identity = None
        self.parent = None

    @property
    def identity(self):
        if self._identity is None:
            raise Exception(
                "Can't ask for identity for %s as it's not part of a cells package" % self
            )
        return self._identity

    def markDirty(self):
        if self._identity is not None and self.cells is not None:
            self.cells.markDirty(self)

    def recalculate(self):
        pass

    def onError(self, exception, stacktrace=None):
        """Called if recalculate throws an exception."""
        if stacktrace is None:
            stacktrace = ""
        else:
            stacktrace = "\n\n" + stacktrace

        logging.error(
            "Cell %s had exception: %s%s",
            self,
            type(exception).__name__ + ": " + str(exception),
            stacktrace,
        )

        self.exportData["exception"] = (
            type(exception).__name__ + ": " + str(exception) + stacktrace
        )

    def isErrored(self):
        return "exception" in self.exportData

    @staticmethod
    def makeCell(x):
        if isinstance(x, (str, float, int, bool)):
            return object_database.web.cells.leaves.Text(str(x), sortAs=x)
        if x is None:
            return object_database.web.cells.leaves.Span("")
        if isinstance(x, types.FunctionType):
            return object_database.web.cells.subscribed.Subscribed(x)
        if isinstance(x, Cell):
            return x
        if hasattr(x, "cellDisplay"):
            return Cell.makeCell(x.cellDisplay())

        return object_database.web.cells.Traceback(
            f"Can't convert instance of type {type(x)} to a cell."
        )

    def __add__(self, other):
        return object_database.web.cells.sequence.Sequence([self, Cell.makeCell(other)])

    def __rshift__(self, other):
        return object_database.web.cells.sequence.HorizontalSequence(
            [self, Cell.makeCell(other)]
        )

    def withContext(self, **kwargs):
        """Modify our context, and then return self."""
        self.context.update(kwargs)
        return self

    def setContext(self, key, val):
        self.context[key] = val
        return self

    def isAncestorOf(self, child):
        while child is not None:
            if child is self:
                return True
            child = child.parent

        return False

    def getContext(self, contextKey, exact=False):
        """Determine the value of context variable 'contextKey'.

        Args:
            contextKey - anything hashable that identifies a piece of tree
                -based context.
            exact - if True, then don't search our parents.
        """
        if contextKey in self.context:
            return self.context[contextKey]

        if exact:
            return None

        if self.parent:
            return self.parent.getContext(contextKey)

        return None


class FocusableCell(Cell):
    """A cell representing an item that can hold the focus."""

    FOCUSABLE = True

    def __init__(self):
        super().__init__()

        self.focusOnInstall = False
        self.mostRecentFocusId = None

    def install(self, cells, parent, identity):
        super().install(cells, parent, identity)

        if self.focusOnInstall:
            self.cells.changeFocus(self)

    def focus(self):
        if self.cells is None:
            self.focusOnInstall = True
        else:
            self.cells.changeFocus(self)

    def isFocused(self):
        if self.cells is None:
            cur = CellsContext.get()
            if cur is None:
                return False
            else:
                return cur.focusedCell.get() is self

        return self.cells.focusedCell.get() is self


def context(contextKey):
    """During cell evaluation, lookup context from our parent cell by name."""
    if not RecomputingCellContext.get():
        raise Exception("Please call 'context' from within a cell update function.")

    return RecomputingCellContext.get().getContext(contextKey)
