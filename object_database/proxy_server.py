#   Copyright 2017-2020 object_database Authors
#
#   Licensed under the Apache License, Version 2.0 (the "License");
#   you may not use this file except in compliance with the License.
#   You may obtain a copy of the License at
#
#       http://www.apache.org/licenses/LICENSE-2.0
#
#   Unless required by applicable law or agreed to in writing, software
#   distributed under the License is distributed on an "AS IS" BASIS,
#   WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
#   See the License for the specific language governing permissions and
#   limitations under the License.

"""ProxyServer

Models a Server that sits on top of another Server, and acts to pool subscription
requests. This makes it possible for several connections that all tend to
subscribe to the same schemas or types (say, the list of hosts) to share
connect to the same proxy, and only place the load of one connection on the
core server.

Usually, we'll put one ProxyServer per physical host, at least when
we are using larger hosts. This way, the centeral server doesn't get
overloaded trying to write connection data out to all the connections.
"""


import logging
import threading
import uuid
from typed_python import OneOf, NamedTuple, Dict, Set, Tuple, ConstDict, makeNamedTuple, ListOf

from .channel import ServerToClientChannel, ClientToServerChannel
from .messages import ServerToClient, ClientToServer
from .schema import (
    IndexValue,
    FieldId,
    FieldDefinition,
    ObjectId,
    ObjectFieldId,
    SchemaDefinition,
)


SubscriptionKey = NamedTuple(
    schema=str,
    typename=str,
    fieldname_and_value=OneOf(None, Tuple(str, IndexValue)),
    isLazy=bool,
)


# recall these definitions, included here for reference

# ObjectId = int
# FieldId = int
# ObjectFieldId = NamedTuple(objId=int, fieldId=int, isIndexValue=bool)
# IndexValue = bytes
# IndexId = NamedTuple(fieldId=int, indexValue=IndexValue)
# TypeDefinition = NamedTuple(fields=TupleOf(str), indices=TupleOf(str))
# SchemaDefinition = ConstDict(str, TypeDefinition)
# FieldDefinition = NamedTuple(schema=str, typename=str, fieldname=str)


class FieldIdToDefMapping:
    def __init__(self):
        self.fieldIdToDef = {}
        self.fieldDefToId = {}

    def addFieldMapping(self, fieldId: FieldId, fieldDef: FieldDefinition):
        self.fieldIdToDef[fieldId] = fieldDef
        self.fieldDefToId[fieldDef] = fieldId


