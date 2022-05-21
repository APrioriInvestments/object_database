import object_database.web.cells as cells
from object_database import ServiceBase


class SomethingMoreInteresting(ServiceBase):
    def initialize(self):
        self.buttonName = "click me"
        return

    @staticmethod
    def serviceDisplay(serviceObject, instance=None, objType=None, queryArgs=None):
        return cells.Card(cells.button("Click me", onClick))


def onClick():
    return "thanks"
