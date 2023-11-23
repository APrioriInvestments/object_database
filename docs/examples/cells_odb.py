from object_database import Schema, ServiceBase
import object_database.web.cells as cells
import time
import random

# define a 'schema', which is a collection of classes we can subscribe to as a group
schema = Schema("cells_obd")

# define a type of entry in odb. We'll have one instance of this class for each
# message in the database
@schema.define
class Message:
    timestamp = float
    message = str
    lifetime = float


class AnODBService(ServiceBase):
    def initialize(self):
        # make sure we're subscribed to all objects in our schema.
        self.db.subscribeToSchema(schema)

    def doWork(self, shouldStop):
        # this is the main entrypoint for the service - it gets to do work here.
        while not shouldStop.is_set():
            #wake up every 100ms and look at the objects in the ODB.
            time.sleep(.1)

            # delete any messages more than 10 seconds old
            with self.db.transaction():
                # get all the messages
                messages = Message.lookupAll()

                for m in messages:
                    if m.timestamp < time.time() - m.lifetime:
                        # this will actually delete the object from the ODB.
                        m.delete()

    @staticmethod
    def serviceDisplay(serviceObject, instance=None, objType=None, queryArgs=None):
        # make sure cells has loaded these classes in the database and subscribed
        # to all the objects.
        cells.ensureSubscribedSchema(schema)

        def newMessage():
            # calling the constructor creates a new message object. Even though we
            # orphan it immediately, we can always get it back by calling
            #       Message.lookupAll()
            # because ODB objects have an explicit lifetime (they have to be destroyed)
            Message(timestamp=time.time(), message=editBox.currentText.get(), lifetime=20)

            # reset our edit box so we can type again
            editBox.currentText.set("")

        # define an 'edit box' cell. The user can type into this.
        editBox = cells.SingleLineTextBox(onEnter=lambda newText: newMessage())

        return cells.Panel(
            editBox >> cells.Button(
                "New Message",
                newMessage
            )
        ) + (
            cells.Table(
                colFun=lambda: ['timestamp', 'lifetime', 'message'],
                rowFun=lambda: sorted(Message.lookupAll(), key=lambda m: -m.timestamp),
                headerFun=lambda x: x,
                rendererFun=lambda m, col: cells.Subscribed(
                    lambda:
                    cells.Timestamp(m.timestamp) if col == 'timestamp' else
                    m.message if col == 'message' else
                    cells.Dropdown(
                        m.lifetime,
                        [1, 2, 5, 10, 20, 60, 300],
                        lambda val: setattr(m, 'lifetime', val)
                    )
                ),
                maxRowsPerPage=100,
                fillHeight=True
            )
        )
