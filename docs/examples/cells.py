import object_database.web.cells as cells
from object_database import ServiceBase


class SomethingMoreInteresting(ServiceBase):
    def initialize(self):
        self.buttonName = "click me"
        return

    @staticmethod
    def serviceDisplay(serviceObject, instance=None, objType=None, queryArgs=None):
        return cells.Card(
            cells.Panel(
                cells.Button("Reload", lambda: "") +
                cells.Button("Service Base", lambda: "ServiceBase") +
                cells.Button("Active Web Service", lambda: "ActiveWebService")
            ),
            header="This is a 'card' cell with some buttons",
            padding="10px"
        )
