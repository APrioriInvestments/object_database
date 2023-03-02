"""
Model a sequence of events editing a document.

In this model, documents are a collection of lines.

Documents start as the empty document (a single line with contents ''), to which we apply
a sequence of 'changes'.

A 'change' is just a dictionary with the structure

    {
        oldLines: ['old line 1', ...],
        newLines: ['new line 1', ...],
        lineIndex: 0
    }

where oldLines is a list of strings (none of which contains a newline), newLines is a list of
strings, and lineIndex is a zero-based offset into the document.  A document is updated by
a change by simply replacing the 'oldLines' with the newLines.

A collection of changes can be bundled together as an 'edit', which attaches metadata
allowing us to have a coherent undo model and which tracks the position of the cursors.
An edit looks like

    {
        changes: [change1, change2, ...],
        startCursors: [cursor, ...],
        newCursors: [cursor, ...],
        timestamp: float,
        undoState: None | 'undo' | 'redo',
        editSessionId: str,
        priorEventGuid: str,
        eventGuid: str,
        reason: 'unknown' | 'server-push' | {'keystroke': 'key'} | {'event': 'paste'}
        undoing: None | str
    }

where a cursor is of the form

    {
        pos: [line, col],
        tail: [line, col],
        desiredCol: col
    }

For cursors, line and col are zero-based line and column numbers, pos is the edit position of
the cursor, tail is the trailing position of the cursor (if this is not equal to pos,
then this is a 'selection'), and desiredCol is the column that we'd like the cursor to
be on if the line were long enough.

Overall, a document consists of the current set of lines, a list of events, and the index of
the topmost event that has been recorded.

Events can be 'compressed', which loses resolution but allows them to be compressed into
a smaller format (for instance, if 'a', is replaced by 'ab' and then 'abc', we may not want
to keep the intermediate 'ab' representation).

Two events are considered part of the same 'user event' (for undo purposes) if they were
entered with contiguous cursors, and don't add a new line or word. Hitting 'undo' at any point
causes us to search back through the document until the most recent event that's not part
of the same 'user event'. We then compute the 'reverse event' that rolls us back to that point
and append it with an 'undoState' of 'undo'.  If we then push a 'redo' event, we search
backward for the most recent 'undo' and perform that operation in reverse.
"""
import time
import logging
import uuid
import pprint


def isValidChange(change):
    """Return 'True' if 'change' is a valid change object."""
    if not isinstance(change, dict):
        return False

    if set(change) != set(["oldLines", "newLines", "lineIndex"]):
        return False

    if not isinstance(change["oldLines"], list):
        return False

    if not isinstance(change["newLines"], list):
        return False

    if not isinstance(change["lineIndex"], int):
        return False

    if change["lineIndex"] < 0:
        return False

    for ln in change["oldLines"] + change["newLines"]:
        if not isinstance(ln, str) or "\n" in ln:
            return False

    return True


def isValidCursor(cursor):
    """Return True if 'cursor' is a valid cursor object."""
    if not isinstance(cursor, dict):
        return False

    if set(cursor) != set(["pos", "tail", "desiredCol"]):
        return False

    if not isinstance(cursor["pos"], list) or len(cursor["pos"]) != 2:
        return False

    if not isinstance(cursor["tail"], list) or len(cursor["tail"]) != 2:
        return False

    for v in cursor["pos"] + cursor["tail"] + [cursor["desiredCol"]]:
        if not isinstance(v, int) or v < 0:
            return False

    return True


