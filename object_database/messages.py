from typed_python import OneOf, Alternative, ConstDict, TupleOf, Tuple
from object_database.schema import (
    SchemaDefinition,
    ObjectId,
    ObjectFieldId,
    IndexId,
    IndexValue,
    FieldDefinition,
)

_heartbeatInterval = [5.0]


def setHeartbeatInterval(newInterval):
    _heartbeatInterval[0] = newInterval


def getHeartbeatInterval():
    return _heartbeatInterval[0]


def MessageToStr(msg):
    fields = {}

    if hasattr(msg, "schema"):
        fields["schema"] = msg.schema

    if hasattr(msg, "name"):
        fields["name"] = msg.name

    if hasattr(msg, "typename"):
        fields["typename"] = msg.typename

    if hasattr(msg, "transaction_id"):
        fields["transaction_id"] = msg.transaction_id

    if hasattr(msg, "writes"):
        fields["writes"] = f"#{len(msg.writes)}"

    if hasattr(msg, "set_adds"):
        fields["set_adds"] = f"#{len(msg.set_adds)}"

    if hasattr(msg, "set_removes"):
        fields["set_removes"] = f"#{len(msg.set_removes)}"

    if hasattr(msg, "mapping"):
        fields["mapping"] = f"#{len(msg.mapping)}"

    if hasattr(msg, "identities") and msg.identities:
        fields["identities"] = f"#{len(msg.identities)}"

    if hasattr(msg, "fieldname_and_value") and msg.fieldname_and_value is not None:

        def clip(x):
            stringified = repr(x)
            if len(stringified) > 20:
                stringified = stringified[:20] + stringified[0]
            return stringified

        fields[
            "fieldname_and_value"
        ] = f"({msg.fieldname_and_value[0]}, {clip(msg.fieldname_and_value[1])})"

    if hasattr(msg, "transaction_guid"):
        fields["transaction_guid"] = f"{msg.transaction_guid}"

    if hasattr(msg, "success"):
        fields["success"] = f"{msg.success}"

    if hasattr(msg, "values"):
        fields["values"] = f"#{len(msg.values)}"

    if hasattr(msg, "tid"):
        fields["tid"] = msg.tid

    if hasattr(msg, "index_values"):
        fields["index_values"] = f"#{len(msg.index_values)}"

    return type(msg).__name__ + "(" + ", ".join([f"{k}={v}" for k, v in fields.items()]) + ")"


ClientToServer = Alternative(
    "ClientToServer",
    # start a transaction. the 'transaction_guid' identifies the transaction
    # within the stream (it's not actually global).  The transaction consists of
    # a set of writes to particular object and field ids
    # as well as additions/removals of objects from indices.
    # key_versions specifies the object/field ids that were read to produce
    # this transaction, and which must not have changed for this transaction to be
    # accepted, and 'index_versions' provides the same thing for the indices whose
    # states we read.
    # this can come in chunks, to prevent messages getting too large.
    TransactionData={
        "writes": ConstDict(ObjectFieldId, OneOf(None, bytes)),
        "set_adds": ConstDict(IndexId, TupleOf(ObjectId)),
        "set_removes": ConstDict(IndexId, TupleOf(ObjectId)),
        "key_versions": TupleOf(ObjectFieldId),
        "index_versions": TupleOf(IndexId),
        "transaction_guid": int,
    },
    # indicate that a transaction is complete. 'as_of_version' specifies the
    # transaction id that this was based off of.
    CompleteTransaction={"as_of_version": int, "transaction_guid": int},
    # sent periodically to keep the connection alive.
    Heartbeat={},
    # define a collection of types as we know them. The server will respond with
    # a mapping indicating how each type and field is matched to a fieldId.
    DefineSchema={"name": str, "definition": SchemaDefinition},
    # indicate we want to load a particular object. The server will respond with a
    # LazyLoadResponse providing the definition of the values.
    LoadLazyObject={"schema": str, "typename": str, "identity": ObjectId},
    # subscribe to a given type, and optionally, an index.
    # the schema and typename define the class of object. note that you may get data
    # for fields that you didn't define if somebody else has a broader definition of this
    # type.
    # the fieldname_and_value can be None, in which case this is a type-level subscription
    # or it can provide the name of an index and the index value to which we are subscribed,
    # in which case this is an index level subscription. For index-level subscriptions,
    # we'll also receive a list of object ids that contain the objects we know about. This set
    # will increase each time a value comes into our scope, and doesn't ever get smaller. The
    # server will continue to send us updates on all the objects in our scope, and the view
    # infrastructure is responsible for figuring out which objects to display.
    # if 'isLazy', then this is a 'lazy' subscription, meaning we'll get any updates on this
    # stream, but we won't get the values of the objects immediately (only their identities).
    # we have to lazy-load the objects if we want to read from them and they haven't changed.
    Subscribe={
        "schema": str,
        "typename": str,
        # send us only the subset of objects that have IndexValue as the value
        # the given field. The resulting response will contain this set of
        # identities, and we'll get a SubscriptionIncrease message every time
        # a new value gets added to our subscription
        "fieldname_and_value": OneOf(None, Tuple(str, IndexValue)),
        # load values when we first request them, instead of blocking on all the data.
        "isLazy": bool,
    },
    # send a round-trip message to the server. The server will respond with a FlushResponse.
    Flush={"guid": int},
    # Authenticate the channel. This must be the first message.
    Authenticate={"token": str},
    # request a connection id that will be dependent on 'parentId' existing.
    # this is used by proxies.
    RequestDependentConnectionId={"parentId": ObjectId, "guid": str},
    # indicate that a dependent connection id has died.
    DropDependentConnectionId={"connIdentity": ObjectId},
    # indicate that we may be getting new objects for this type
    # even if we have not subscribed to any indices.
    SubscribeNone={"schema": str, "typename": str},
    __str__=MessageToStr,
)


