#   Copyright 2017-2022 object_database Authors
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
from object_database.web.cells.cell import FocusableCell
from object_database.web.cells.subscribed import Subscribed
from object_database.web.cells.slot import Slot
from object_database.web.cells.reactor import SlotWatcher
from object_database.core_schema import core_schema
from object_database.web.cells.editor.event_model import (
    eventsAreOnSameLine,
    eventsAreInSameUndoStream,
    collapseEvents,
    computeUndoEvents,
    computeRedoEvents,
    eventIsValidInContextOfLines,
    eventsAreValidInContextOfLines,
    computeStateFromEvents,
)

import logging
import time
import uuid


def compressState(state, maxTimestamp, maxWordUndos=1000, maxLineUndos=10000):
    """Compress events so that the state doesn't build up.

    Args:
        state - a dict(lines,events=,topEventIndex) state model
        maxWordUndos - the maximum number of single-word undo events to tolerate
        maxLineUndos - the maximum number of line-level undos to tolerate
    """
    lines = list(state["lines"])
    events = list(state["events"])

    i = len(events) - 1
    eventsKept = 0

    while i > 0 and eventsKept < maxLineUndos:
        if maxTimestamp is None or events[i]["timestamp"] < maxTimestamp:
            if eventsAreInSameUndoStream(events[i - 1], events[i]):
                events[i - 1] = collapseEvents(events[i - 1], events[i])
                events[i] = None
            elif eventsAreOnSameLine(events[i - 1], events[i]) and eventsKept > maxWordUndos:
                events[i - 1] = collapseEvents(events[i - 1], events[i])
                events[i] = None
            else:
                eventsKept += 1

        i -= 1

    if i > 0:
        logging.info("Folding %s events into the tail", i)
        # chop off the top events
        lines = computeStateFromEvents(lines, events[:i]).split("\n")
        events = events[i:]

    events = tuple([x for x in events if x is not None])

    if len(events) != len(state["events"]):
        logging.info("Compressed %s events to %s", len(state["events"]), len(events))

    # verify we didn't change the final event state
    state1 = computeStateFromEvents(state["lines"], state["events"])
    state2 = computeStateFromEvents(lines, events)

    assert state1 == state2, (state1, state2)

    return dict(lines=lines, topEventIndex=state["topEventIndex"], events=events)


def collapseStateToTopmost(state):
    lines = list(state["lines"])

    for event in state["events"]:
        for change in event["changes"]:
            ix = change["lineIndex"]
            lines[ix : ix + len(change["oldLines"])] = change["newLines"]

    return dict(lines=lines, events=(), topEventIndex=state["topEventIndex"])


class EditorStateBase:
    def getStateSlot(self):
        def getState():
            return dict(lines=self.lines, topEventIndex=self.topEventIndex, events=self.events)

        def setState(val):
            self.lines = val["lines"]
            self.topEventIndex = val["topEventIndex"]
            self.events = val["events"]

        return ComputedSlot(getState, setState)

    def getUserSelectionStateSlot(self):
        def getState():
            return self.userSelectionData

        def setState(val):
            self.userSelectionData = val

        return ComputedSlot(getState, setState)

    def getCurrentState(self):
        return computeStateFromEvents(self.lines, self.events)

    def setCurrentState(self, newBuffer):
        event = computeDeltaEvent(self.getCurrentState(), newBuffer, "server")

        if event is None:
            return

        self.topEventIndex += 1
        self.events = self.events + (event,)

    def lineRangeForSection(self, sectionHeader, sectionNumber):
        lines = self.getCurrentState().split("\n")

        for i in range(len(lines)):
            if i == sectionHeader:
                if sectionNumber > 0:
                    sectionNumber -= 1
                else:
                    for j in range(i + 1, len(lines)):
                        if lines[j].startswith("# - "):
                            return (i, j)

                    return (i, len(lines))

        return None