def isValidEvent(event):
    """Return 'True' if event is a valid event object."""
    if not isinstance(event, dict):
        return False

    REQUIRED_FIELDS = [
        "changes",
        "startCursors",
        "newCursors",
        "timestamp",
        "undoState",
        "editSessionId",
        "reason",
        "eventGuid",
        "priorEventGuid",
        "undoing",
    ]

    if set(event) != set(REQUIRED_FIELDS):
        logging.warning(
            "Event has wrong set of fields: adding %s, missing %s",
            set(event) - set(REQUIRED_FIELDS),
            set(REQUIRED_FIELDS) - set(event),
        )
        return False

    if not isinstance(event["changes"], list):
        return False

    if not all(isValidChange(x) for x in event["changes"]):
        return False

    if not isinstance(event["startCursors"], list):
        return False

    if not all(isValidCursor(x) for x in event["startCursors"]):
        return False

    if not isinstance(event["newCursors"], list):
        return False

    if not all(isValidCursor(x) for x in event["newCursors"]):
        return False

    if not isinstance(event["timestamp"], (float, int)):
        return False

    if event["undoState"] not in (None, "undo", "redo"):
        return False

    if not isinstance(event["undoing"], (str, type(None))):
        return False

    if not isinstance(event["editSessionId"], str) and event["editSessionId"] is not None:
        return False

    if not isinstance(event["eventGuid"], str):
        return False

    if not isinstance(event["priorEventGuid"], str):
        return False

    if not isinstance(event["reason"], (str, dict)):
        return False

    if isinstance(event["reason"], dict):
        if not all(isinstance(k, str) for k in event["reason"]):
            return False
        if not all(isinstance(k, str) for k in event["reason"].values()):
            return False

    return True


def eventsAreInSameUndoStream(e1, e2):
    """Determine if events e1 and e2 should be undone/redone as a group.

    Generally, we want two events to "go together" if they are a sequence of keystrokes
    that didn't create a newline and where their cursors are contiguous.
    """
    if e1["newCursors"] != e2["startCursors"]:
        return False

    if "reason" not in e1 or "reason" not in e2:
        return False

    if not isinstance(e1["reason"], dict) or not isinstance(e2["reason"], dict):
        return False

    if "keystroke" not in e1["reason"] or "keystroke" not in e2["reason"]:
        return False

    stroke1 = e1["reason"]["keystroke"]
    stroke2 = e2["reason"]["keystroke"]

    stroke1Cat = "space" if stroke1 == " " else "newline" if stroke1 == "Enter" else "char"
    stroke2Cat = "space" if stroke2 == " " else "newline" if stroke2 == "Enter" else "char"

    return stroke1Cat == stroke2Cat


def collapseChanges(changes):
    # a very simple change-collapsing algorithm - only collapse those things that are
    # consecutive
    changes = list(changes)

    i = 0

    while i + 1 < len(changes):
        # determine the range affected on the set of lines that are shared
        # (the set of lines after change[i] and before [i + 1])
        l0 = changes[i]["lineIndex"]
        l1 = changes[i]["lineIndex"] + len(changes[i]["newLines"])

        r0 = changes[i + 1]["lineIndex"]
        r1 = changes[i + 1]["lineIndex"] + len(changes[i + 1]["oldLines"])

        mergedChange = None

        if l0 <= r1 and r0 <= l1:
            oldLines = changes[i]["oldLines"]

            if r0 < l0:
                oldLines = changes[i + 1]["oldLines"][: l0 - r0] + oldLines

            if r1 > l1:
                oldLines = oldLines + changes[i + 1]["oldLines"][-(r1 - l1) :]

            newLines = changes[i + 1]["newLines"]

            if l0 < r0:
                newLines = changes[i]["newLines"][: r0 - l0] + newLines

            if l1 > r1:
                newLines = newLines + changes[i]["newLines"][-(l1 - r1) :]

            mergedChange = dict(
                lineIndex=min(changes[i]["lineIndex"], changes[i + 1]["lineIndex"]),
                oldLines=oldLines,
                newLines=newLines,
            )

        if mergedChange is not None:
            changes[i] = None
            changes[i + 1] = mergedChange
        else:
            # over time this acts like a bubble sort, moving changes together
            # that could be merged
            if changes[i + 1]["lineIndex"] < changes[i]["lineIndex"]:
                # they're out of order and disjoint, so we can swap them
                c1 = dict(changes[i])
                c2 = dict(changes[i + 1])

                c1["lineIndex"] += len(c2["newLines"]) - len(c2["oldLines"])

                changes[i] = c2
                changes[i + 1] = c1

        i += 1

    return list(x for x in changes if x is not None)