class SubscriptionState:
    def __init__(self):
        # for each fieldId, the set of channels subscribed to it and vice versa
        # this is what we use to determine which channels are subscribed
        self.fieldIdToChannel = Dict(FieldId, Set(ServerToClientChannel))()
        self.channelToFieldId = Dict(ServerToClientChannel, Set(FieldId))()

        # the definition of each schema as we know it
        self.schemaDefs = Dict(str, ConstDict(FieldDefinition, FieldId))()
        # map from schema -> typename -> fieldname -> fieldId
        self.schemaTypeAndNameToFieldId = Dict(str, Dict(str, Dict(str, int)))()

        # mapping between a channel and its subscriptions
        self.channelSubscriptions = Dict(ServerToClientChannel, Set(SubscriptionKey))()
        self.subscriptionsPendingSchemaDef = Dict(
            str,
            ListOf(NamedTuple(channel=ServerToClientChannel, subscriptionKey=SubscriptionKey)),
        )()

        # the current top transaction we've ever seen.
        self.transactionId = -1

        # set of schema/typename for which we have complete subscriptions
        self.completedTypes = Set(NamedTuple(schema=str, typename=str))()

        # the state of our subscriptions
        self.objectValues = Dict(FieldId, Dict(ObjectId, bytes))()
        self.indexValues = Dict(FieldId, Dict(ObjectId, IndexValue))()

    def addSubscription(self, channel, subscriptionKey: SubscriptionKey):
        # we don't handle index, object, or lazy-level subscriptions yet
        assert subscriptionKey.fieldname_and_value is None, "Not Implemented"
        assert subscriptionKey.isLazy is False, "Not Implemented"

        self.channelSubscriptions.setdefault(channel).add(subscriptionKey)

        # if we don't have a schema def for this yet, we have to wait until we get one
        if subscriptionKey.schema not in self.schemaDefs:
            self.subscriptionsPendingSchemaDef.setdefault(subscriptionKey.schema).append(
                makeNamedTuple(channel=channel, subscriptionKey=subscriptionKey)
            )
            return

        for fieldId in self.schemaDefs[subscriptionKey.schema].values():
            self.fieldIdToChannel.setdefault(fieldId).add(channel)
            self.channelToFieldId.setdefault(channel).add(fieldId)

        if (
            makeNamedTuple(schema=subscriptionKey.schema, typename=subscriptionKey.typename)
            in self.completedTypes
        ):
            # we can send the schema data for this
            channel.sendMessage(
                ServerToClient.SubscriptionData(
                    schema=subscriptionKey.schema,
                    typename=subscriptionKey.typename,
                    fieldname_and_value=None,
                    values=self.objectValuesForSubscriptionKey(subscriptionKey),
                    index_values=self.indexValuesForSubscriptionKey(subscriptionKey),
                    identities=None,
                )
            )
            channel.sendMessage(
                ServerToClient.SubscriptionComplete(
                    schema=subscriptionKey.schema,
                    typename=subscriptionKey.typename,
                    fieldname_and_value=None,
                    tid=self.transactionId,
                )
            )

    def objectValuesForSubscriptionKey(self, subscriptionKey):
        res = Dict(ObjectFieldId, OneOf(None, bytes))()

        if subscriptionKey.schema in self.schemaTypeAndNameToFieldId:
            typenameToFieldMap = self.schemaTypeAndNameToFieldId[subscriptionKey.schema]

            if subscriptionKey.typename in typenameToFieldMap:
                for fieldId in typenameToFieldMap[subscriptionKey.typename].values():
                    for objectId, value in self.objectValues.setdefault(fieldId).items():
                        res[
                            ObjectFieldId(objId=objectId, fieldId=fieldId, isIndexValue=False)
                        ] = value

        return ConstDict(ObjectFieldId, OneOf(None, bytes))(res)

    def indexValuesForSubscriptionKey(self, subscriptionKey):
        res = Dict(ObjectFieldId, OneOf(None, bytes))()

        if subscriptionKey.schema in self.schemaTypeAndNameToFieldId:
            typenameToFieldMap = self.schemaTypeAndNameToFieldId[subscriptionKey.schema]

            if subscriptionKey.typename in typenameToFieldMap:
                for fieldId in typenameToFieldMap[subscriptionKey.typename].values():
                    for objectId, value in self.indexValues.setdefault(fieldId).items():
                        res[
                            ObjectFieldId(objId=objectId, fieldId=fieldId, isIndexValue=True)
                        ] = value

        return ConstDict(ObjectFieldId, OneOf(None, bytes))(res)

    def mapSchema(self, schemaName, schemaDef: ConstDict(FieldDefinition, FieldId)):
        assert schemaName not in self.schemaDefs

        self.schemaDefs[schemaName] = schemaDef

        for fieldDef, fieldId in schemaDef.items():
            self.schemaTypeAndNameToFieldId.setdefault(fieldDef.schema).setdefault(
                fieldDef.typename
            )[fieldDef.fieldname] = fieldId

        if schemaName in self.subscriptionsPendingSchemaDef:
            for channel in self.subscriptionsPendingSchemaDef.pop(schemaName):
                for fieldId in schemaDef.values():
                    self.fieldIdToChannel.setdefault(fieldId).add(channel)
                    self.channelToFieldId.setdefault(channel).add(fieldId)

    def handleSubscriptionData(
        self, schema, typename, fieldnameAndValue, values, indexValues, identities
    ):
        def update(dictlike, key, valueOrNone):
            if valueOrNone is None:
                if key in dictlike:
                    del dictlike[key]
            else:
                dictlike[key] = valueOrNone

        # this will always be for an entire schema
        for key, valueData in values.items():
            assert not key.isIndexValue
            update(self.objectValues.setdefault(key.fieldId), key.objId, valueData)

        for key, indexData in indexValues.items():
            assert key.isIndexValue
            update(self.indexValues.setdefault(key.fieldId), key.objId, indexData)

    def getChannelsForSchemaAndTypename(self, schema, typename):
        channels = set()

        if schema not in self.schemaTypeAndNameToFieldId:
            return channels

        if typename not in self.schemaTypeAndNameToFieldId[schema]:
            return channels

        for fieldId in self.schemaTypeAndNameToFieldId[schema][typename].values():
            if fieldId in self.fieldIdToChannel:
                channels.update(self.fieldIdToChannel[fieldId])

        return channels

    def handleSubscriptionComplete(self, schema, typename, fieldnameAndValue, tid):
        if tid > self.transactionId:
            self.transactionId = tid

        # this will always be for an entire schema
        self.completedTypes.add(makeNamedTuple(schema=schema, typename=typename))

        # figure out which channels need to see this data
        channels = self.getChannelsForSchemaAndTypename(schema, typename)

        key = SubscriptionKey(
            schema=schema,
            typename=typename,
            fieldname_and_value=fieldnameAndValue,
            isLazy=False,
        )

        msg = ServerToClient.SubscriptionData(
            schema=schema,
            typename=typename,
            fieldname_and_value=None,
            values=self.objectValuesForSubscriptionKey(key),
            index_values=self.indexValuesForSubscriptionKey(key),
            identities=None,
        )

        msg2 = ServerToClient.SubscriptionComplete(
            schema=schema, typename=typename, fieldname_and_value=None, tid=self.transactionId
        )

        for c in channels:
            c.sendMessage(msg)
            c.sendMessage(msg2)

    def handleTransaction(self, writes, set_adds, set_removes, transaction_id):
        fieldIds = Set(FieldId)()

        for objectFieldId, val in writes.items():
            fieldIds.add(objectFieldId.fieldId)

            oidMap = self.objectValues.setdefault(objectFieldId.fieldId)

            if val is None:
                oidMap.pop(objectFieldId.objId, b"")
            else:
                oidMap[objectFieldId.objId] = val

        for indexId, oids in set_removes.items():
            vals = self.indexValues.setdefault(indexId.fieldId)
            for oid in oids:
                vals.pop(oid)

        for indexId, oids in set_adds.items():
            vals = self.indexValues.setdefault(indexId.fieldId)

            for oid in oids:
                vals[oid] = indexId.indexValue

        for indexId in set_adds:
            fieldIds.add(indexId.fieldId)

        for indexId in set_removes:
            fieldIds.add(indexId.fieldId)

        channels = set()

        for f in fieldIds:
            if f in self.fieldIdToChannel:
                channels.update(self.fieldIdToChannel[f])

        if transaction_id > self.transactionId:
            self.transactionId = transaction_id

        for c in channels:
            c.sendMessage(
                ServerToClient.Transaction(
                    writes=writes,
                    set_adds=set_adds,
                    set_removes=set_removes,
                    transaction_id=transaction_id,
                )
            )


