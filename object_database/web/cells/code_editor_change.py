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

from typed_python import Alternative, NamedTuple, TupleOf, Tuple


Change = Alternative("Change",
    # make a change to the document
    Edit=dict(
        line_start=Tuple(int, int),
        line_end=Tuple(int, int),
        # each line in the source range
        startText=TupleOf(str),
        # each line in the dest range
        endText=TupleOf(str),
    ),
    # undo the last few "contiguous" changes
    Undo=dict(),
    # redo the last undo
    Redo=dict(),
    SelectionState=dict(
        # rows and columns are zero-based
        first_visible_row=int,
        start_row=int,
        start_col=int,
        end_row=int,
        end_col=int,
        sessionId=int
    )
)

State = NamedTuple(
    currentText=str,
    selections=ConstDict(
        int,
        NamedTuple(
            first_visible_row=int,
            start_row=int,
            start_col=int,
            end_row=int,
            end_col=int
        )
    )
)


def isValidChange(change):
    if change.matches.Edit:
        if change.line_start[0] < 0 or change.line_end[0] < 0:
            return False

        if change.line_start[0] != change.line_end[0]:
            return False

        if change.line_start[1] - change.line_start[0] != len(change.startText):
            return False

        if change.line_end[1] - change.line_end[0] != len(change.endText):
            return False

    return True


def lineRangeIsSubset(range1: Tuple(int, int), range2: Tuple(int, int)):
    return range1[0] >= range2[0] and range1[1] <= range2[1]


def lineRangeOverlaps(range1: Tuple(int, int), range2: Tuple(int, int)):
    return not (range1[0] > range2[1] or range1[1] < range2[0])


def lineRangeIntersection(range1: Tuple(int, int), range2: Tuple(int, int)):
    return Tuple(int, int)(max(range1[0], range2[0]), min(range1[1], range2[1]))


def areChangesContiguous(change1, change2):
    if change1.matches.Edit and change2.matches.Edit:
        if lineRangeOverlaps(change2.line_start, change1.line_end):
            intersection = lineRangeIntersection(change2.line_start, change1.line_end)

            endText = change1.endText[
                intersection[0] - change1.line_end[0]:intersection[1] - change1.line_end[0]
            ]
            startText = change2.startText[
                intersection[0] - change2.line_start[0]:intersection[1] - change2.line_start[0]
            ]

            return endText == startText

    return False


def produceDiff(text1, text2):
    if text1 == text2:
        return Change
    lines1 = text1.splitlines(True)
    lines2 = text2.splitlines(True)

    top = 0
    while top < len(lines1) and top < len(lines2) and lines1[top] == lines2[top]:
        top += 1

    bottom = 0
    while bottom < len(lines1) and bottom < len(lines2) and lines1[-1 - bottom] == lines2[-1 - bottom]:


def compressChanges(change1, change2):
    assert change1.matches.Edit and change2.matches.Edit
    assert lineRangeOverlaps(change2.line_start, change1.line_end)

    intersection = lineRangeIntersection(change2.line_start, change1.line_end)

    startText = change1.startText
    startRange = change1.line_start

    endText = change1.endText
    endRange = change2.line_end

    if change2.line_start[0] < change1.line_end[0]:
        # the second edit starts above where the first edit finished
        height = change1.line_end[0] - change2.line_start[0]
        startText = change2.startText[:height] + startText
        startRange = Tuple(int, int)(startRange[0] - height, startRange[1])

    if change2.line_start[1] > change1.line_end[1]:
        # the second edit ends below where the first edit finished
        height = change2.line_start[1] - change1.line_end[1]
        startText = startText + change2.startText[-height:]
        startRange = Tuple(int, int)(startRange[0], startRange[1] + height)

    if change1.line_end[0] < change2.line_start[0]:
        height = change2.line_start[0] - change1.line_end[0]
        endText = change1.endText[:height] + endText
        endRange = Tuple(int, int)(endRange[0] - height, endRange[1])

    if change1.line_end[1] > change2.line_start[1]:
        # the second edit ends below where the first edit finished
        height = change1.line_end[1] - change2.line_start[1]
        endText = endText + change1.endText[-height:]
        endRange = Tuple(int, int)(endRange[0], endRange[1] + height)

    change = Change.Edit(
        line_start=startRange,
        line_end=endRange,
        startText=startText,
        endText=endText
    )

    assert isValidChange(change)

    return change