def collapseEvents(e1, e2):
    changes = e1["changes"] + e2["changes"]
    newChanges = collapseChanges(changes)

    return dict(
        changes=newChanges,
        startCursors=e1["startCursors"],
        newCursors=e2["newCursors"],
        timestamp=e2["timestamp"],
        undoState=e2["undoState"],
        editSessionId=e2["editSessionId"],
        priorEventGuid=e1["priorEventGuid"],
        eventGuid=e2["eventGuid"],
        reason=e2["reason"],
        undoing=e2.get("undoing"),
    )


def reverseChange(c):
    return dict(oldLines=c["newLines"], newLines=c["oldLines"], lineIndex=c["lineIndex"])


def reverseEventForUndo(event, curEditSessionId, priorEventGuid):
    if event.get("undoState") == "undo":
        undoState = "redo"
    else:
        undoState = "undo"

    return dict(
        changes=[reverseChange(c) for c in reversed(event["changes"])],
        startCursors=event["newCursors"],
        newCursors=event["startCursors"],
        timestamp=time.time(),
        undoState=undoState,
        editSessionId=curEditSessionId,
        priorEventGuid=priorEventGuid,
        eventGuid=str(uuid.uuid4()),
        reason=event["reason"],
        undoing=event["eventGuid"],
    )


def eventsAreOnSameLine(e1, e2):
    lines1 = set()
    lines2 = set()
    for c in e1["changes"]:
        lines1.add(c["lineIndex"])
        if len(c["oldLines"]) != 1 or len(c["newLines"]) != 1:
            return False

    for c in e2["changes"]:
        lines2.add(c["lineIndex"])
        if len(c["oldLines"]) != 1 or len(c["newLines"]) != 1:
            return False

    return lines1 == lines2


def computeNextUndoIx(events, pendingUndos=1):
    i = len(events) - 1

    while i >= 0 and pendingUndos > 0:
        if events[i]["undoState"] is None:
            i -= 1
            pendingUndos -= 1
        elif events[i]["undoState"] == "undo":
            i -= 1
            pendingUndos += 1
        elif events[i]["undoState"] == "redo":
            i -= 1
            pendingUndos -= 1

    if pendingUndos > 0:
        return None

    return i + 1


def computeNextRedoIx(events, pendingRedos=1):
    i = len(events) - 1

    while i >= 0 and pendingRedos:
        if events[i]["undoState"] is None:
            return None
        elif events[i]["undoState"] == "undo":
            i -= 1
            pendingRedos -= 1
        elif events[i]["undoState"] == "redo":
            i -= 1
            pendingRedos += 1

    if pendingRedos:
        return None

    return i + 1


def computeUndoEvents(events, curEditSessionId, topEventGuid):
    """Given a stream of events, return an event that "undoes" the top event."""
    i = computeNextUndoIx(events)

    res = []

    if i is None:
        return res

    res.append(reverseEventForUndo(events[i], curEditSessionId, topEventGuid))

    while True:
        i2 = computeNextUndoIx(events, 1 + len(res))

        if i2 is None:
            return res

        assert i2 < i

        if not eventsAreInSameUndoStream(events[i2], events[i]):
            return res

        res.append(reverseEventForUndo(events[i2], curEditSessionId, res[-1]["eventGuid"]))

        i = i2


