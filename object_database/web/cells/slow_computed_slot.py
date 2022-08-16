from object_database.web.cells.cells_context import CellsContext
from object_database.web.cells.dependency_context import DependencyContext
from object_database.web.cells.computed_slot_deps import ComputedSlotDeps



class SlowComputedSlot:
    def __init__(self, valueFunction, defaultValue=None):
        self.valueFunction = valueFunction
        self.cells = None

        self.currentValue = defaultValue
        self.currentDependencies = None

        self.isDirty = True
        self.isScheduled = False
        self.isExecuting = False

    def orphan(self):
        """This slot is no longer being used by the cells tree."""
        self.cells = None

    def get(self):
        curContext = DependencyContext.get()

        if curContext:
            raise Exception(
                "Can't access a SlowComputedSlot outside of a DependencyContext"
            )

        curContext.slowComputedSlotRead(self)
        return self.currentValue

    def getWithoutRegisteringDependency(self):
        return self.currentValue


