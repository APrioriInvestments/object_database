from object_database import connect, Schema
import time

schema = Schema("hello_world")


@schema.define
class Message:
    timestamp = float
    message = str

db = connect('localhost', 8000, 'TOKEN')

db.subscribeToSchema(schema)

ts = 0
while True:
    with db.transaction():
        Message(timestamp=time.time(), message="message_5")
        messages = Message.lookupAll()
        for m in messages:
            if m.timestamp > ts:
                print((m.message, m.timestamp))
                ts = m.timestamp
    time.sleep(1)
