from object_database.web.cells.editor.event_model import (
    isValidEvent,
    eventIsValidInContextOfLines,
    eventsAreValidInContextOfLines,
    applyEventsToLines,
    computeUndoEvents,
    computeRedoEvents,
    compressState,
    eventsAreInSameUndoStream,
)
from object_database.web.cells.editor.editor import computeStateFromEvents
import numpy.random


class EditorModel:
    def __init__(self):
        self.initLines = [""]
        self.lines = [""]
        self.events = []
        self.topEventGuid = "0"
        self.initEventGuid = "0"

    def pushEvent(self, event):
        event = dict(event)
        event["eventGuid"] = str(int(self.topEventGuid) + 1)
        event["priorEventGuid"] = self.topEventGuid

        assert isValidEvent(event)
        assert eventIsValidInContextOfLines(event, self.lines, self.topEventGuid, [])
        self.events.append(event)
        self.topEventGuid = str(int(self.topEventGuid) + 1)

        applyEventsToLines(self.lines, [event])

    def undo(self):
        undoEvents = computeUndoEvents(self.events, "session", self.topEventGuid)

        for e in undoEvents:
            self.pushEvent(e)

    def redo(self):
        for e in computeRedoEvents(self.events, "session", self.topEventGuid):
            self.pushEvent(e)

    def insertLine(self, index, value, reason):
        self.pushEvent(
            dict(
                changes=[dict(lineIndex=index, oldLines=[], newLines=[value])],
                startCursors=[],
                newCursors=[],
                timestamp=len(self.events),
                undoState=None,
                editSessionId="session",
                reason=reason,
                undoing=None,
            )
        )

    def removeLine(self, index, reason):
        self.pushEvent(
            dict(
                changes=[dict(lineIndex=index, oldLines=[self.lines[index]], newLines=[])],
                startCursors=[],
                newCursors=[],
                timestamp=len(self.events),
                undoState=None,
                editSessionId="session",
                reason=reason,
                undoing=None,
            )
        )

    def editLine(self, index, newValue, reason):
        self.pushEvent(
            dict(
                changes=[
                    dict(lineIndex=index, oldLines=[self.lines[index]], newLines=[newValue])
                ],
                startCursors=[],
                newCursors=[],
                timestamp=len(self.events),
                undoState=None,
                editSessionId="session",
                reason=reason,
                undoing=None,
            )
        )

    def compress(self, maxTimestamp=None, maxWordUndos=0, maxLineUndos=10000):
        if not self.events:
            return

        assert computeStateFromEvents(self.initLines, self.events) == "\n".join(self.lines)

        assert eventsAreValidInContextOfLines(
            self.events, self.initLines, self.initEventGuid, []
        )

        state = dict(topEventGuid=self.topEventGuid, lines=self.initLines, events=self.events)

        newState, guaranteedEventGuid = compressState(
            state, maxTimestamp, maxWordUndos, maxLineUndos
        )

        self.events = list(newState["events"])
        self.topEventGuid = newState["topEventGuid"]
        self.initLines = newState["lines"]
        self.initEventGuid = self.events[0]["priorEventGuid"]

        assert eventsAreValidInContextOfLines(
            self.events, self.initLines, self.initEventGuid, []
        )

    def totalChanges(self):
        return sum([len(e["changes"]) for e in self.events])


def test_compression():
    em = EditorModel()

    em.editLine(0, "a", {"keystroke": "a"})
    em.editLine(0, "ab", {"keystroke": "b"})
    em.editLine(0, "abc", {"keystroke": "c"})

    em.compress()

    assert em.totalChanges() == 1


def test_compression_random():
    em = EditorModel()
    for passIx in range(100):
        numpy.random.seed(42 + passIx)

        pInsert = numpy.random.uniform() * 0.4 + 0.01
        pRemove = numpy.random.uniform() * 0.4 + 0.01
        pUndo = numpy.random.uniform() * 0.4 + 0.01
        pCompress = numpy.random.uniform() * 0.2 + 0.01

        for i in range(1000):
            if numpy.random.uniform() < pInsert:
                em.insertLine(
                    int(numpy.random.uniform() * (len(em.lines) + 1)),
                    "",
                    reason={"keystroke": "Enter"},
                )
            elif numpy.random.uniform() < pRemove and len(em.lines) > 1:
                em.removeLine(
                    int(numpy.random.uniform() * len(em.lines)),
                    reason={"keystroke": "Backspace"},
                )
            elif numpy.random.uniform() < pUndo and len(em.lines) > 1:
                for _ in range(int(numpy.random.uniform() * 20)):
                    em.undo()

                for _ in range(int(numpy.random.uniform() * 10)):
                    em.redo()
            else:
                lineIndex = int(numpy.random.uniform() * len(em.lines))
                if len(em.lines[lineIndex]) < 9:
                    char = "0123456789"[len(em.lines[lineIndex])]
                else:
                    char = "_"

                em.editLine(lineIndex, em.lines[lineIndex] + char, reason={"keystroke": char})

            if numpy.random.uniform() < pCompress and em.events:
                ts = em.events[max(len(em.events) - 30, 0)]["timestamp"]
                em.compress(maxWordUndos=20, maxLineUndos=200, maxTimestamp=ts)

        print(
            f"Pass {passIx}. " f"pCompress={pCompress:.2f}. ",
            f"pInsert={pInsert:.2f}. ",
            f"pRemove={pRemove:.2f}. ",
            f"pUndo={pUndo:.2f}. ",
            f"changes={em.totalChanges()}",
        )


def test_undo():
    em = EditorModel()
    em.editLine(0, "a", {"keystroke": "a"})
    em.insertLine(1, "", {"keystroke": "Enter"})
    em.editLine(1, "b", {"keystroke": "b"})
    em.insertLine(2, "", {"keystroke": "Enter"})
    em.editLine(2, "c", {"keystroke": "c"})
    em.undo()

    print(em.lines)
    em.undo()

    print(em.lines)
    em.undo()

    print(em.lines)
    em.undo()

    print(em.lines)
    em.undo()

    print(em.lines)
    em.undo()

    print(em.lines)


def test_event_collapsing():
    e1 = {
        "changes": [{"oldLines": [], "newLines": [""], "lineIndex": 12}],
        "startCursors": [{"pos": [11, 0], "tail": [11, 0], "desiredCol": 0}],
        "newCursors": [{"pos": [12, 0], "tail": [12, 0], "desiredCol": 0}],
        "timestamp": 1678819176.375,
        "undoState": None,
        "editSessionId": "session",
        "priorEventGuid": "session-12",
        "eventGuid": "session-13",
        "reason": {"keystroke": "Enter"},
        "undoing": None,
    }

    e2 = {
        "changes": [{"oldLines": [], "newLines": [""], "lineIndex": 13}],
        "startCursors": [{"pos": [12, 0], "tail": [12, 0], "desiredCol": 0}],
        "newCursors": [{"pos": [13, 0], "tail": [13, 0], "desiredCol": 0}],
        "timestamp": 1678819176.409,
        "undoState": None,
        "editSessionId": "session",
        "priorEventGuid": "session-13",
        "eventGuid": "session-14",
        "reason": {"keystroke": "Enter"},
        "undoing": None,
    }

    assert eventsAreInSameUndoStream(e1, e2)
