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
    computeUndoEvents,
    computeRedoEvents,
    eventIsValidInContextOfLines,
    eventsAreValidInContextOfLines,
    computeStateFromEvents,
    compressState,
)

import threading
import logging
import time
import uuid


def collapseStateToTopmost(state):
    lines = list(state["lines"])

    for event in state["events"]:
        for change in event["changes"]:
            ix = change["lineIndex"]
            lines[ix : ix + len(change["oldLines"])] = change["newLines"]

    return dict(lines=lines, events=(), topEventGuid=state["topEventGuid"])


class EditorStateBase:
    def getStateSlot(self):
        def getState():
            return dict(lines=self.lines, topEventGuid=self.topEventGuid, events=self.events)

        def setState(val):
            self.lines = val["lines"]
            self.topEventGuid = val["topEventGuid"]
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
        event = computeDeltaEvent(
            self.getCurrentState(), newBuffer, "server", self.topEventGuid
        )

        if event is None:
            return

        self.events = self.events + (event,)
        self.topEventGuid = event["eventGuid"]

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
                topEventGuid="<initial>",
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
    def topEventGuid(self):
        return self.dataSlot.get()["topEventGuid"]

    @topEventGuid.setter
    def topEventGuid(self, newValue):
        val = dict(self.dataSlot.get())
        val["topEventGuid"] = newValue
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
        self, storageObject, linesName, topEventGuidName, eventsName, userSelectionDataName
    ):
        self.storageObject = storageObject
        self.linesName = linesName
        self.topEventGuidName = topEventGuidName
        self.eventsName = eventsName
        self.userSelectionDataName = userSelectionDataName

    def getStateSlot(self):
        def getState():
            return dict(lines=self.lines, topEventGuid=self.topEventGuid, events=self.events)

        def setState(val):
            self.lines = val["lines"]
            self.topEventGuid = val["topEventGuid"]
            self.events = val["events"]

        return ComputedSlot(getState, setState)

    @property
    def lines(self):
        return getattr(self.storageObject, self.linesName) or ("",)

    @lines.setter
    def lines(self, newValue):
        setattr(self.storageObject, self.linesName, newValue)

    @property
    def topEventGuid(self):
        return getattr(self.storageObject, self.topEventGuidName) or "<initial>"

    @topEventGuid.setter
    def topEventGuid(self, newValue):
        setattr(self.storageObject, self.topEventGuidName, newValue)

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


def computeDeltaEvent(curContents, newContents, reason, topEventGuid):
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

    startCursor = dict(
        pos=[min(max(len(curContents) - j, 0), len(curContents) - 1), 0],
        tail=[min(i, len(curContents) - 1), 0],
        desiredCol=0,
    )
    endCursor = dict(
        pos=[min(max(len(newContents) - j, 0), len(newContents) - 1), 0],
        tail=[min(i, len(newContents) - 1), 0],
        desiredCol=0,
    )

    return dict(
        changes=[
            dict(
                lineIndex=i,
                oldLines=curContents[i : len(curContents) - j],
                newLines=newContents[i : len(newContents) - j],
            )
        ],
        startCursors=[startCursor],
        newCursors=[endCursor],
        timestamp=time.time(),
        eventGuid=str(uuid.uuid4()),
        priorEventGuid=topEventGuid,
        undoState=None,
        editSessionId=None,
        reason=reason,
    )


class AutocompleteRequest:
    """A data-structure representing an asynchronous request for autocompletion.

    Because autocompletions could potentially be expensive, this object
    can be filled out asynchronously (or not at all) and will show (...)
    in the autocompleter until its processed.

    The editor itself may choose to cancel this request if it is no longer
    relevant. Backends should attempt to cache in memory what they can
    to reduce latency as much as possible.

    attributes:
        editor - the Editor instance associated with the request
        requestId - an integer uniquely identifying the request on
            this channel
        contents - the contents of the document at the time of the request
        completions - the set of completions provided by the callback,
            or None

    """

    def __init__(self, editor, requestId, contents, insertionLineAndCol):
        self.editor = editor
        self.requestId = requestId
        self.contents = contents
        self.completions = None
        self.contextDescriptor = None
        self.insertionLineAndCol = insertionLineAndCol
        self.isValid = True
        self.lock = threading.RLock()

    def complete(self, completions, contextDescriptor=None):
        """Provide a list of autocompletions for this insertion point.

        Autocompletions should be a list of 'completions' which can either
        be a string, or a dict with entries

            completion - str
            priority - int (optional). used to order completions that are
                equally well-matched by the completion text
            module - str (optional). If present this is shown as part
                of the prefix of the completion (but doesn't count against
                it for matching or count in the text)
            type - str (optional). If present then we show a 'type' column
            docstring - str (optional). If present, then this becomes
                a docstring that gets displayed to the side of the relevant
                item.

        Args:
            completions - a list of completions
            contextDescriptor - a docstring for the object being completed,
                and a single line of it will be shown above the completions
        """
        with self.lock:
            if not self.isValid:
                return

            processedCompletions = []

            for completion in completions:

                def isValidCompletion(completion):
                    if isinstance(completion, str):
                        return True

                    if not isinstance(completion, dict):
                        return False

                    if "completion" not in completion:
                        return False

                    for k, v in completion.items():
                        if k in ["completion", "module", "type", "docstring"]:
                            if not isinstance(v, str):
                                return False
                        elif k in ["priority"]:
                            if not isinstance(v, (int, float)):
                                return False
                        else:
                            return False

                    return True

                if not isValidCompletion(completion):
                    raise Exception(f"invalid completion {completion}")

                processedCompletions.append(
                    completion if isinstance(completion, dict) else {"completion": completion}
                )

            if not isinstance(contextDescriptor, str) and contextDescriptor is not None:
                raise Exception("contextDescriptor should be an integer or None")

            self.completions = processedCompletions
            self.contextDescriptor = contextDescriptor

            self.editor.scheduleCallback(self.sendData)

    def invalidate(self):
        """The completion is no longer valid. No update will be sent"""
        with self.lock:
            self.isValid = False

    def sendData(self):
        self.editor.scheduleMessage(
            dict(
                requestId=self.requestId,
                completions=self.completions,
                contextDescriptor=self.contextDescriptor,
            )
        )