def computeRedoEvents(events, curEditSessionId, topEventGuid):
    i = computeNextRedoIx(events)

    if i is None:
        return []

    res = []

    res.append(reverseEventForUndo(events[i], curEditSessionId, topEventGuid))

    while True:
        i2 = computeNextRedoIx(events, 1 + len(res))

        if i2 is None:
            return res

        assert i2 < i

        if not eventsAreInSameUndoStream(events[i2], events[i]):
            return res

        res.append(reverseEventForUndo(events[i2], curEditSessionId, res[-1]["eventGuid"]))

        i = i2


def applyEventsToLines(lines, events):
    """Apply the changes in 'events' directly to 'lines' (a list of lines)."""
    for event in events:
        for change in event["changes"]:
            ix = change["lineIndex"]
            lines[ix : ix + len(change["oldLines"])] = change["newLines"]


def eventsAppliedToLines(lines, events):
    lines = list(lines)
    applyEventsToLines(lines, events)
    return lines


def computeStateFromEvents(lines, events):
    lines = list(lines)

    applyEventsToLines(lines, events)

    return "\n".join(lines)


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
        undoing=None,
    )


def eventIsValidInContextOfLines(candidateEvent, lines, topEventGuid, events):
    """Return True if 'event' is a valid event and matches 'lines'.

    This will return False if the changes in 'event' don't match the data we're expecting
    to see in the corresponding positions in 'lines'. It will also return False if the
    event is not valid at all.

    Args:
        candidateEvent - an event dict that we're checking
        lines - a list of strings
        topEventGuid - the topmost event guid in events, or of the current lines
        events - a list of changes
    """
    if not isValidEvent(candidateEvent):
        return False

    if candidateEvent["priorEventGuid"] != topEventGuid:
        return False

    lines = list(lines)

    applyEventsToLines(lines, events)

    for change in candidateEvent["changes"]:
        ix = change["lineIndex"]
        if ix > len(lines):
            logging.warning("Invalid change found: line index out of bounds")
            return False

        if lines[ix : ix + len(change["oldLines"])] != change["oldLines"]:
            logging.warning(
                "Invalid change found: %s != %s",
                lines[ix : ix + len(change["oldLines"])],
                change["oldLines"],
            )
            return False

        lines[ix : ix + len(change["oldLines"])] = change["newLines"]

    return True


def eventsAreValidInContextOfLines(candidateEvents, lines, topEventGuid, events):
    for candidateEvent in candidateEvents:
        if not isValidEvent(candidateEvent):
            return False

    if not candidateEvents:
        return True

    lines = list(lines)

    applyEventsToLines(lines, events)

    eventGuids = set(
        [event["eventGuid"] for event in events]
        + [event["eventGuid"] for event in candidateEvents]
    )

    if topEventGuid in set([event["eventGuid"] for event in candidateEvents]):
        logging.warning("Incoming top event guid is defined in the event stream.")
        return False

    if len(eventGuids) != len(events) + len(candidateEvents):
        logging.warning("Duplicate event ids.")
        return False

    for candidateEvent in candidateEvents:
        if candidateEvent.get("undoing"):
            if candidateEvent["undoing"] not in eventGuids:
                logging.warning(
                    "Invalid event found: event is undoing %s which we don't have",
                    candidateEvent["undoing"],
                )
                return False

        if candidateEvent["priorEventGuid"] != topEventGuid:
            logging.warning(
                "Invalid event found: priorEventGuid is wrong: %s != %s",
                candidateEvent["priorEventGuid"],
                topEventGuid,
            )
            return False

        topEventGuid = candidateEvent["eventGuid"]

        for change in candidateEvent["changes"]:
            ix = change["lineIndex"]
            if ix > len(lines):
                logging.warning(
                    "Invalid change found: line index out of bounds:\n\n%s",
                    pprint.PrettyPrinter(indent=2, width=120).pformat(candidateEvent),
                )
                return False

            if lines[ix : ix + len(change["oldLines"])] != change["oldLines"]:
                logging.warning(
                    "Invalid change found: %s != %s:\n\n%s",
                    lines[ix : ix + len(change["oldLines"])],
                    change["oldLines"],
                    pprint.PrettyPrinter(indent=2, width=120).pformat(candidateEvent),
                )
                return False

            lines[ix : ix + len(change["oldLines"])] = change["newLines"]

    return True