class ProxyServer:
    def __init__(self, upstreamChannel: ClientToServerChannel, authToken):
        self._upstreamChannel = upstreamChannel

        self._authToken = authToken

        self._logger = logging.getLogger(__name__)

        self._downstreamChannels = set()
        self._authenticatedDownstreamChannels = set()

        self._connectionIdentity = None
        self._identityRoot = None
        self._transactionNum = None

        self._lock = threading.RLock()

        self._deferredMessagesAndEndpoints = []

        self._upstreamChannel.setServerToClientHandler(self.handleServerToClientMessage)

        self._guidToChannelRequestingIdentity = {}

        # dictionary from (channel, schemaName) -> SchemaDefinition
        self._channelSchemas = Dict(Tuple(ServerToClientChannel, str), SchemaDefinition)()

        # the schemas we've actually defined on the server
        # map from name to SchemaDefinition
        self._definedSchemas = {}

        # map from schema name to ConstDict(FieldDefinition, int)
        # for schemas where the server has responded
        self._mappedSchemas = {}

        # for each requested schema, the set of channels waiting for it
        self._unmappedSchemasToChannels = {}

        self._fieldIdToDefMapping = FieldIdToDefMapping()

        self._subscriptionState = SubscriptionState()

        # right now, we only subscribe to entire types
        self._subscribedTypes = Set(NamedTuple(schema=str, typename=str))()

        # state machine for tracking the flush guids we're getting
        # from each channel
        self._flushGuidIx = 0
        self._outgoingFlushGuidToChannelAndFlushGuid = Dict(
            int, Tuple(ServerToClientChannel, int)
        )()

        # state machine for managing the transactions we have pending
        # on each channel
        self._transactionGuidIx = 0
        self._channelAndTransactionGuidToOutgoingTransactionGuid = Dict(
            Tuple(ServerToClientChannel, int), int
        )()
        self._outgoingTransactionGuidToChannelAndTransactionGuid = Dict(
            int, Tuple(ServerToClientChannel, int)
        )()

    @property
    def authToken(self):
        return self._authToken

    def authenticate(self):
        self._upstreamChannel.sendMessage(ClientToServer.Authenticate(token=self.authToken))

    def addConnection(self, channel: ServerToClientChannel):
        """An incoming connection is being made."""
        with self._lock:
            self._downstreamChannels.add(channel)

            channel.setClientToServerHandler(
                lambda msg: self.handleClientToServerMessage(channel, msg)
            )

    def dropConnection(self, channel: ServerToClientChannel):
        """An incoming connection has dropped."""
        with self._lock:
            self._downstreamChannels.discard(channel)
            self._authenticatedDownstreamChannels.discard(channel)

        channel.close()

    def handleClientToServerMessage(self, channel, msg: ClientToServer):
        with self._lock:
            self._handleClientToServerMessage(channel, msg)

    def _handleClientToServerMessage(self, channel, msg: ClientToServer):
        if channel not in self._downstreamChannels:
            # this channel disconnected
            return

        if self._connectionIdentity is None:
            # we are not authenticated yet.
            self._deferredMessagesAndEndpoints.append((channel, msg))
            return

        if msg.matches.Authenticate:
            if channel in self._authenticatedDownstreamChannels:
                # the channel is already authenticated
                self._logger.warn("Channel attempted to re-authenticate")
                self.dropConnection(channel)
                return

            if msg.token != self._authToken:
                self._logger.warn("Channel attempted to authenticate with invalid token.")
                self.dropConnection(channel)
                return

            self._authenticatedDownstreamChannels.add(channel)

            # we can request a new connection ID for this worker
            guid = str(uuid.uuid4())

            self._guidToChannelRequestingIdentity[guid] = channel

            self._upstreamChannel.sendMessage(
                ClientToServer.RequestDependentConnectionId(
                    parentId=self._connectionIdentity, guid=guid
                )
            )
            return

        # ensure that we're connected
        if channel not in self._authenticatedDownstreamChannels:
            self._logger.warn("Channel attempted to communicate without authenticating")
            self.dropConnection(channel)
            return

        self._handleAuthenticatedMessage(channel, msg)

    def _handleAuthenticatedMessage(self, channel, msg: ClientToServer):
        if msg.matches.DefineSchema:
            self._channelSchemas[channel, msg.name] = msg.definition

            if msg.name not in self._definedSchemas:
                self._upstreamChannel.sendMessage(
                    ClientToServer.DefineSchema(name=msg.name, definition=msg.definition)
                )
                self._definedSchemas[msg.name] = msg.definition
            else:
                if msg.definition != self._definedSchemas[msg.name]:
                    raise Exception(
                        "We don't handle multiply-defined versions of the same schema."
                    )

            if msg.name in self._mappedSchemas:
                channel.sendMessage(
                    ServerToClient.SchemaMapping(
                        schema=msg.name, mapping=self._mappedSchemas[msg.name]
                    )
                )
            else:
                self._unmappedSchemasToChannels.setdefault(msg.name, set()).add(channel)

            return

        if msg.matches.Subscribe:
            schemaAndTypename = makeNamedTuple(schema=msg.schema, typename=msg.typename)

            if (channel, msg.schema) not in self._channelSchemas:
                raise Exception(
                    f"Can't subscribe to schema {msg.schema} that we don't have "
                    f"a definition for."
                )

            subscription = SubscriptionKey(
                schema=msg.schema,
                typename=msg.typename,
                fieldname_and_value=msg.fieldname_and_value,
                isLazy=msg.isLazy,
            )

            if schemaAndTypename not in self._subscribedTypes:
                self._upstreamChannel.sendMessage(
                    ClientToServer.Subscribe(
                        schema=subscription.schema,
                        typename=subscription.typename,
                        fieldname_and_value=subscription.fieldname_and_value,
                        isLazy=msg.isLazy,
                    )
                )

                self._subscribedTypes.add(schemaAndTypename)

            self._subscriptionState.addSubscription(channel, subscription)
            return

        if msg.matches.Flush:
            self._flushGuidIx += 1
            guid = self._flushGuidIx

            self._outgoingFlushGuidToChannelAndFlushGuid[guid] = (channel, msg.guid)

            self._upstreamChannel.sendMessage(ClientToServer.Flush(guid=guid))
            return

        if msg.matches.TransactionData:
            self._transactionGuidIx += 1
            guid = self._transactionGuidIx

            self._outgoingTransactionGuidToChannelAndTransactionGuid[guid] = (
                channel,
                msg.transaction_guid,
            )
            self._channelAndTransactionGuidToOutgoingTransactionGuid[
                channel, msg.transaction_guid
            ] = guid

            self._upstreamChannel.sendMessage(
                ClientToServer.TransactionData(
                    writes=msg.writes,
                    set_adds=msg.set_adds,
                    set_removes=msg.set_removes,
                    key_versions=msg.key_versions,
                    index_versions=msg.index_versions,
                    transaction_guid=guid,
                )
            )
            return

        if msg.matches.CompleteTransaction:
            if (
                channel,
                msg.transaction_guid,
            ) not in self._channelAndTransactionGuidToOutgoingTransactionGuid:
                logging.error(
                    "Received unexpected CompleteTransaction message: %s", msg.transaction_guid
                )
                return

            guid = self._channelAndTransactionGuidToOutgoingTransactionGuid[
                channel, msg.transaction_guid
            ]

            self._upstreamChannel.sendMessage(
                ClientToServer.CompleteTransaction(
                    as_of_version=msg.as_of_version, transaction_guid=guid
                )
            )
            return

        raise Exception("Don't know how to handle ", msg)

    def handleServerToClientMessage(self, msg: ServerToClient):
        with self._lock:
            if msg.matches.Initialize:
                self._connectionIdentity = msg.connIdentity
                self._identityRoot = msg.identity_root
                self._transactionNum = msg.transaction_num

                # process any messages we received while we were not yet
                # authenticated.
                for channel, msg in self._deferredMessagesAndEndpoints:
                    self._handleClientToServerMessage(channel, msg)

                self._deferredMessagesAndEndpoints.clear()
                return

            if msg.matches.DependentConnectionId:
                guid = msg.guid

                channel = self._guidToChannelRequestingIdentity.pop(guid, None)

                if channel is None or channel not in self._downstreamChannels:
                    # channel may have disconnected
                    return None

                channel.sendMessage(
                    ServerToClient.Initialize(
                        transaction_num=self._transactionNum,
                        connIdentity=msg.connIdentity,
                        identity_root=msg.identity_root,
                    )
                )
                return

            if msg.matches.SchemaMapping:
                self._subscriptionState.mapSchema(msg.schema, msg.mapping)
                self._mappedSchemas[msg.schema] = msg.mapping

                # forward the mapping to any of our channels who need it
                for channel in self._unmappedSchemasToChannels.pop(msg.schema, set()):
                    channel.sendMessage(
                        ServerToClient.SchemaMapping(schema=msg.schema, mapping=msg.mapping)
                    )
                return

            if msg.matches.SubscriptionData:
                self._subscriptionState.handleSubscriptionData(
                    msg.schema,
                    msg.typename,
                    msg.fieldname_and_value,
                    msg.values,
                    msg.index_values,
                    msg.identities,
                )
                return

            if msg.matches.SubscriptionComplete:
                self._subscriptionState.handleSubscriptionComplete(
                    msg.schema, msg.typename, msg.fieldname_and_value, msg.tid
                )
                return

            if msg.matches.Transaction:
                self._subscriptionState.handleTransaction(
                    msg.writes, msg.set_adds, msg.set_removes, msg.transaction_id
                )
                return

            if msg.matches.FlushResponse:
                if msg.guid not in self._outgoingFlushGuidToChannelAndFlushGuid:
                    logging.error("Received unexpected flush guid: %s", msg.guid)
                    return

                channel, guid = self._outgoingFlushGuidToChannelAndFlushGuid.pop(msg.guid)

                channel.sendMessage(ServerToClient.FlushResponse(guid=guid))
                return

            if msg.matches.TransactionResult:
                if (
                    msg.transaction_guid
                    not in self._outgoingTransactionGuidToChannelAndTransactionGuid
                ):
                    logging.error(
                        "Received unexpected TransactionResult message: %s",
                        msg.transaction_guid,
                    )
                    return

                channel, guid = self._outgoingTransactionGuidToChannelAndTransactionGuid.pop(
                    msg.transaction_guid
                )

                channel.sendMessage(
                    ServerToClient.TransactionResult(
                        transaction_guid=guid, success=msg.success, badKey=msg.badKey
                    )
                )

                return

        raise Exception("Don't know how to handle ", msg)
