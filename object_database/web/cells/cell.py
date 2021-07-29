import object_database
import time
import logging


from object_database.web.cells.children import Children
from object_database.web.cells.computing_cell_context import ComputingCellContext
from object_database.view import RevisionConflictException


MAX_TIMEOUT = 1.0
MAX_TRIES = 10


class Cell:
    """Base class for all Cell instances."""

    def __init__(self):
        self.cells = None  # will get set when its added to a 'Cells' object

        # the cell that created us. This will never change.
        self.parent = None

        self.level = None
        self.children = Children()
        self.contents = ""  # some contents containing a local node def
        self.shouldDisplay = True  # Whether or not this is a cell that will be displayed
        self.isRoot = False
        self.isShrinkWrapped = False  # If will be shrinkwrapped inside flex parent
        self.isFlex = False  # If True, then we are 'Flex'
        self._identity = None  # None, or a string
        self._tag = None
        self.garbageCollected = False
        self.subscriptions = set()
        self.context = {}

        # lifecycle state attributes
        # These reflect the current state of the cell and
        # subsequently used in WS message formatting and pre-processing
        # NOTE: as of this commit these resetting state on (potentially) reused
        # cells is handled by self.updateLifecycleState.
        self.wasCreated = True
        self.wasUpdated = False
        self.wasRemoved = False

        self._logger = logging.getLogger(__name__)

        self._messagesToSendOnInstall = []

        # This is for interim JS refactoring.
        # Cells provide extra data that JS
        # components will need to know about
        # when composing DOM.
        self.exportData = {}

    def scheduleMessage(self, message):
        if not self.garbageCollected and self.cells is not None:
            self.cells.markPendingMessage(self, message)
        else:
            self._messagesToSendOnInstall.append(message)

    def cellJavascriptClassName(self):
        return self.__class__.__name__

    def onRemovedFromTree(self):
        """Called when a cell is removed from the tree. This shouldn't update any slots,
        but may schedule callbacks."""
        pass

    def onWatchingSlot(self, slot):
        """Called when we become tied to the value of a slot."""
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
        """Get the version of 'self.exportData' we should actually use.

        Cells that have children who are collapsed into their parent are responsible for
        updating things like 'flexParent' here.
        """
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

    def updateLifecycleState(self):
        """Handles cell lifecycle state.

        Once a cell has been created, updated or deleted and corresponding
        messages sent to the client, the cell state is updated accordingly.
        Example, if `cell.wasCreated=True` from that moment forward it is
        already in the echosystem and so `cell.Created=False`. The 'was'
        linking verb is used to to reflect that something has been done to the
        cell (object DB, or client call back side-effect) and now the reset of
        the system, server and client side, needs to know about it.

        TODO: At the moment this method **needs** to be called after all
        message sends to the client. In the future, this should be integrated
        into a general lifecycle management scheme.
        """
        if self.wasCreated:
            self.wasCreated = False

        if self.wasUpdated:
            self.wasUpdated = False

        # NOTE: self.wasRemoved is set to False for self.prepareForReuse
        if self.wasRemoved:
            self.wasRemoved = False

    def evaluateWithDependencies(self, fun):
        """Evaluate function within a view and add dependencies for whatever
        we read."""
        with self.view() as v:
            result = fun()

            self._resetSubscriptionsToViewReads(v)

            return result

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
        return self.children[sorted(self.children)[ix]]

    def childrenWithExceptions(self):
        return self.findChildrenMatching(
            lambda cell: isinstance(cell, object_database.web.cells.leaves.Traceback)
        )

    def onMessageWithTransaction(self, *args):
        """ Call our inner 'onMessage' function with a transaction in a retry loop. """
        tries = 0
        t0 = time.time()
        while True:
            with ComputingCellContext(self, isProcessingMessage=True):
                try:
                    with self.transaction():
                        self.onMessage(*args)
                        return
                except RevisionConflictException:
                    tries += 1
                    if tries > MAX_TRIES or time.time() - t0 > MAX_TIMEOUT:
                        self._logger.error("OnMessage timed out. This should really fail.")
                        return
                except Exception:
                    self._logger.exception(
                        "Exception processing message %s to cell %s logic:", args, self
                    )
                    return

    def _clearSubscriptions(self):
        if self.cells:
            for sub in self.subscriptions:
                self.cells.unsubscribeCell(self, sub)

        self.subscriptions = set()

    def _resetSubscriptionsToViewReads(self, view):
        new_subscriptions = set(view.getFieldReads()).union(set(view.getIndexReads()))

        for k in new_subscriptions.difference(self.subscriptions):
            self.cells.subscribeCell(self, k)

        for k in self.subscriptions.difference(new_subscriptions):
            self.cells.unsubscribeCell(self, k)

        self.subscriptions = new_subscriptions

    def view(self):
        return self.cells.db.view()

    def transaction(self):
        return self.cells.db.transaction()

    def prepare(self):
        pass

    def sortsAs(self):
        return None

    def isActive(self):
        """Is this cell installed in the tree and active?"""
        return self.cells and not self.garbageCollected

    def prepareForReuse(self):
        if not self.garbageCollected:
            return False

        self.cells = None
        self.garbageCollected = False
        self._identity = None
        self.parent = None

        for c in self.children.allChildren:
            c.prepareForReuse()

        return True

    @property
    def identity(self):
        if self._identity is None:
            raise Exception(
                "Can't ask for identity for %s as it's not part of a cells package" % self
            )
        return self._identity

    def markDirty(self):
        if not self.garbageCollected and self.cells is not None:
            self.cells.markDirty(self)

    def recalculate(self):
        pass

    @staticmethod
    def makeCell(x):
        if isinstance(x, (str, float, int, bool)):
            return object_database.web.cells.leaves.Text(str(x), sortAs=x)
        if x is None:
            return object_database.web.cells.leaves.Span("")
        if isinstance(x, Cell):
            return x

        return object_database.web.cells.contextual_display.ContextualDisplay(x)

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

    def getContext(self, contextKey):
        if contextKey in self.context:
            return self.context[contextKey]

        if self.parent:
            return self.parent.getContext(contextKey)

        return None


def context(contextKey):
    """During cell evaluation, lookup context from our parent cell by name."""
    if ComputingCellContext.get() is None:
        raise Exception("Please call 'context' from within a message or cell update function.")

    return ComputingCellContext.get().getContext(contextKey)