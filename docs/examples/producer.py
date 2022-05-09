from object_database import connect, Schema
import time

schema = Schema("hello_world")

@schema.define
class Message:
    timestamp = float
    message = str

db = connect('localhost', 8000, 'TOKEN')
db.subscribeToSchema(schema)

i = 0
while True:
    with db.transaction():
        message = Message(timestamp=time.time(),
                          message=f'message_{i}')
        print(f'Created {message}')
        i += 1
    time.sleep(1)
    