ServerToClient = Alternative(
    "ServerToClient",
    # initialize the connection. transaction_num indicates the current transaction ID.
    # connIdentity tells us what our own connectionObject's identity is. identity_root
    # provides a block of object ids for us to allocate from.
    Initialize={"transaction_num": int, "connIdentity": ObjectId, "identity_root": int},
    # indicate whether a transaction was successful or not. If not, provide the reason
    TransactionResult={
        "transaction_guid": int,
        "success": bool,
        "badKey": OneOf(None, ObjectFieldId, IndexId, str),
    },
    # specify how each field in a schema is mapped.
    SchemaMapping={"schema": str, "mapping": ConstDict(FieldDefinition, int)},
    # respond to a Flush message
    FlushResponse={"guid": int},
    # respond with the data for a subscription request
    SubscriptionData={
        "schema": str,
        "typename": OneOf(None, str),
        "fieldname_and_value": OneOf(None, Tuple(str, IndexValue)),
        "values": ConstDict(ObjectFieldId, OneOf(None, bytes)),  # value
        "index_values": ConstDict(ObjectFieldId, OneOf(None, IndexValue)),
        "identities": OneOf(
            None, TupleOf(ObjectId)
        ),  # the identities in play if this is an index-level subscription
    },
    # sent by the server to clients before any transaction data on not-loaded lazy
    # objects to ensure that they can correctly understand the set add/remove semantics
    LazyTransactionPriors={"writes": ConstDict(ObjectFieldId, OneOf(None, bytes))},
    # sent in response to the
    LazyLoadResponse={
        "identity": ObjectId,
        "values": ConstDict(ObjectFieldId, OneOf(None, bytes)),
    },
    # sent in response to a lazy subscription, giving object identities
    # and index membership, but not values themselves.
    LazySubscriptionData={
        "schema": str,
        "typename": OneOf(None, str),
        "fieldname_and_value": OneOf(None, Tuple(str, IndexValue)),
        "identities": TupleOf(ObjectId),
        "index_values": ConstDict(ObjectFieldId, OneOf(None, IndexValue)),
    },
    # indicate that a subscription has completed.
    SubscriptionComplete={
        "schema": str,
        "typename": OneOf(None, str),
        "fieldname_and_value": OneOf(None, Tuple(str, IndexValue)),
        "tid": int,  # marker transaction id
    },
    # indicate that a subscription is getting larger because an object
    # has moved into our subscribed set.
    SubscriptionIncrease={
        "schema": str,
        "typename": str,
        "fieldname_and_value": Tuple(str, IndexValue),
        "identities": TupleOf(ObjectId),
        "transaction_id": int,
    },
    # we've been disconnected.
    Disconnected={},
    # receive some transaction data. We may not be subscribed to all fields
    # in this transaction
    Transaction={
        "writes": ConstDict(ObjectFieldId, OneOf(None, bytes)),
        "set_adds": ConstDict(IndexId, TupleOf(ObjectId)),
        "set_removes": ConstDict(IndexId, TupleOf(ObjectId)),
        "transaction_id": int,
    },
    # respond with a dependent connection id.
    DependentConnectionId={"guid": str, "connIdentity": ObjectId, "identity_root": int},
    __str__=MessageToStr,
)