class SlotEditorState(EditorStateBase):
    def __init__(self, initialText=""):
        self.dataSlot = Slot(
            dict(
                lines=tuple(initialText.split("\n")),
                topEventIndex=0,
                events=(),
                userSelectionData={},
            )
        )

    @property
    def lines(self):
        return self.dataSlot.get()["lines"]

    @lines.setter
    def lines(self, newValue):
        val = dict(self.dataSlot.get())
        val["lines"] = newValue
        self.dataSlot.set(val)

    @property
    def topEventIndex(self):
        return self.dataSlot.get()["topEventIndex"]

    @topEventIndex.setter
    def topEventIndex(self, newValue):
        val = dict(self.dataSlot.get())
        val["topEventIndex"] = newValue
        self.dataSlot.set(val)

    @property
    def events(self):
        return self.dataSlot.get()["events"]

    @events.setter
    def events(self, newValue):
        val = dict(self.dataSlot.get())
        val["events"] = newValue
        self.dataSlot.set(val)

    @property
    def userSelectionData(self):
        return self.dataSlot.get()["userSelectionData"]

    @userSelectionData.setter
    def userSelectionData(self, newValue):
        val = dict(self.dataSlot.get())
        val["userSelectionData"] = newValue
        self.dataSlot.set(val)


class OdbEditorState(EditorStateBase):
    """An adaptor to hold the state of the editor in the ODB."""

    def __init__(
        self, storageObject, linesName, topEventIndexName, eventsName, userSelectionDataName
    ):
        self.storageObject = storageObject
        self.linesName = linesName
        self.topEventIndexName = topEventIndexName
        self.eventsName = eventsName
        self.userSelectionDataName = userSelectionDataName

    @property
    def lines(self):
        return getattr(self.storageObject, self.linesName) or ("",)

    @lines.setter
    def lines(self, newValue):
        setattr(self.storageObject, self.linesName, newValue)

    @property
    def topEventIndex(self):
        return getattr(self.storageObject, self.topEventIndexName) or 0

    @topEventIndex.setter
    def topEventIndex(self, newValue):
        setattr(self.storageObject, self.topEventIndexName, newValue)

    @property
    def events(self):
        return getattr(self.storageObject, self.eventsName) or ()

    @events.setter
    def events(self, newValue):
        setattr(self.storageObject, self.eventsName, newValue)

    @property
    def userSelectionData(self):
        return getattr(self.storageObject, self.userSelectionDataName) or {}

    @userSelectionData.setter
    def userSelectionData(self, newValue):
        setattr(self.storageObject, self.userSelectionDataName, newValue)


def computeDeltaEvent(curContents, newContents, reason):
    curContents = curContents.split("\n")
    newContents = newContents.split("\n")

    if curContents == newContents:
        return

    i = 0
    while i < len(curContents) and i < len(newContents):
        if curContents[i] == newContents[i]:
            i += 1
        else:
            break

    j = 0

    while (
        j < len(curContents)
        and j < len(newContents)
        and i + j < len(curContents)
        and i + j < len(newContents)
    ):
        if curContents[len(curContents) - 1 - j] == newContents[len(newContents) - 1 - j]:
            j += 1
        else:
            break

    return dict(
        changes=[
            dict(
                lineIndex=i,
                oldLines=curContents[i : len(curContents) - j],
                newLines=newContents[i : len(newContents) - j],
            )
        ],
        startCursors=[dict(pos=[len(curContents) - j, 0], tail=[i, 0], desiredCol=0)],
        newCursors=[dict(pos=[len(newContents) - j, 0], tail=[i, 0], desiredCol=0)],
        timestamp=time.time(),
        undoState=None,
        editSessionId=None,
        reason=reason,
    )


