#   Copyright 2017-2021 object_database Authors
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


from object_database.web.cells.computed_slot import ComputedSlot
from object_database.web.cells.cell import context
from object_database import core_schema
from object_database import Schema, Index, Indexed
from object_database.view import revisionConflictRetry
from typed_python import OneOf
import time
import logging


persistent_session_state = Schema("core.active_webservice.state")


@persistent_session_state.define
class PersistentSession:
    sessionId = Indexed(str)
    connection = core_schema.Connection
    lastUpdateTimestamp = OneOf(None, float)


@persistent_session_state.define
class PersistentSessionState:
    sessionId = Indexed(str)
    name = object

    sessionIdAndName = Index("sessionId", "name")

    value = object


class SessionState(object):
    """Represents a piece of session-specific interface state. You may access state
    using attributes, which will register a dependency.

    All interactions must happen under an odb transaction.
    """

    def __init__(self, sessionId):
        self._sessionId = sessionId
        self._slots = {}

    @revisionConflictRetry
    def cleanupOldSessions(self, db, gcTimeWindow=3600):
        db.subscribeToType(PersistentSession)
        db.subscribeToType(core_schema.Connection)

        toDelete = []
        inactive = []
        toKeep = []

        with db.transaction():
            for session in PersistentSession.lookupAll():
                if not session.connection.exists() and (
                    time.time() - session.lastUpdateTimestamp > gcTimeWindow
                ):
                    toDelete.append(session.sessionId)
                else:
                    if (
                        not session.connection.exists()
                        and session.sessionId != self._sessionId
                    ):
                        logging.info("Session %s looks inactive", session.sessionId)

                        inactive.append(session.sessionId)
                    else:
                        toKeep.append(session.sessionId)

        logging.info(
            "Deleting %s of %s total sessions. %s are inactive",
            len(toDelete),
            len(toDelete) + len(toKeep) + len(inactive),
            len(inactive),
        )

        if not toDelete:
            return

        for d in toDelete:
            db.subscribeToIndex(PersistentSessionState, sessionId=d)

        for d in toDelete:
            with db.transaction():
                stateObjects = PersistentSessionState.lookupAll(sessionId=d)
                logging.info("Deleting %s values for session %s", len(stateObjects), d)

                invalidObjects = 0

                for s in stateObjects:
                    try:
                        s.delete()
                    except Exception:
                        invalidObjects += 1

                for s in PersistentSession.lookupAll(sessionId=d):
                    s.delete()

                if invalidObjects:
                    logging.warning(
                        "Failed to delete %s improperly formed objects for session %s",
                        invalidObjects,
                        d,
                    )

    @revisionConflictRetry
    def setup(self, db):
        db.subscribeToType(PersistentSession)

        with db.transaction():
            session = PersistentSession.lookupAny(sessionId=self._sessionId)

            if session is None:
                session = PersistentSession(
                    sessionId=self._sessionId,
                    connection=db.connectionObject,
                    lastUpdateTimestamp=time.time(),
                )
            else:
                session.connection = db.connectionObject
                session.lastUpdateTimestamp = time.time()

        db.subscribeToIndex(PersistentSessionState, sessionId=self._sessionId)

    def touch(self):
        session = PersistentSession.lookupAny(sessionId=self._sessionId)
        session.lastUpdateTimestamp = time.time()

    def _reset(self, cells):
        return self

    def _odbStateFor(self, name, defaultValue=None):
        if name not in self._slots:
            slot = PersistentSessionState.lookupAny(sessionIdAndName=(self._sessionId, name))
            if not slot:
                slot = PersistentSessionState(
                    sessionId=self._sessionId, name=name, value=defaultValue
                )

            self._slots[name] = slot

        return self._slots[name]

    def setdefault(self, name, value):
        self._odbStateFor(name, value)

    def set(self, name, value):
        self._odbStateFor(name).value = value

    def toggle(self, name):
        self.set(name, not self.get(name))

    def get(self, name):
        return self._odbStateFor(name).value

    def slotFor(self, key):
        return ComputedSlot(lambda: self.get(key), lambda val: self.set(key, val))


def sessionState():
    return context(SessionState)
