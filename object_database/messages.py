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

    if hasattr(msg, "mapping"):
        fields["mapping"] = f"#{len(msg.mapping)}"

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
    TransactionData={
        "writes": ConstDict(ObjectFieldId, OneOf(None, bytes)),
        "set_adds": ConstDict(IndexId, TupleOf(ObjectId)),
        "set_removes": ConstDict(IndexId, TupleOf(ObjectId)),
        "key_versions": TupleOf(ObjectFieldId),
        "index_versions": TupleOf(IndexId),
        "transaction_guid": int,
    },
    CompleteTransaction={"as_of_version": int, "transaction_guid": int},
    Heartbeat={},
    DefineSchema={"name": str, "definition": SchemaDefinition},
    LoadLazyObject={"schema": str, "typename": str, "identity": ObjectId},
    Subscribe={
        "schema": str,
        "typename": str,
        "fieldname_and_value": OneOf(None, Tuple(str, IndexValue)),
        # load values when we first request them, instead of blocking on all the data.
        "isLazy": bool,
    },
    Flush={"guid": int},
    Authenticate={"token": str},
    # request a connection id that will be dependent on 'parentId' existing.
    # this is used by proxies.
    RequestDependentConnectionId={"parentId": ObjectId, "guid": str},
    DropDependentConnectionId={"connIdentity": ObjectId},
    __str__=MessageToStr,
)


ServerToClient = Alternative(
    "ServerToClient",
    Initialize={"transaction_num": int, "connIdentity": ObjectId, "identity_root": int},
    TransactionResult={
        "transaction_guid": int,
        "success": bool,
        "badKey": OneOf(None, ObjectFieldId, IndexId, str),
    },
    SchemaMapping={"schema": str, "mapping": ConstDict(FieldDefinition, int)},
    FlushResponse={"guid": int},
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
    LazyTransactionPriors={"writes": ConstDict(ObjectFieldId, OneOf(None, bytes))},
    LazyLoadResponse={
        "identity": ObjectId,
        "values": ConstDict(ObjectFieldId, OneOf(None, bytes)),
    },
    LazySubscriptionData={
        "schema": str,
        "typename": OneOf(None, str),
        "fieldname_and_value": OneOf(None, Tuple(str, IndexValue)),
        "identities": TupleOf(ObjectId),
        "index_values": ConstDict(ObjectFieldId, OneOf(None, IndexValue)),
    },
    SubscriptionComplete={
        "schema": str,
        "typename": OneOf(None, str),
        "fieldname_and_value": OneOf(None, Tuple(str, IndexValue)),
        "tid": int,  # marker transaction id
    },
    SubscriptionIncrease={
        "schema": str,
        "typename": str,
        "fieldname_and_value": Tuple(str, IndexValue),
        "identities": TupleOf(ObjectId),
        "transaction_id": int,
    },
    Disconnected={},
    Transaction={
        "writes": ConstDict(ObjectFieldId, OneOf(None, bytes)),
        "set_adds": ConstDict(IndexId, TupleOf(ObjectId)),
        "set_removes": ConstDict(IndexId, TupleOf(ObjectId)),
        "transaction_id": int,
    },
    DependentConnectionId={"guid": str, "connIdentity": ObjectId, "identity_root": int},
    __str__=MessageToStr,
)