def duplicateEventWithPriorEventGuid(event, priorEventGuid):
    event = dict(event)
    event["priorEventGuid"] = priorEventGuid
    return event


class EventStateCache:
    def __init__(self, lines, events):
        self.lines = lines
        self.events = events
        self._cache = {}

    def __getitem__(self, i):
        """Cache the state after applying events[:i] to lines.

        We do brute force, but caching in powers of ten.  So, to compute element 111,
        we'll compute element 110 and then do one event. For 110 we'll compute 100 and do
        10 events. To compute 100 we'll do it outright. This doesn't re-do too much work
        and doesn't hold too many cached items around.
        """
        assert 0 <= i <= len(self.events), i

        if i not in self._cache:
            power = 10
            while power <= i:
                if i % power:
                    prior = self[i - (i % power)]
                    self._cache[i] = eventsAppliedToLines(
                        prior, self.events[i - (i % power) : i]
                    )
                    return self._cache[i]

                power *= 10

            self._cache[i] = eventsAppliedToLines(self.lines, self.events[:i])
            return self._cache[i]

        return self._cache[i]


def compressAwayUnreachableEvents(lines, events, maxTimestamp):
    """Get rid of any undos or redos before a regular event.

    If we have a stream of events and we see a sequence of 'undo/redo' followed
    by a regular event, then all the events we 'undid' are unreachable
    and we want to remove them.

    We assume our current list of events is valid and has no redo events
    before the maxTimestamp.

    Args:
        events - a list of events
        maxTimestamp - the maximum timestamp we'll modify, or None
            if all events are OK to modify.
    """
    if not events:
        return events

    guidToIx = {events[i]["eventGuid"]: i for i in range(len(events))}
    guidToIx[events[0]["priorEventGuid"]] = -1

    eventTransitions = {}

    curState = events[0]["priorEventGuid"]
    for e in events:
        if e["undoState"] is None:
            eventTransitions[e["eventGuid"]] = (curState, e["eventGuid"])
            curState = e["eventGuid"]

        else:
            # look at the event we undo or redo - we transition between this pair of states in
            # reverse
            transitionOfReverse = eventTransitions[e["undoing"]]

            eventTransitions[e["eventGuid"]] = (transitionOfReverse[1], transitionOfReverse[0])
            curState = transitionOfReverse[0]

    def computeBaseEventIxFor(ix):
        """Return the index of the actual event of the state we are in at 'ix'"""

        """Given that 'ix' is an undo/redo event, return the index of the target state"""
        e = events[ix]
        return guidToIx[eventTransitions[e["eventGuid"]][1]]

    maxTsTriggered = False

    eventCountsToRemove = []

    for ix in range(1, len(events)):
        e = events[ix]

        if maxTimestamp is not None and e["timestamp"] > maxTimestamp or maxTsTriggered:
            maxTsTriggered = True
        elif e["undoState"] not in ("undo", "redo") and events[ix - 1]["undoState"] in (
            "undo",
            "redo",
        ):
            # determine the index of the event we return to
            baseEventIx = computeBaseEventIxFor(ix - 1)

            while eventCountsToRemove and baseEventIx + 1 <= eventCountsToRemove[-1][0]:
                eventCountsToRemove.pop(-1)
            eventCountsToRemove.append((baseEventIx + 1, ix))

    if not eventCountsToRemove:
        return events

    outEvents = list(events)

    stateCache = EventStateCache(lines, events)

    excisedEventGuids = set()

    for startIx, stopIx in reversed(eventCountsToRemove):
        assert stateCache[startIx] == stateCache[stopIx]

        outEvents[stopIx] = duplicateEventWithPriorEventGuid(
            outEvents[stopIx],
            outEvents[startIx - 1]["eventGuid"]
            if startIx > 0
            else events[0]["priorEventGuid"],
        )

        excisedEventGuids.update([e["eventGuid"] for e in outEvents[startIx:stopIx]])

        outEvents[startIx:stopIx] = []

        for referrerIx in range(startIx, len(outEvents)):
            if outEvents[referrerIx]["undoing"] in excisedEventGuids:
                actuallyUndoing = eventTransitions[outEvents[referrerIx]["undoing"]][1]
                outEvents[referrerIx]["undoing"] = actuallyUndoing

    return outEvents


