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
from typed_python import (
    OneOf,
    NamedTuple,
    Dict,
    Set,
    Tuple,
    ConstDict,
    makeNamedTuple,
    TupleOf,
    ListOf,
    deserialize,
)

from .channel import ServerToClientChannel, ClientToServerChannel
from .messages import ServerToClient, ClientToServer
from .server import ObjectBase
from .schema import (
    IndexValue,
    FieldId,
    FieldDefinition,
    ObjectId,
    ObjectFieldId,
    SchemaDefinition,
    TypeDefinition,
    IndexId,
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


def mergeTypeDefinition(typedef1, typedef2):
    return TypeDefinition(
        fields=typedef1.fields + [x for x in typedef2.fields if x not in typedef1.fields],
        indices=typedef1.indices + [x for x in typedef2.indices if x not in typedef1.indices],
    )


def mergeSchemaDefinitions(schemaDef1, schemaDef2):
    out = dict(schemaDef1)

    for typename, typedef in schemaDef2.items():
        if typename not in out:
            out[typename] = typedef
        else:
            out[typename] = mergeTypeDefinition(out[typename], typedef)

    return SchemaDefinition(out)


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
        self.fieldIdToSubscribedChannels = Dict(FieldId, Set(ServerToClientChannel))()
        self.channelToSubscribedFieldIds = Dict(ServerToClientChannel, Set(FieldId))()

        self.indexIdToSubscribedChannels = Dict(IndexId, Set(ServerToClientChannel))()
        self.channelToSubscribedIndexIds = Dict(ServerToClientChannel, Set(IndexId))()

        self.channelToSubscribedOids = Dict(ServerToClientChannel, Set(ObjectId))()
        self.oidToSubscribedChannels = Dict(ObjectId, Set(ServerToClientChannel))()

        self.channelToLazilySubscribedFieldIds = Dict(ServerToClientChannel, Set(FieldId))()
        self.channelToLazilySubscribedIndexIds = Dict(ServerToClientChannel, Set(IndexId))()

        # the definition of each schema as we know it
        self.schemaDefs = Dict(str, ConstDict(FieldDefinition, FieldId))()

        # the schemas we've actually defined on the server
        # map from name to SchemaDefinition
        self._definedSchemas = Dict(str, SchemaDefinition)()

        # map from schema -> typename -> fieldname -> fieldId
        self.schemaTypeAndNameToFieldId = Dict(str, Dict(str, Dict(str, int)))()
        self.fieldIdToDef = Dict(int, FieldDefinition)()

        # mapping between a channel and its subscriptions
        self.channelSubscriptions = Dict(ServerToClientChannel, Set(SubscriptionKey))()

        # subscriptions pending a schema/typname being fully subscribed
        self.channelToPendingSubscriptions = Dict(
            ServerToClientChannel, Set(SubscriptionKey)
        )()
        self.channelToPendingTransactions = Dict(
            ServerToClientChannel, ListOf(ClientToServer)
        )()
        self.subscriptionsPendingSubscriptionOnServer = Dict(
            # schema and typename
            Tuple(str, str),
            Set(Tuple(ServerToClientChannel, SubscriptionKey)),
        )()

        # the current top transaction we've ever seen.
        self.transactionId = -1

        # set of schema/typename for which we have complete subscriptions
        self.completedTypes = Set(NamedTuple(schema=str, typename=str))()

        # the state of our subscriptions
        self.objectValues = Dict(FieldId, Dict(ObjectId, bytes))()
        self.indexValues = Dict(FieldId, Dict(ObjectId, IndexValue))()
        self.reverseIndexValues = Dict(FieldId, Dict(IndexValue, Set(ObjectId)))()

    def dropConnection(self, channel: ServerToClientChannel):
        if channel in self.channelToSubscribedFieldIds:
            for fieldId in self.channelToSubscribedFieldIds[channel]:
                self.fieldIdToSubscribedChannels[fieldId].discard(channel)

            self.channelToSubscribedFieldIds.pop(channel)

        if channel in self.channelToSubscribedIndexIds:
            for fieldAndIv in self.channelToSubscribedIndexIds[channel]:
                self.indexIdToSubscribedChannels[fieldAndIv].discard(channel)
            self.channelToSubscribedIndexIds.pop(channel)

        if channel in self.channelToSubscribedOids:
            for oid in self.channelToSubscribedOids[channel]:
                self.oidToSubscribedChannels[oid].discard(channel)
                if not self.oidToSubscribedChannels[oid]:
                    self.oidToSubscribedChannels.pop(oid)

            self.channelToSubscribedOids.pop(channel)

        if channel in self.channelSubscriptions:
            self.channelSubscriptions.pop(channel)

        if channel in self.channelToPendingTransactions:
            self.channelToPendingTransactions.pop(channel)

        if channel in self.channelToPendingSubscriptions:
            for subsKey in self.channelToPendingSubscriptions[channel]:
                self.subscriptionsPendingSubscriptionOnServer[
                    subsKey.schema, subsKey.typename
                ].pop((channel, subsKey))

            self.channelToPendingSubscriptions.pop(channel)

        if channel in self.channelToLazilySubscribedFieldIds:
            self.channelToLazilySubscribedFieldIds.pop(channel)

        if channel in self.channelToLazilySubscribedIndexIds:
            self.channelToLazilySubscribedIndexIds.pop(channel)

    def addSubscription(self, channel, subscriptionKey: SubscriptionKey):
        self.channelSubscriptions.setdefault(channel).add(subscriptionKey)

        if (
            makeNamedTuple(schema=subscriptionKey.schema, typename=subscriptionKey.typename)
            in self.completedTypes
        ):
            self.sendDataForSubscription(channel, subscriptionKey)
        else:
            self.subscriptionsPendingSubscriptionOnServer.setdefault(
                (subscriptionKey.schema, subscriptionKey.typename)
            ).add((channel, subscriptionKey))
            self.channelToPendingSubscriptions.setdefault(channel).add(subscriptionKey)

    def sendDataForSubscription(self, channel, key: SubscriptionKey):
        # get the set of affected objects
        oids = self.objectIndentitiesForSubscriptionKey(key)

        if key.fieldname_and_value is not None:
            fieldname, indexValue = key.fieldname_and_value

            if fieldname != "_identity":
                fieldId = self.schemaTypeAndNameToFieldId[key.schema][key.typename][fieldname]

                self.indexIdToSubscribedChannels.setdefault((fieldId, indexValue)).add(channel)
                self.channelToSubscribedIndexIds.setdefault(channel).add((fieldId, indexValue))

                if key.isLazy:
                    self.channelToLazilySubscribedIndexIds.setdefault(channel).add(
                        IndexId(fieldId=fieldId, indexValue=indexValue)
                    )

            # and also mark the specific values its subscribed to
            self.channelToSubscribedOids[channel] = oids
            for oid in oids:
                self.oidToSubscribedChannels.setdefault(oid).add(channel)
        else:
            # subscribe this channel to all the values in this type
            for fieldId in self.schemaTypeAndNameToFieldId[key.schema][key.typename].values():
                self.fieldIdToSubscribedChannels.setdefault(fieldId).add(channel)
                self.channelToSubscribedFieldIds.setdefault(channel).add(fieldId)

                if key.isLazy:
                    self.channelToLazilySubscribedFieldIds.setdefault(channel).add(fieldId)

        if key.isLazy:
            channel.sendMessage(
                ServerToClient.LazySubscriptionData(
                    schema=key.schema,
                    typename=key.typename,
                    fieldname_and_value=key.fieldname_and_value,
                    identities=oids,
                    index_values=self.indexValuesForOids(key.schema, key.typename, oids),
                )
            )
        else:
            channel.sendMessage(
                ServerToClient.SubscriptionData(
                    schema=key.schema,
                    typename=key.typename,
                    fieldname_and_value=key.fieldname_and_value,
                    values=self.objectValuesForOids(key.schema, key.typename, oids),
                    index_values=self.indexValuesForOids(key.schema, key.typename, oids),
                    identities=None if key.fieldname_and_value is None else oids,
                )
            )

        channel.sendMessage(
            ServerToClient.SubscriptionComplete(
                schema=key.schema,
                typename=key.typename,
                fieldname_and_value=key.fieldname_and_value,
                tid=self.transactionId,
            )
        )

    def objectIndentitiesForSubscriptionKey(self, key: SubscriptionKey) -> Set(ObjectId):
        oids = Set(ObjectId)()

        if key.fieldname_and_value is not None:
            if key.fieldname_and_value[0] == "_identity":
                # this is an 'identity' subscription, which subscribes to a single object
                oids.add(deserialize(ObjectBase, key.fieldname_and_value[1])._identity)
                return oids

        if key.schema in self.schemaTypeAndNameToFieldId:
            typenameToFieldMap = self.schemaTypeAndNameToFieldId[key.schema]

            if key.typename in typenameToFieldMap:
                if key.fieldname_and_value is None:
                    for fieldId in typenameToFieldMap[key.typename].values():
                        if fieldId in self.objectValues:
                            oids.update(self.objectValues[fieldId])
                else:
                    fieldname, indexValue = key.fieldname_and_value

                    if fieldname in typenameToFieldMap[key.typename]:
                        fieldId = typenameToFieldMap[key.typename][fieldname]

                        if (
                            fieldId in self.reverseIndexValues
                            and indexValue in self.reverseIndexValues[fieldId]
                        ):
                            oids.update(self.reverseIndexValues[fieldId][indexValue])

        return oids

    def objectValuesForOids(self, schema, typename, oids):
        res = Dict(ObjectFieldId, OneOf(None, bytes))()

        if schema in self.schemaTypeAndNameToFieldId:
            typenameToFieldMap = self.schemaTypeAndNameToFieldId[schema]

            if typename in typenameToFieldMap:
                for fieldId in typenameToFieldMap[typename].values():
                    if fieldId in self.objectValues:
                        oidToVal = self.objectValues[fieldId]

                        for oid in oids:
                            if oid in oidToVal:
                                res[
                                    ObjectFieldId(
                                        objId=oid, fieldId=fieldId, isIndexValue=False
                                    )
                                ] = oidToVal[oid]

        return ConstDict(ObjectFieldId, OneOf(None, bytes))(res)

    def indexValuesForOids(self, schema, typename, oids):
        res = Dict(ObjectFieldId, OneOf(None, IndexValue))()

        if schema in self.schemaTypeAndNameToFieldId:
            typenameToFieldMap = self.schemaTypeAndNameToFieldId[schema]

            if typename in typenameToFieldMap:
                for fieldId in typenameToFieldMap[typename].values():
                    if fieldId in self.indexValues:
                        oidToVal = self.indexValues[fieldId]

                        for oid in oids:
                            if oid in oidToVal:
                                res[
                                    ObjectFieldId(
                                        objId=oid, fieldId=fieldId, isIndexValue=True
                                    )
                                ] = oidToVal[oid]

        return ConstDict(ObjectFieldId, OneOf(None, IndexValue))(res)

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
        self.schemaDefs[schemaName] = schemaDef

        for fieldDef, fieldId in schemaDef.items():
            self.schemaTypeAndNameToFieldId.setdefault(fieldDef.schema).setdefault(
                fieldDef.typename
            )[fieldDef.fieldname] = fieldId
            self.fieldIdToDef[fieldId] = fieldDef

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

            indexValueToObjects = self.reverseIndexValues.setdefault(key.fieldId)

            if indexData is not None:
                indexValueToObjects.setdefault(indexData).add(key.objId)

    def getChannelsForSchemaAndTypename(self, schema, typename):
        channels = set()

        if schema not in self.schemaTypeAndNameToFieldId:
            return channels

        if typename not in self.schemaTypeAndNameToFieldId[schema]:
            return channels

        for fieldId in self.schemaTypeAndNameToFieldId[schema][typename].values():
            if fieldId in self.fieldIdToSubscribedChannels:
                channels.update(self.fieldIdToSubscribedChannels[fieldId])

        return channels

    def handleSubscriptionComplete(self, schema, typename, fieldnameAndValue, tid):
        if tid > self.transactionId:
            self.transactionId = tid

        channelsToMessageToSend = Dict(ServerToClientChannel, ListOf(ServerToClient))()

        # this will always be for an entire schema
        self.completedTypes.add(makeNamedTuple(schema=schema, typename=typename))

        if (schema, typename) in self.subscriptionsPendingSubscriptionOnServer:
            for channel, subscriptionKey in self.subscriptionsPendingSubscriptionOnServer.pop(
                (schema, typename)
            ):
                self.channelToPendingSubscriptions[channel].discard(subscriptionKey)
                self.sendDataForSubscription(channel, subscriptionKey)

                if not self.channelToPendingSubscriptions[channel]:
                    self.channelToPendingSubscriptions.pop(channel)

                    if channel in self.channelToPendingTransactions:
                        channelsToMessageToSend[
                            channel
                        ] = self.channelToPendingTransactions.pop(channel)

        return channelsToMessageToSend

    def _increaseBroadcastTransactionToInclude(
        self, indexId, writes, set_adds, set_removes, newOids
    ):
        """Update the transaction data in 'writes', 'set_adds', 'set_removes' to contain
        all the definitions of the objects contained in newOids.
        """

        # figure out what kind of objects these are. They all came from
        # the same index id
        indexFieldDef = self.fieldIdToDef[indexId.fieldId]
        fieldnameToFieldId = self.schemaTypeAndNameToFieldId[indexFieldDef.schema][
            indexFieldDef.typename
        ]

        typeDefinition = self._definedSchemas[indexFieldDef.schema][indexFieldDef.typename]

        for fieldname in typeDefinition.fields:
            fieldId = fieldnameToFieldId[fieldname]

            if fieldId in self.objectValues:
                for oid in newOids:
                    if oid in self.objectValues[fieldId]:
                        writes[ObjectFieldId(objId=oid, fieldId=fieldId)] = self.objectValues[
                            fieldId
                        ][oid]

        for indexname in typeDefinition.indices:
            fieldId = fieldnameToFieldId[indexname]

            if fieldId in self.objectValues:
                for oid in newOids:
                    if oid in self.objectValues[fieldId]:
                        fieldVal = self.objectValues[fieldId][oid]
                        set_adds.setdefault(IndexId(fieldId=fieldId, indexValue=fieldVal)).add(
                            oid
                        )

    def handleTransaction(self, writes, set_adds, set_removes, transaction_id):
        # we may have to modify the transaction values
        writes = Dict(ObjectFieldId, OneOf(None, bytes))(writes)
        priorValues = Dict(ObjectFieldId, OneOf(None, bytes))()

        for ofi, value in writes.items():
            priorValues[ofi] = self.objectValues.setdefault(ofi.fieldId).get(ofi.objId)

        set_adds = Dict(IndexId, Set(ObjectId))(
            {k: Set(ObjectId)(v) for k, v in set_adds.items()}
        )
        set_removes = Dict(IndexId, Set(ObjectId))(
            {k: Set(ObjectId)(v) for k, v in set_removes.items()}
        )

        fieldIds = Set(FieldId)()

        oidsMentioned = Set(ObjectId)()

        # all channels that need to get the prior values of each thing
        # being written before they receive the transaction (because of
        # laziness)
        channelsTriggeredForPriors = Set(ServerToClientChannel)()

        for objectFieldId, val in writes.items():
            oidsMentioned.add(objectFieldId.objId)

            fieldIds.add(objectFieldId.fieldId)

            oidMap = self.objectValues.setdefault(objectFieldId.fieldId)

            if val is None:
                oidMap.pop(objectFieldId.objId, b"")
            else:
                oidMap[objectFieldId.objId] = val

        for indexId, oids in set_removes.items():
            vals = self.indexValues.setdefault(indexId.fieldId)
            for oid in oids:
                oidsMentioned.add(oid)
                if oid in vals:
                    vals.pop(oid)

            objectsWithThisIndexVal = self.reverseIndexValues.setdefault(
                indexId.fieldId
            ).setdefault(indexId.indexValue)

            for oid in oids:
                objectsWithThisIndexVal.discard(oid)

            if not objectsWithThisIndexVal:
                self.reverseIndexValues[indexId.fieldId].pop(indexId.indexValue)

        idsToAddToTransaction = Dict(IndexId, Set(ObjectId))()

        for indexId, oids in set_adds.items():
            vals = self.indexValues.setdefault(indexId.fieldId)

            # each channel subscribed to this indexid may need a 'SubscriptionIncrease'
            # message.
            if indexId in self.indexIdToSubscribedChannels:
                for channel in self.indexIdToSubscribedChannels[indexId]:
                    # if this channel is lazily subscribed to this index then we need to send
                    # priors for every value we're updating. We're not being careful about
                    # tracking this on a per-object basis, so in theory we could do better
                    if indexId in self.channelToLazilySubscribedIndexIds.setdefault(channel):
                        channelsTriggeredForPriors.add(channel)

                    if channel not in self.channelToSubscribedOids:
                        newOids = oids
                    else:
                        existingSet = self.channelToSubscribedOids[channel]
                        newOids = [o for o in oids if o not in existingSet]

                    if newOids:
                        self.channelToSubscribedOids.setdefault(channel).update(newOids)
                        for n in newOids:
                            self.oidToSubscribedChannels.setdefault(n).add(channel)

                        fieldDef = self.fieldIdToDef[indexId.fieldId]

                        channel.sendMessage(
                            ServerToClient.SubscriptionIncrease(
                                schema=fieldDef.schema,
                                typename=fieldDef.typename,
                                fieldname_and_value=(fieldDef.fieldname, indexId.indexValue),
                                identities=newOids,
                                transaction_id=transaction_id,
                            )
                        )

                        idsToAddToTransaction.setdefault(indexId).update(newOids)

            objectsWithThisIndexVal = self.reverseIndexValues.setdefault(
                indexId.fieldId
            ).setdefault(indexId.indexValue)

            for oid in oids:
                oidsMentioned.add(oid)
                vals[oid] = indexId.indexValue
                objectsWithThisIndexVal.add(oid)

        for indexId, oids in idsToAddToTransaction.items():
            self._increaseBroadcastTransactionToInclude(
                indexId, writes, set_adds, set_removes, oids
            )

        for indexId in set_adds:
            fieldIds.add(indexId.fieldId)

        for indexId in set_removes:
            fieldIds.add(indexId.fieldId)

        # determine which channels are affected
        channels = set()

        for f in fieldIds:
            if f in self.fieldIdToSubscribedChannels:
                channels.update(self.fieldIdToSubscribedChannels[f])

                for c in self.fieldIdToSubscribedChannels[f]:
                    if f in self.channelToLazilySubscribedFieldIds.setdefault(c):
                        channelsTriggeredForPriors.add(c)

        for oid in oidsMentioned:
            if oid in self.oidToSubscribedChannels:
                channels.update(self.oidToSubscribedChannels[oid])

        if transaction_id > self.transactionId:
            self.transactionId = transaction_id

        for channel in channelsTriggeredForPriors:
            channel.sendMessage(ServerToClient.LazyTransactionPriors(writes=priorValues))

        if channels:
            msg = ServerToClient.Transaction(
                writes=writes,
                set_adds=ConstDict(IndexId, TupleOf(ObjectId))(
                    {k: TupleOf(ObjectId)(v) for k, v in set_adds.items()}
                ),
                set_removes=ConstDict(IndexId, TupleOf(ObjectId))(
                    {k: TupleOf(ObjectId)(v) for k, v in set_removes.items()}
                ),
                transaction_id=transaction_id,
            )
            for c in channels:
                c.sendMessage(msg)

    def increaseSubscriptionIfNecessary(self, channel, set_adds, transaction_id):
        """Mark any new objects we need to track based on contents of 'set_adds'.

        When a client creates new objects, it needs to track them regardless of
        whether it's explicitly subscribed to the object.

        So we check whether any new objects are being created (set_adds with field ' exists')
        and if we're not subscribed the type we increase the subscription.
        """
        for indexId, oids in set_adds.items():
            fieldDef = self.fieldIdToDef[indexId.fieldId]

            if fieldDef.fieldname == " exists" and (
                channel not in self.fieldIdToSubscribedChannels.setdefault(indexId.fieldId)
            ):
                newIds = [
                    x
                    for x in oids
                    if x not in self.channelToSubscribedOids.setdefault(channel)
                ]

                if newIds:
                    self.channelToSubscribedOids[channel].update(newIds)
                    for oid in newIds:
                        self.oidToSubscribedChannels.setdefault(oid).add(channel)

                    channel.sendMessage(
                        ServerToClient.SubscriptionIncrease(
                            schema=fieldDef.schema,
                            typename=fieldDef.typename,
                            fieldname_and_value=(fieldDef.fieldname, indexId.indexValue),
                            identities=newIds,
                            transaction_id=transaction_id,
                        )
                    )

    def lazyLoadObject(self, channel, schema, typename, identity):
        channel.write(
            ServerToClient.LazyLoadResponse(
                identity=identity,
                values=self.objectValuesForOids(schema, typename, [identity]),
            )
        )


class ProxyServer:
    def __init__(self, upstreamChannel: ClientToServerChannel, authToken):
        self._channelToMainServer = upstreamChannel

        self._authToken = authToken

        self._logger = logging.getLogger(__name__)

        self._downstreamChannels = set()
        self._authenticatedDownstreamChannels = set()

        self._connectionIdentity = None
        self._identityRoot = None
        self._transactionNum = None

        self._lock = threading.RLock()

        self._deferredMessagesAndEndpoints = []

        self._channelToMainServer.setServerToClientHandler(self.handleServerToClientMessage)

        self._guidToChannelRequestingIdentity = {}

        self._channelToMissedHeartbeatCount = Dict(ServerToClientChannel, int)()

        self._channelToConnectionId = Dict(ServerToClientChannel, ObjectId)()

        # dictionary from (channel, schemaName) -> SchemaDefinition
        self._channelSchemas = Dict(Tuple(ServerToClientChannel, str), SchemaDefinition)()

        # map from schema name to iteration number to ConstDict(FieldDefinition, int)
        self._mappedSchemas = Dict(str, Dict(int, ConstDict(FieldDefinition, FieldId)))()
        self._requestedSchemaIteration = Dict(str, int)()
        self._receivedSchemaIteration = Dict(str, int)()

        # for each requested (schema, iteration), the set of channels waiting for it
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
        self._channelToMainServer.sendMessage(
            ClientToServer.Authenticate(token=self.authToken)
        )

    def addConnection(self, channel: ServerToClientChannel):
        """An incoming connection is being made."""
        with self._lock:
            self._downstreamChannels.add(channel)
            self._channelToMissedHeartbeatCount[channel] = 0

            channel.setClientToServerHandler(
                lambda msg: self.handleClientToServerMessage(channel, msg)
            )

    def dropConnection(self, channel: ServerToClientChannel):
        """An incoming connection has dropped."""
        with self._lock:
            if channel not in self._downstreamChannels:
                return

            self._subscriptionState.dropConnection(channel)
            self._downstreamChannels.discard(channel)
            del self._channelToMissedHeartbeatCount[channel]
            self._authenticatedDownstreamChannels.discard(channel)

            if channel in self._channelToConnectionId:
                connId = self._channelToConnectionId.pop(channel)

                self._channelToMainServer.sendMessage(
                    ClientToServer.DropDependentConnectionId(connIdentity=connId)
                )

        channel.close()

    def handleClientToServerMessage(self, channel, msg: ClientToServer):
        with self._lock:
            self._handleClientToServerMessage(channel, msg)

    def checkForDeadConnections(self):
        with self._lock:
            for c in list(self._channelToMissedHeartbeatCount):
                self._channelToMissedHeartbeatCount[c] += 1

                if self._channelToMissedHeartbeatCount[c] >= 4:
                    logging.info(
                        "Connection %s has not heartbeat in a long time. Killing it.",
                        self._channelToConnectionId.get(c),
                    )

                    c.close()

                    self.dropConnection(c)

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

            self._channelToMainServer.sendMessage(
                ClientToServer.RequestDependentConnectionId(
                    parentId=self._connectionIdentity, guid=guid
                )
            )
            return

        # ensure that we're connected
        if channel not in self._authenticatedDownstreamChannels:
            # don't worry about heartbeats
            if msg.matches.Heartbeat:
                return

            self._logger.warn(
                "Channel attempted to communicate without authenticating: %s", type(msg)
            )
            self.dropConnection(channel)
            return

        self._handleAuthenticatedMessage(channel, msg)

    def _handleAuthenticatedMessage(self, channel, msg: ClientToServer):
        if msg.matches.DefineSchema:
            self._channelSchemas[channel, msg.name] = msg.definition

            if msg.name not in self._subscriptionState._definedSchemas:
                self._requestedSchemaIteration[msg.name] = 0
                self._channelToMainServer.sendMessage(
                    ClientToServer.DefineSchema(name=msg.name, definition=msg.definition)
                )
                self._subscriptionState._definedSchemas[msg.name] = msg.definition
            else:
                if msg.definition != self._subscriptionState._definedSchemas[msg.name]:
                    biggerSchema = mergeSchemaDefinitions(
                        self._subscriptionState._definedSchemas[msg.name], msg.definition
                    )

                    # if the schema contains new fields we need to send this message and
                    # enlarge the schema definition
                    if biggerSchema != self._subscriptionState._definedSchemas[msg.name]:
                        self._requestedSchemaIteration[msg.name] += 1
                        self._channelToMainServer.sendMessage(
                            ClientToServer.DefineSchema(name=msg.name, definition=biggerSchema)
                        )
                        self._subscriptionState._definedSchemas[msg.name] = biggerSchema

            schemaIteration = self._requestedSchemaIteration[msg.name]

            if (
                msg.name in self._mappedSchemas
                and schemaIteration in self._mappedSchemas[msg.name]
            ):
                channel.sendMessage(
                    ServerToClient.SchemaMapping(
                        schema=msg.name, mapping=self._mappedSchemas[msg.name][schemaIteration]
                    )
                )
            else:
                self._unmappedSchemasToChannels.setdefault(
                    (msg.name, schemaIteration), set()
                ).add(channel)

            return

        if msg.matches.SubscribeNone:
            schemaAndTypename = makeNamedTuple(schema=msg.schema, typename=msg.typename)

            if schemaAndTypename not in self._subscribedTypes:
                self._channelToMainServer.sendMessage(
                    ClientToServer.Subscribe(
                        schema=msg.schema,
                        typename=msg.typename,
                        fieldname_and_value=None,
                        isLazy=False,
                    )
                )

                self._subscribedTypes.add(schemaAndTypename)
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
                self._channelToMainServer.sendMessage(
                    ClientToServer.Subscribe(
                        schema=subscription.schema,
                        typename=subscription.typename,
                        fieldname_and_value=None,
                        isLazy=False,
                    )
                )

                self._subscribedTypes.add(schemaAndTypename)

            self._subscriptionState.addSubscription(channel, subscription)
            return

        if msg.matches.Flush:
            self._flushGuidIx += 1
            guid = self._flushGuidIx

            self._outgoingFlushGuidToChannelAndFlushGuid[guid] = (channel, msg.guid)

            self._channelToMainServer.sendMessage(ClientToServer.Flush(guid=guid))
            return

        if msg.matches.LoadLazyObject:
            if (
                makeNamedTuple(schema=msg.schema, typename=msg.typename)
                not in self._subscriptionState.completedTypes
            ):
                logging.error("Client tried to lazy load for a type we're not subscribed to")
                self.dropConnection(channel)
                return

            self._subscriptionState.lazyLoadObject(
                channel, msg.schema, msg.typename, msg.identity
            )
            return

        if msg.matches.TransactionData:
            if channel in self._subscriptionState.channelToPendingSubscriptions:
                assert self._subscriptionState.channelToPendingSubscriptions[channel]
                self._subscriptionState.channelToPendingTransactions.setdefault(
                    channel
                ).append(msg)
                return

            if (
                channel,
                msg.transaction_guid,
            ) in self._channelAndTransactionGuidToOutgoingTransactionGuid:
                guid = self._channelAndTransactionGuidToOutgoingTransactionGuid[
                    channel, msg.transaction_guid
                ]
            else:
                self._transactionGuidIx += 1
                guid = self._transactionGuidIx

                self._outgoingTransactionGuidToChannelAndTransactionGuid[guid] = (
                    channel,
                    msg.transaction_guid,
                )
                self._channelAndTransactionGuidToOutgoingTransactionGuid[
                    channel, msg.transaction_guid
                ] = guid

            self._subscriptionState.increaseSubscriptionIfNecessary(
                channel, msg.set_adds, self._transactionNum
            )

            self._channelToMainServer.sendMessage(
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
            if channel in self._subscriptionState.channelToPendingSubscriptions:
                assert self._subscriptionState.channelToPendingSubscriptions[channel]
                self._subscriptionState.channelToPendingTransactions.setdefault(
                    channel
                ).append(msg)
                return

            if (
                channel,
                msg.transaction_guid,
            ) not in self._channelAndTransactionGuidToOutgoingTransactionGuid:
                logging.error(
                    "Received unexpected CompleteTransaction message: %s", msg.transaction_guid
                )
                return

            guid = self._channelAndTransactionGuidToOutgoingTransactionGuid.pop(
                (channel, msg.transaction_guid)
            )

            self._channelToMainServer.sendMessage(
                ClientToServer.CompleteTransaction(
                    as_of_version=msg.as_of_version, transaction_guid=guid
                )
            )
            return

        if msg.matches.Heartbeat:
            if channel in self._downstreamChannels:
                self._channelToMissedHeartbeatCount[channel] = 0
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
                    # the channel was disconnected before we processed the message.
                    # just send the drop back.
                    self._channelToMainServer.sendMessage(
                        ClientToServer.DropDependentConnectionId(connIdentity=msg.connIdentity)
                    )
                    return None

                self._channelToConnectionId[channel] = msg.connIdentity

                channel.sendMessage(
                    ServerToClient.Initialize(
                        transaction_num=self._transactionNum,
                        connIdentity=msg.connIdentity,
                        identity_root=msg.identity_root,
                    )
                )
                return

            if msg.matches.SchemaMapping:
                assert msg.schema in self._requestedSchemaIteration
                schemaIteration = self._receivedSchemaIteration.get(msg.schema, -1) + 1
                self._receivedSchemaIteration[msg.schema] = schemaIteration

                self._subscriptionState.mapSchema(msg.schema, msg.mapping)
                self._mappedSchemas.setdefault(msg.schema)[schemaIteration] = msg.mapping

                # forward the mapping to any of our channels who need it
                for channel in self._unmappedSchemasToChannels.pop(
                    (msg.schema, schemaIteration), set()
                ):
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
                channelsToMessageToSend = self._subscriptionState.handleSubscriptionComplete(
                    msg.schema, msg.typename, msg.fieldname_and_value, msg.tid
                )

                for channel, messages in channelsToMessageToSend.items():
                    for msg in messages:
                        self.handleClientToServerMessage(channel, msg)
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
