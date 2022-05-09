# The ODB engine

ODB's core is distributed in-memory objects. The low-level types, connections, and transactions are
written in C++ (including interactions with typed_python). The interfaces, persistence management,
and higher level APIs are written in python.

Let's see a quick example and the remainder of this document will layout the major ODB components 

## Quick example

If you don't have ODB installed yet, see [installation](../README.md#Installation) for instructions.

start in ODB repo root and start an ODB server:
```shell
./object_database/frontends/database_server.py --service-token TOKEN --inmem localhost 8000
```

This starts an ODB server that accepts incoming connection at `localhost:8000`.
The `--inmem` option indicates that objects are only persisted in process memory and
will be gone as soon as this server process is terminated.
And clients will be required to use "TOKEN" in order to be able to connect.

A producer is defined in `docs/examples/producer.py`. 
Run it in a terminal (from repo root):
```shell
python ./docs/examples/producer.py
```

A consumer is defined in `docs/examples/consumer.py`.
Run it in a terminal (from repo root):
```shell
python ./docs/examples/consumer.py
```

And you should see the consumer print out new messages like:

```
(odb) ➜  object_database git:(dev) ✗ python docs/examples/consumer.py
('message_0', 1652072778.4360642)
('message_1', 1652072779.4380279)
('message_2', 1652072780.4426992)
('message_3', 1652072781.4477468)
('message_4', 1652072782.4518585)
('message_5', 1652072783.4566717)
```

## Major components

### Schemas

A [Schema](../object_database/schema.py) is a collection of types used to access the ODB instance.
the `define` method on a schema instance is used to register new object type. Internally
the Schema will convert the specified python class into a typed_python NamedTuple.

### Connections

A [DatabaseConnection](../object_database/database_connection.py) is used to connect to the database
which is launched using a [server](../object_database/server.py) instance (e.g., TcpServer).
The server uses SSL connections and token authentication. Client-server communications are
supported by a [strongly-typed message bus](../object_database/message_bus.py) over sockets.

### Transactions

A [transaction](../object_database/database_connection.py) is required to read/write data to
ODB. A read-write transaction can be created by calling the `transaction` method on a `DatabaseConnection`.
A read-only transaction can be created by calling the `view` method instead.

A simple example looks something like this:
```python
from object_database import connect, Schema

schema = Schema("hello_world")

@schema.define
class Message:
    message = str

db = connect('localhost', 8000, 'TOKEN')
db.subscribeToSchema(schema)

with db.transaction():
    message = Message(message='message')
```

When you create a new object instance of a defined schema, that object is automatically
synced to the odb server. All ODB object creation must be done inside a transaction.

These transactions allow multiple clients to read/write using optimistic locking and a
write only fails if a conflict arises.

To create a read-only transaction, use `db.view()` instead.

### Persistence

ODB objects can be [persisted](../object_database/persistence.py) either in an in-memory store or in redis.
If in-memory is selected, then objects do not survive process restart.