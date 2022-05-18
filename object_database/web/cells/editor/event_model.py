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
        reason: 'unknown' | 'server-push' | {'keystroke': 'key'} | {'event': 'paste'}
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

    if set(event) != set(
        [
            "changes",
            "startCursors",
            "newCursors",
            "timestamp",
            "undoState",
            "editSessionId",
            "reason",
        ]
    ):
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

    if not isinstance(event["editSessionId"], str):
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
        reason=e2["reason"],
    )


def reverseChange(c):
    return dict(oldLines=c["newLines"], newLines=c["oldLines"], lineIndex=c["lineIndex"])


def reverseEvent(event, isForUndo, curEditSessionId=None):
    undoState = None
    if isForUndo:
        if event.get("undoState") == "undo":
            undoState = "redo"
        else:
            undoState = "undo"

    return dict(
        changes=[reverseChange(c) for c in reversed(event["changes"])],
        startCursors=event["newCursors"],
        newCursors=event["startCursors"],
        timestamp=time.time() if isForUndo else event["timestamp"],
        undoState=undoState,
        editSessionId=curEditSessionId if isForUndo else event["editSessionId"],
        reason=event["reason"],
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


def computeUndoEvents(events, curEditSessionId):
    """Given a stream of events, return an event that "undoes" the top event."""
    i = computeNextUndoIx(events)

    res = []

    if i is None:
        return res

    res.append(reverseEvent(events[i], True, curEditSessionId))

    while True:
        i2 = computeNextUndoIx(events, 1 + len(res))

        if i2 is None:
            return res

        assert i2 < i

        if not eventsAreInSameUndoStream(events[i2], events[i]):
            return res

        res.append(reverseEvent(events[i2], True, curEditSessionId))

        i = i2


def computeRedoEvents(events, curEditSessionId):
    i = computeNextRedoIx(events)

    if i is None:
        return []

    res = []

    res.append(reverseEvent(events[i], True, curEditSessionId))

    while True:
        i2 = computeNextRedoIx(events, 1 + len(res))

        if i2 is None:
            return res

        assert i2 < i

        if not eventsAreInSameUndoStream(events[i2], events[i]):
            return res

        res.append(reverseEvent(events[i2], True, curEditSessionId))

        i = i2


def applyEventsToLines(lines, events):
    """Apply the changes in 'events' directly to 'lines' (a list of lines)."""
    for event in events:
        for change in event["changes"]:
            ix = change["lineIndex"]
            lines[ix : ix + len(change["oldLines"])] = change["newLines"]


def computeStateFromEvents(lines, events):
    lines = list(lines)

    applyEventsToLines(lines, events)

    return "\n".join(lines)


def eventIsValidInContextOfLines(candidateEvent, lines, events):
    """Return True if 'event' is a valid event and matches 'lines'.

    This will return False if the changes in 'event' don't match the data we're expecting
    to see in the corresponding positions in 'lines'. It will also return False if the
    event is not valid at all.

    Args:
        candidateEvent - an event dict that we're checking
        lines - a list of strings
        events - a list of changes
    """
    if not isValidEvent(candidateEvent):
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


def eventsAreValidInContextOfLines(candidateEvents, lines, events):
    for candidateEvent in candidateEvents:
        if not isValidEvent(candidateEvent):
            return False

    lines = list(lines)

    applyEventsToLines(lines, events)

    for candidateEvent in candidateEvents:
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
