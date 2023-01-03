"""A simple 'codebase' for testing purposes"""

from object_database.service_manager.ServiceBase import ServiceBase
from object_database import Schema

import time

schema = Schema("TestModule1")


@schema.define
class Record:
    x = int


def createNewRecord(db):
    db.subscribeToNone(Record)
    with db.transaction():
        Record(x=10)


class TestService1(ServiceBase):
    def initialize(self):
        pass

    def doWork(self, shouldStop):
        while not shouldStop.is_set():
            time.sleep(0.01)