class Editor(FocusableCell):
    """Produce a collaborative text editor"""

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
        autocompleteFunction=None,
        onDoubleClick=None,
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
            autocompleteFunction - None, or a function that takes an AutocompleteRequest
                which should synchronously or asynchronously fill out the promise.
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
            onDoubleClick - a function of (line, col, ctrl, shift, alt, meta) whenever we
                detect a double-click
        """
        super().__init__()

        if editorState is not None:
            assert isinstance(editorState, EditorStateBase)
            self.editorState = editorState
        else:
            self.editorState = SlotEditorState()

        self.onDoubleClick = onDoubleClick

        self.stateSlot = self.editorState.getStateSlot()
        self.stateSlotWatcher = SlotWatcher(self.stateSlot, self.onStateSlotChanged)
        self.reactors.add(self.stateSlotWatcher)

        self.lastLineSlot = lastLineSlot or Slot()

        # if not None, this callback gets fired every time we think we're supposed
        # to open up a new autocompletion
        self.autocompleteFunction = autocompleteFunction

        # the currently pending autocompletion - there can be at most one at
        # once, tied to a particular edit guid
        self.curPendingAutocompletion = None

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

        # this will become a slot that holds the event guid that we've sent to the javascript
        # client. It has to be a slot so that if we have an ODB transaction that fails
        # we don't end up with a state mismatch (the slot value will be reset and the
        # message will be un-scheduled)
        self.sentEventGuidSlot = None

        self.editSessionId = str(uuid.uuid4())

        self.commitDelay = commitDelay

        self.contentsSlot = ComputedSlot(self.getCurrentContents, self.setContents)

        self.readOnly = readOnly

        self.everCalculated = False

        self.darkMode = darkMode

        self.overlayDisplayFun = overlayDisplayFun
        self.sectionDisplayFun = sectionDisplayFun

    def getDisplayExportData(self):
        # we only wa
        toReturn = dict(self.exportData)

        # because our comms protocol with the client is
        # not as tight as we'd like, we need to be careful
        # not to leave the 'exportData' in place (since it might
        # be large), because we send it on every frame. the javascript
        # on the other side is careful to see this only on first render
        # and then take deltas only from messages.
        self.exportData.clear()

        return toReturn

    def uninstall(self):
        super().uninstall()

        self.everCalculated = False
        self.exportData = {}

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
        self.onSelectionSlotChanged(None, newSelSlot)

        self.ensureVisible(pos[0], 10)

    def setContents(self, newContents):
        curState = self._getCurrentState()

        event = computeDeltaEvent(
            self.getCurrentContents(), newContents, "server-push", curState["topEventGuid"]
        )

        if event is None:
            return

        if not eventIsValidInContextOfLines(
            event, curState["lines"], curState["topEventGuid"], curState["events"]
        ):
            raise Exception("Computed an invalid event somehow")

        curState = dict(curState)
        curState["events"] = curState["events"] + (event,)
        curState["topEventGuid"] = event["eventGuid"]

        self.stateSlot.set(curState)

    def onRemovedFromTree(self):
        if self.userSelectionSlot is not None:

            def removeSelf():
                content = dict(self.userSelectionSlot.get())
                content.pop(self.editSessionId, None)
                self.userSelectionSlot.set(content)

            self.cells.scheduleUnconditionalCallback(removeSelf)

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

        # broadcast any committed events to the client.
        if self.sentEventGuidSlot.get() == serverState["topEventGuid"]:
            return

        # now, look back in the event history until we find the event we are supposed to have
        events = serverState["events"]
        eventIx = len(events) - 1

        while eventIx >= 0:
            if events[eventIx]["priorEventGuid"] == self.sentEventGuidSlot.get():
                # we need to send all events from here forward
                self.scheduleMessage({"acceptedEvents": events[eventIx:]})
                self.sentEventGuidSlot.set(events[-1]["eventGuid"])

                logging.info(
                    "Client %s/%s updating to event %s",
                    self.username,
                    self.editSessionId,
                    self.sentEventGuidSlot.get(),
                )
                return
            else:
                eventIx -= 1

        # somehow we got into a bad state
        self.scheduleMessage({"resetState": collapseStateToTopmost(serverState)})
        logging.error(
            "Client %s/%s completely resetting state to %s because the send "
            "state (%s) was ahead",
            self.username,
            self.editSessionId,
            serverState["topEventGuid"],
            self.sentEventGuidSlot.get(),
        )
        self.sentEventGuidSlot.set(serverState["topEventGuid"])

    def triggerUndoOrRedo(self, isUndo):
        currentState = self._getCurrentState()

        if isUndo:
            newEvents = computeUndoEvents(
                currentState["events"], self.editSessionId, currentState["topEventGuid"]
            )
        else:
            newEvents = computeRedoEvents(
                currentState["events"], self.editSessionId, currentState["topEventGuid"]
            )

        if newEvents:
            if not eventsAreValidInContextOfLines(
                newEvents,
                currentState["lines"],
                currentState["topEventGuid"],
                currentState["events"],
            ):
                raise Exception("Computed invalid undo events")

            currentState = dict(currentState)
            currentState["events"] = currentState["events"] + tuple(newEvents)
            currentState["topEventGuid"] = newEvents[-1]["eventGuid"]

            logging.info("Pushing an %s event: %s", "undo" if isUndo else "redo", newEvents)

            self.stateSlot.set(currentState)
        else:
            logging.error("Can't build an %s event", "undo" if isUndo else "redo")

    def onMessage(self, messageFrame):
        if messageFrame.get("msg") == "doubleClick":
            if self.onDoubleClick:
                self.onDoubleClick(
                    messageFrame["lineOffset"],
                    messageFrame["colOffset"],
                    messageFrame["ctrl"],
                    messageFrame["shift"],
                    messageFrame["alt"],
                    messageFrame["meta"],
                )

        if messageFrame.get("msg") == "provideCurrentAutocompletion":
            currentState = self._getCurrentState()

            contents = "\n".join(currentState["lines"])

            request = AutocompleteRequest(
                self, messageFrame["requestId"], contents, messageFrame["lineAndCol"]
            )

            self.autocompleteFunction(request)
            self.curPendingAutocompletion = request

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

            event = messageFrame.get("event")

            for change in event["changes"]:
                assert isinstance(change["lineIndex"], int), change["lineIndex"]

            currentState = self._getCurrentState()

            isValidIndex = event["priorEventGuid"] == currentState["topEventGuid"]

            if isValidIndex:
                if not eventIsValidInContextOfLines(
                    event,
                    currentState["lines"],
                    currentState["topEventGuid"],
                    currentState["events"],
                ):
                    self.scheduleMessage({"resetState": collapseStateToTopmost(currentState)})
                    self.sentEventGuidSlot.set(currentState["topEventGuid"])
                    logging.error(
                        "Resetting session %s/%s on eventGuid %s: bad event %s.",
                        self.username,
                        self.editSessionId,
                        currentState["topEventGuid"],
                        event,
                    )
                else:
                    newState = dict(
                        lines=currentState["lines"],
                        topEventGuid=event["eventGuid"],
                        events=currentState["events"] + (event,),
                    )

                    logging.debug(
                        "Accepting event on %s/%s: %s",
                        self.username,
                        self.editSessionId,
                        event,
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
                    "Dropping event on %s/%s: %s",
                    self.username,
                    self.editSessionId,
                    event,
                )

    def _getCurrentStateWithoutDependency(self):
        state = self.stateSlot.getWithoutRegisteringDependency()

        if state is None:
            return dict(lines=("",), topEventGuid="<initial>", events=())

        return state

    def _getCurrentState(self):
        state = self.stateSlot.get()

        if state is None:
            return dict(lines=("",), topEventGuid="<initial>", events=())

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

        # number of lines of view text above and below that we'll
        # extend our visible range by when we are deciding which
        # visible cells to show.
        VIEW_PADDING_LINES = 10

        topLine = max(topLine - VIEW_PADDING_LINES, 0)
        lastLine = min(lastLine + VIEW_PADDING_LINES, len(state))

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
            self.doFirstCalc()
            self.everCalculated = True

        if self.sectionDisplayFun or self.overlayDisplayFun:
            self.recalculateSections()

    def onFirstLineSlotChanged(self, oldVal, newVal):
        self.scheduleMessage(dict(firstLine=newVal))

    def onSelectionSlotChanged(self, oldVal, newVal):
        self.scheduleMessage(dict(selectionState=newVal))

    def doFirstCalc(self):
        # figure out the initial state of the editor
        initData = collapseStateToTopmost(self._getCurrentStateWithoutDependency())

        # keep track of what we first told the editor was the state of the system
        self.sentEventGuidSlot = Slot(initData["topEventGuid"])

        logging.info(
            "Creating editor %s/%s with %s events and top event %s",
            self.username,
            self.editSessionId,
            len(initData["events"]),
            initData["topEventGuid"],
        )

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

        self.exportData["hasAutocomplete"] = self.autocompleteFunction is not None
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