class Editor(FocusableCell):
    """Produce a collaborative text-editor"""

    def __init__(
        self,
        editorState=None,
        selectionSlot=None,
        firstLineSlot=None,
        lastLineSlot=None,
        username=None,
        commitDelay=None,
        readOnly=False,
        darkMode=False,
        sectionDisplayFun=None,
        overlayDisplayFun=None,
        splitFractionSlot=None,
    ):
        """Initialize a collaborative code editor.

        Args:
            editorState - an EditorState instance. If None, we'll use a Slot.
            selectionSlot - if None, then create one. A Slot object that holds the current
                user's selection. The value will be a list of
                    [{pos:[line,col], tail:[line, col], desiredCol: int}]
                containing the user's current selection. line and col are zero based. pos is
                the active cursor position and tail is the start of any current selection.
            firstLineSlot - if None, then create one. A slot object holding the position of
                the first visible line.
            lastLineSlot - if None, then create one. A slot object holding the position of
                the last visible line.
            username - None, or a string indicating the username to display for all selections
                owned by this user.
            commitDelay - if not None, then the number of milliseconds since events were
                created before we send them to the server
            readOnly - if True, we don't allow changes to the data
            darkMode - sets the editors color scheme
            sectionDisplayFun - if not None, a function of (headerLine, incidenceNumber)
                that should produce a cell that displays the contents of the section indicated.
            overlayDisplayFun - a function that we call to determine if we should draw
                an overlay where all the section header cells normally go.
        """
        super().__init__()

        if editorState is not None:
            assert isinstance(editorState, EditorStateBase)
            self.editorState = editorState
        else:
            self.editorState = SlotEditorState()

        self.stateSlot = self.editorState.getStateSlot()
        self.stateSlotWatcher = SlotWatcher(self.stateSlot, self.onStateSlotChanged)
        self.reactors.add(self.stateSlotWatcher)

        self.lastLineSlot = lastLineSlot or Slot()

        self.firstLineSlot = firstLineSlot or self.sessionStateSlot(
            "EditorStateFirstVisibleRow"
        )
        self.firstLineSlotWatcher = SlotWatcher(
            self.firstLineSlot, self.onFirstLineSlotChanged
        )
        self.reactors.add(self.firstLineSlotWatcher)

        self.selectionSlot = selectionSlot or self.sessionStateSlot(
            "EditorStateSelectionState"
        )
        self.selectionSlotWatcher = SlotWatcher(
            self.selectionSlot, self.onSelectionSlotChanged
        )
        self.reactors.add(self.selectionSlotWatcher)

        self.splitFractionSlot = splitFractionSlot or self.sessionStateSlot("SplitFraction")

        # storage for the username
        self.username = username

        # user-selection-slot data. This holds a dictionary from "editSessionId"
        # to a representation of each cursor that's active in the current document including
        #    lastUpdateTimestamp - the timestamp when this selection was last changed
        #    connId - the connection id associated. If this connection gets removed, then
        #           we can GC the selection
        #    selectionState - a json representation of the current set of cursors for this
        #           user
        #    username - the username associated. We'll display this in the editor.
        self.userSelectionSlot = self.editorState.getUserSelectionStateSlot()
        self.userSelectionSlotWatcher = SlotWatcher(
            self.userSelectionSlot, self.onUserSelectionSlotChanged
        )
        self.reactors.add(self.userSelectionSlotWatcher)

        self.sentEventIndex = None

        # None, or a pair [tIdLow, tIdHi] containing a contiguous (inclusive) range of
        # transactions ids that are ours. Any transactions with a server ID in this range
        # will be considered valid.
        self.transactionStartSeqNum = None

        self.editSessionId = str(uuid.uuid4())

        self.commitDelay = commitDelay

        self.contentsSlot = ComputedSlot(self.getCurrentContents, self.setContents)

        self.readOnly = readOnly

        self.everCalculated = False

        self.darkMode = darkMode

        self.overlayDisplayFun = overlayDisplayFun

        self.sectionDisplayFun = sectionDisplayFun

    def prepareForReuse(self):
        self.everCalculated = False

    def scrollTo(self, firstLine):
        """Scroll so that 'firstLine' is the first visible line"""
        self.firstLineSlot.set(firstLine)

    def ensureVisible(self, lineNumber, buffer=1):
        """Ensure that lineNumber is visible with at least 'buffer' lines above/below it."""
        firstLine = self.firstLineSlot.get()
        lastLine = self.lastLineSlot.get() or (firstLine + 2)

        height = lastLine - firstLine

        if lineNumber < firstLine:
            self.scrollTo(max(lineNumber - buffer, 0))
        elif lineNumber > lastLine:
            self.scrollTo(max(lineNumber - height + buffer, 0))

    def navigateTo(self, pos, tail=None):
        """Set the selection to point at headPt and make sure its onscreen.

        Args:
            pos - a tuple (line, col) where the cursor should be
            tail - if not None, the tail of the selection
        """
        if (
            not isinstance(pos, tuple)
            or len(pos) != 2
            or not isinstance(pos[0], int)
            or not isinstance(pos[1], int)
        ):
            raise Exception("pos should be a tuple of two ints")

        if tail is None:
            tail = pos

        if (
            not isinstance(tail, tuple)
            or len(tail) != 2
            or not isinstance(tail[0], int)
            or not isinstance(tail[1], int)
        ):
            raise Exception("tail should be a tuple of two ints")

        newSelSlot = [dict(pos=pos, tail=tail, desiredCol=pos[1])]

        self.selectionSlot.set(newSelSlot)
        self.onSelectionSlotChanged(None, newSelSlot, "navigateTo")

        self.ensureVisible(pos[0], 10)

    def setContents(self, newContents):
        event = computeDeltaEvent(self.getCurrentContents(), newContents, "server-push")

        if event is None:
            return

        curState = dict(self._getCurrentState())

        if not eventIsValidInContextOfLines(event, curState["lines"], curState["events"]):
            raise Exception("Computed an invalid event somehow")

        curState["events"] = curState["events"] + (event,)
        curState["topEventIndex"] += 1

        self.stateSlot.set(curState)

    def onRemovedFromTree(self):
        if self.userSelectionSlot is not None:

            def removeSelf():
                content = dict(self.userSelectionSlot.get())
                content.pop(self.editSessionId, None)
                self.userSelectionSlot.set(content)

            self.cells.scheduleCallback(removeSelf)

    def getCurrentContents(self):
        state = self.stateSlot.get()
        if state is None:
            return ""

        lines = list(state["lines"])
        for event in state["events"]:
            for change in event["changes"]:
                ix = change["lineIndex"]
                lines[ix : ix + len(change["oldLines"])] = change["newLines"]

        return "\n".join(lines)

    def onUserSelectionSlotChanged(self, oldVal, val):
        # send this up to the client
        if val:
            self.scheduleMessage(
                dict(
                    userSelectionSlotChanged=True,
                    userSelections={k: v for k, v in val.items() if k != self.editSessionId},
                )
            )

    def onStateSlotChanged(self, oldVal, val):
        serverState = self._getCurrentState()

        if self.sentEventIndex > serverState["topEventIndex"]:
            # somehow we got into a bad state
            self.scheduleMessage({"resetState": collapseStateToTopmost(serverState)})
            self.sentEventIndex = serverState["topEventIndex"]
            logging.warning("Client %s completely resetting state", self.editSessionId)

        elif self.sentEventIndex != serverState["topEventIndex"]:
            # tell the server that events have happened underneath it
            eventsSinceLastBroadcast = serverState["topEventIndex"] - self.sentEventIndex

            if eventsSinceLastBroadcast:
                if len(serverState["events"]) >= eventsSinceLastBroadcast:
                    self.scheduleMessage(
                        {"acceptedEvents": serverState["events"][-eventsSinceLastBroadcast:]}
                    )

                    for event in serverState["events"][-eventsSinceLastBroadcast:]:
                        if event["editSessionId"] == self.editSessionId:
                            # this is our event
                            if self.transactionStartSeqNum is None:
                                self.transactionStartSeqNum = (
                                    self.sentEventIndex,
                                    self.sentEventIndex + 1,
                                )
                            else:
                                self.transactionStartSeqNum = (
                                    self.transactionStartSeqNum[0],
                                    self.transactionStartSeqNum[1] + 1,
                                )
                        else:
                            self.transactionStartSeqNum = None

                        self.sentEventIndex += 1

                    assert self.sentEventIndex == serverState["topEventIndex"]
                else:
                    logging.warning("Client %s completely resetting state", self.editSessionId)

                    self.scheduleMessage({"resetState": serverState})

                    self.sentEventIndex = serverState["topEventIndex"]

    def triggerUndoOrRedo(self, isUndo):
        currentState = self._getCurrentState()

        if isUndo:
            newEvents = computeUndoEvents(currentState["events"], self.editSessionId)
        else:
            newEvents = computeRedoEvents(currentState["events"], self.editSessionId)

        if newEvents:
            if not eventsAreValidInContextOfLines(
                newEvents, currentState["lines"], currentState["events"]
            ):
                raise Exception("Computed invalid undo events")

            currentState = dict(currentState)
            currentState["events"] = currentState["events"] + tuple(newEvents)
            currentState["topEventIndex"] += 1

            logging.info("Pushing an %s event: %s", "undo" if isUndo else "redo", newEvents)

            self.stateSlot.set(currentState)
        else:
            logging.info("Can't build an %s event", "undo" if isUndo else "redo")

    def onMessage(self, messageFrame):
        if (
            messageFrame.get("msg") == "triggerRedo"
            or messageFrame.get("msg") == "triggerUndo"
        ):
            self.triggerUndoOrRedo(messageFrame.get("msg") == "triggerUndo")

        if messageFrame.get("msg") == "selectionState":
            self.firstLineSlotWatcher.setWithoutChange(messageFrame.get("topLineNumber"))
            self.lastLineSlot.set(messageFrame.get("bottomLineNumber"))
            self.selectionSlotWatcher.setWithoutChange(messageFrame.get("currentCursors"))
            self.splitFractionSlot.set(messageFrame.get("splitFraction"))

            # tell the world about our selection!
            if self.userSelectionSlot is not None and self.username is not None:
                curSlotContents = self.userSelectionSlot.get()
                if curSlotContents is None:
                    curSlotContents = {}

                curSlotContents = dict(curSlotContents)
                curSlotContents[self.editSessionId] = dict(
                    lastUpdateTimestamp=time.time(),
                    connId=self.cells.db.connectionObject._identity,
                    selectionState=messageFrame.get("currentCursors"),
                    username=self.username,
                )

                for sessId in list(curSlotContents):
                    if sessId != self.editSessionId:
                        if not core_schema.Connection.fromIdentity(
                            curSlotContents[sessId]["connId"]
                        ).exists():
                            curSlotContents.pop(sessId)

                self.userSelectionSlot.set(curSlotContents)

        if messageFrame.get("msg") == "newEvent":
            if self.readOnly:
                raise Exception("Can't accept events for a read-only buffer.")

            topEventIndex = messageFrame.get("topEventIndex")
            event = messageFrame.get("event")

            for change in event["changes"]:
                assert isinstance(change["lineIndex"], int), change["lineIndex"]

            currentState = self._getCurrentState()

            isValidIndex = topEventIndex == currentState["topEventIndex"]

            if not isValidIndex and self.transactionStartSeqNum is not None:
                if (
                    self.transactionStartSeqNum[0] <= topEventIndex
                    and topEventIndex <= self.transactionStartSeqNum[1]
                ):
                    isValidIndex = True

            if isValidIndex:
                if not eventIsValidInContextOfLines(
                    event, currentState["lines"], currentState["events"]
                ):
                    self.scheduleMessage({"resetState": collapseStateToTopmost(currentState)})
                    self.sentEventIndex = currentState["topEventIndex"]
                    logging.warning("Client %s completely resetting state", self.editSessionId)
                else:
                    newState = dict(
                        lines=currentState["lines"],
                        topEventIndex=currentState["topEventIndex"] + 1,
                        events=currentState["events"] + (event,),
                    )

                    if len(newState["events"]) % 100 == 0:
                        t0 = time.time()
                        newState = compressState(newState, time.time() - 10)
                        if time.time() - t0 > 0.01:
                            logging.info(
                                "Spent %s compressing editor state to %s events",
                                time.time() - t0,
                                len(newState["events"]),
                            )

                    self.stateSlot.set(newState)
            else:
                logging.warning(
                    "Dropping event %s from %s on the ground",
                    topEventIndex,
                    self.editSessionId,
                )

    def _getCurrentState(self):
        state = self.stateSlot.getWithoutRegisteringDependency()

        if state is None:
            return dict(lines=("",), topEventIndex=0, events=())

        return state

    def recalculateSections(self):
        if self.overlayDisplayFun:
            disp = self.overlayDisplayFun()

            if disp is not None:
                for child in list(self.children.names()):
                    if child != "_overlay":
                        self.children.removeChildNamed(child)

                if not self.children.hasChildNamed("_overlay"):
                    self.children["_overlay"] = Subscribed(self.overlayDisplayFun)

                return

        if self.children.hasChildNamed("_overlay"):
            self.children.removeChildNamed("_overlay")

        if self.sectionDisplayFun is None:
            return

        state = self.getCurrentContents().split("\n")

        topLine = self.firstLineSlot.get() or 0
        lastLine = self.lastLineSlot.get() or 0
        viewHeight = max(lastLine - topLine, 10)

        topLine = max(topLine - viewHeight, 0)
        lastLine = min(lastLine + viewHeight, len(state))

        sectionCount = {}
        sectionKeys = set()

        # indices of each section header that's visible to us
        sectionLineIndices = [ix for ix in range(0, lastLine) if state[ix].startswith("# - ")]

        for sectionIx, lineIx in enumerate(sectionLineIndices):
            sectionName = state[lineIx]

            if sectionName not in sectionCount:
                sectionCount[sectionName] = 0
            else:
                sectionCount[sectionName] += 1

            sectionKey = str(sectionCount[sectionName]) + "_" + sectionName

            if (
                # if we're the last section
                sectionIx >= len(sectionLineIndices) - 1
                # or if the next section is in the bounds
                or sectionLineIndices[sectionIx + 1] >= topLine
            ):
                sectionKeys.add(sectionKey)

                if not self.children.hasChildNamed(sectionKey):
                    self.children.addChildNamed(
                        sectionKey,
                        self.makeSectionDisplay(sectionName, sectionCount[sectionName]),
                    )

        for child in list(self.children.names()):
            if child not in sectionKeys and child != "_overlay":
                assert self.children.removeChildNamed(child)

    def makeSectionDisplay(self, sectionName, sectionCount):
        return Subscribed(
            lambda: self.sectionDisplayFun(sectionName, sectionCount),
            childIdentity=(sectionName, sectionCount),
        )

    def recalculate(self):
        if self.userSelectionSlot:
            self.userSelectionSlot.get()
        self.stateSlot.get()
        self.contentsSlot.get()

        if not self.everCalculated:
            # because our comms protocol with the client is
            # not as tight as we'd like, we need to be careful
            # not to leave the 'exportData' in place (since it might
            # be large), because we send it on every frame. the javascript
            # on the other side is careful to see this only on first render
            # and then take deltas only from messages.
            self.doFirstCalc()
            self.everCalculated = True
        else:
            self.exportData.clear()

        if self.sectionDisplayFun or self.overlayDisplayFun:
            self.recalculateSections()

    def onFirstLineSlotChanged(self, oldVal, newVal):
        self.scheduleMessage(dict(firstLine=newVal))

    def onSelectionSlotChanged(self, oldVal, newVal):
        self.scheduleMessage(dict(selectionState=newVal))

    def doFirstCalc(self):
        # figure out the initial state of the editor
        initData = collapseStateToTopmost(self._getCurrentState())

        # keep track of what we first told the editor was the state of the system
        self.sentEventIndex = initData["topEventIndex"]

        logging.info("Creating editor with %s events", len(initData["events"]))

        if self.userSelectionSlot:
            self.exportData[
                "userSelectionData"
            ] = self.userSelectionSlot.getWithoutRegisteringDependency()

        self.exportData["firstLineIx"] = (
            self.firstLineSlot.getWithoutRegisteringDependency() or 0
        )
        self.exportData[
            "initialCursors"
        ] = self.selectionSlot.getWithoutRegisteringDependency()

        self.exportData["initialState"] = initData
        self.exportData["editSessionId"] = self.editSessionId
        self.exportData["commitDelay"] = self.commitDelay
        self.exportData["username"] = self.username
        self.exportData["readOnly"] = self.readOnly
        self.exportData["splitFraction"] = (
            self.splitFractionSlot.getWithoutRegisteringDependency() or 0.5
        )
        self.exportData["darkMode"] = self.darkMode
        self.exportData["hasSectionHeaders"] = bool(
            self.sectionDisplayFun or self.overlayDisplayFun
        )