def computeLowestEventIxReferencedByUndoEvents(events):
    """Compute the maximum index we could drop and still service the undo stream.

    More precisely, return 'ix' such that events[:ix] has no undo
    events and events[ix:] is self-consistent, so that all undos in
    it make sense and are paired with their corresponding events
    that the undo.
    """
    if not events:
        return 0

    # first event can't be an undo or a redo
    assert events[0]["undoState"] is None

    # the current state is made up by concatenating these 'real' events
    currentEventStack = []

    # current redo stack - if we were to 'redo' an event
    # we would push this back on
    currentRedoStack = []

    minReffedIx = len(events)

    for eventIx in range(len(events)):
        if events[eventIx]["undoState"] is None:
            currentEventStack.append(eventIx)
            currentRedoStack.clear()

        elif events[eventIx]["undoState"] == "undo":
            undoEventIx = currentEventStack.pop()
            currentRedoStack.append(undoEventIx)
            minReffedIx = min(minReffedIx, undoEventIx)

        elif events[eventIx]["undoState"] == "redo":
            redoEventIx = currentRedoStack.pop()
            currentEventStack.append(redoEventIx)

    return minReffedIx


def compressState(state, maxTimestamp, maxWordUndos=1000, maxLineUndos=10000):
    """Compress events so that the state doesn't build up.

    We have to be a little careful - we can break the undo model if we
    compress away events in an inconsistent way (for instance, compressing
    two events together that have both been undone, but leaving the two
    undo events behind) since the linkage between the events is based on
    counting the number of events.

    We apply a few heuristics: first, any sequence of undo/redo events that
    happens _before_ a regular event can be compressed away into a sequence
    of regular events.

    Second, any stream of undo/redo can be compressed into a sequence of
    pure undos.

    Finally, we can compute the furthest-back event in the chain that
    is referenced by something in our undo stream, and we are free to
    compress events before this point in the stream.

    Args:
        state - a dict(lines,events=,topEventGuid) state model
        maxTimestamp - None, or the largest timestamp we'll consider compressing
            so that all events after this are unmodified.
        maxWordUndos - the maximum number of single-word undo events to tolerate
        maxLineUndos - the maximum number of line-level undos to tolerate
    """
    lines = list(state["lines"])
    events = list(state["events"])

    if not events:
        return state

    events = compressAwayUnreachableEvents(lines, events, maxTimestamp)

    # figure out the lowest event we're allowed to fold anything into
    maxIxModifiable = computeLowestEventIxReferencedByUndoEvents(events)

    # find the first event that's above maxTimestamp - we can't modify anything
    # above that (since its possible that we have timestamps out of order)
    if maxTimestamp is not None:
        i = 0
        while i < maxIxModifiable - 1:
            if events[i]["timestamp"] >= maxTimestamp:
                break

            i += 1
    else:
        i = maxIxModifiable - 1

    eventsKept = 0

    while i > 0 and eventsKept < maxLineUndos:
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

    assert eventsAreValidInContextOfLines(events, lines, events[0]["priorEventGuid"], [])

    # verify we didn't change the final event state
    state1 = computeStateFromEvents(state["lines"], state["events"])
    state2 = computeStateFromEvents(lines, events)

    assert state1 == state2, (state1, state2)

    return dict(lines=lines, topEventGuid=events[-1]["eventGuid"], events=events)
