from object_database.web.cells.editor.editor import compressState, computeStateFromEvents
import numpy.random


class EditorModel:
    def __init__(self):
        self.initLines = [""]
        self.lines = [""]
        self.events = []
        self.topEventIndex = 0

    def insertLine(self, index, value, reason):
        self.lines[index:index] = [value]
        self.events.append(
            dict(
                changes=[dict(lineIndex=index, oldLines=[], newLines=[value])],
                startCursors=[],
                newCursors=[],
                timestamp=len(self.events),
                undoState=None,
                editSessionId="session",
                reason=reason,
            )
        )
        self.topEventIndex += 1

    def removeLine(self, index, reason):
        self.events.append(
            dict(
                changes=[dict(lineIndex=index, oldLines=[self.lines[index]], newLines=[])],
                startCursors=[],
                newCursors=[],
                timestamp=len(self.events),
                undoState=None,
                editSessionId="session",
                reason=reason,
            )
        )
        self.lines[index : index + 1] = []
        self.topEventIndex += 1

    def editLine(self, index, newValue, reason):
        self.events.append(
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
            )
        )
        self.lines[index] = newValue
        self.topEventIndex += 1

    def compress(self, maxTimestamp=None, maxWordUndos=0, maxLineUndos=10000):
        assert computeStateFromEvents(self.initLines, self.events) == "\n".join(self.lines)

        state = dict(
            topEventIndex=self.topEventIndex, lines=self.initLines, events=self.events
        )

        newState = compressState(state, maxTimestamp, maxWordUndos, maxLineUndos)

        self.events = list(newState["events"])
        self.topEventIndex = newState["topEventIndex"]
        self.initLines = newState["lines"]

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
    numpy.random.seed(42)

    for i in range(10000):
        if i % 100 == 0:
            print("STEP ", i, em.totalChanges())
        if numpy.random.uniform() < 0.1:
            em.insertLine(
                int(numpy.random.uniform() * (len(em.lines) + 1)),
                "",
                reason={"keystroke": "Enter"},
            )
        elif numpy.random.uniform() < 0.1 and len(em.lines) > 1:
            em.removeLine(
                int(numpy.random.uniform() * len(em.lines)), reason={"keystroke": "Backspace"}
            )
        else:
            lineIndex = int(numpy.random.uniform() * len(em.lines))
            if len(em.lines[lineIndex]) < 9:
                char = "0123456789"[len(em.lines[lineIndex])]
            else:
                char = "_"

            em.editLine(lineIndex, em.lines[lineIndex] + char, reason={"keystroke": char})

        em.compress(maxWordUndos=20, maxLineUndos=200)
