import {Cursor, firstWhitespaceIx} from './Cursor';

// build a little state model for 'line' dictating how a multiline string
// state machine would work. ' "\'' means no change. otherwise, a string 'abc'
// where 'a' indicates the state of the system if we are not in a multiline
// string coming in, 'b' is the state of the system if we were in a """ string
// coming in, and 'c' is the state if we are in a ''' state.  a, b, or c will be
// ' ' if no string state exists, "'" if we exit in a ''' string, and '"' if we
// exit in a """ string
let STRING_STATE_UNCHANGED = ' "\'';
let computeNetMultilineString = (line) => {
    // first, determine the state if we are not in a triple quoted string at all
    let computeState = (inString) => {
        let i = 0;
        while (i + 2 < line.length) {
            if (line[i] == '\\') {
                i += 2;
            } else {
                if (inString == ' ') {
                    if (line[i] == '"' && line[i+1] == '"' && line[i+2] == '"') {
                        inString = '"';
                        i += 3;
                    } else if (line[i] == "'" && line[i+1] == "'" && line[i+2] == "'") {
                        inString = "'";
                        i += 3;
                    } else {
                        i++;
                    }
                } else {
                    if (line[i] == inString && line[i+1] == inString && line[i+2] == inString) {
                        i += 3;
                        inString = ' ';
                    } else {
                        i++;
                    }
                }
            }
        }

        return inString;
    };

    let a = computeState(' ');
    let b = computeState('"');
    let c = computeState("'");

    return a + b + c;
};

class DataModel {
    constructor(constants, readOnly=false, initialLines=null, initialCursors=null) {
        this.constants = constants;
        this.lines = initialLines === null ? [""] : initialLines.map((x) => x);

        // for each line, helps keep track of whether we're starting or ending a
        // multiline string.
        this.lineNetMultilineString = this.lines.map(computeNetMultilineString);

        // if not null, then this contains null, '"', or "'" indicating whether
        // we're in a multiline string coming _into_ this line
        this.isInMultilineString = null;

        this.readOnly = readOnly;
        this.cursors = initialCursors === null ? [new Cursor(0, 0, 0, 0, 0)] : initialCursors.map((x) => x);

        this.cursorAtLastCheckpoint = this.cursors.map((cursor) => cursor.toJson());
        this.changesSinceLastCheckpoint = [];

        // direct manipulation of the lines collection. will update cursors.
        this.replaceLine = this.replaceLine.bind(this);
        this.insertLine = this.insertLine.bind(this);
        this.removeLine = this.removeLine.bind(this);

        // higher-level functions for manipulating text based on a cursor. updates cursors.
        this.insertChar = this.insertChar.bind(this);
        this.insertCharOnRange = this.insertCharOnRange.bind(this);
        this.insertNewline = this.insertNewline.bind(this);
        this.deleteChar = this.deleteChar.bind(this);
        this.collapseLineIntoPrior = this.collapseLineIntoPrior.bind(this);
        this.deleteRange = this.deleteRange.bind(this);
        this.clearCursorOverlap = this.clearCursorOverlap.bind(this);
        this.replaceText = this.replaceText.bind(this);
        this.collapseCommonCursors = this.collapseCommonCursors.bind(this);
        this.pasteText = this.pasteText.bind(this);
        this.tabKey = this.tabKey.bind(this);
        this.toggleComment = this.toggleComment.bind(this);
        this.pageBy = this.pageBy.bind(this);
        this.getIsInMultilineString = this.getIsInMultilineString.bind(this);
        this.updateCursorAtLastCheckpoint = this.updateCursorAtLastCheckpoint.bind(this);

        // handle a keystroke
        this.handleKey = this.handleKey.bind(this);

        // eventing
        this.pushEvent = this.pushEvent.bind(this);
        this.collectChanges = this.collectChanges.bind(this);

        this.startClick = this.startClick.bind(this);
        this.continueClick = this.continueClick.bind(this);
    }

    getIsInMultilineString() {
        if (this.isInMultilineString !== null) {
            if (this.isInMultilineString.length != this.lines.length + 1) {
                throw new Error(
                    "isInMultilineString should have one more element than 'lines'"
                )
            }
            return this.isInMultilineString;
        }

        this.isInMultilineString = [];
        let curState = ' ';

        for (let i = 0; i < this.lineNetMultilineString.length; i++) {
            this.isInMultilineString.push(curState);

            if (this.lineNetMultilineString[i] !== STRING_STATE_UNCHANGED) {
                let newState = (
                    curState === ' ' ? this.lineNetMultilineString[i][0] :
                    curState == '"' ? this.lineNetMultilineString[i][1] :
                    this.lineNetMultilineString[i][2]
                );

                curState = newState;
            }
        }

        // there should always be one more, since this is the _incoming_ state
        // and we need to know what will happen for the last line
        this.isInMultilineString.push(curState);

        return this.isInMultilineString;
    }

    updateCursorAtLastCheckpoint() {
        this.cursorAtLastCheckpoint = this.cursors.map((cursor) => cursor.toJson());
    }

    // return a canonical 'event' giving the difference between
    // the current and prior states of the DataModel (since last call).
    // events contains enough information to completely replay the state
    // of the system.
    collectChanges(editSessionId, reason, priorEventGuid, eventGuid) {
        let changes = this.changesSinceLastCheckpoint;
        let cursors = this.cursorAtLastCheckpoint;

        this.changesSinceLastCheckpoint = [];
        this.cursorAtLastCheckpoint = this.cursors.map((cursor) => cursor.toJson());

        return {
            changes: changes,
            startCursors: cursors,
            newCursors: this.cursorAtLastCheckpoint,
            timestamp: Date.now() / 1000.0,
            undoState: null,
            editSessionId: editSessionId,
            priorEventGuid: priorEventGuid,
            eventGuid: eventGuid,
            reason: reason
        };
    }

    lineRangeForSection(constants, sectionName, sectionNumber) {
        for (let i = 0; i < this.lines.length; i++) {
            if (this.lines[i] == sectionName) {
                if (sectionNumber == 0) {
                    for (let j = i + 1; j < this.lines.length; j++) {
                        if (this.lines[j].startsWith(constants.sectionStarter)) {
                            return [i, j]
                        }
                    }

                    return [i, this.lines.length];
                } else {
                    sectionNumber--;
                }
            }
        }

        return null;
    }

    /************** low-level line manipulation **************/
    replaceLine(lineIx, newVal) {
        if (!Number.isInteger(lineIx)) {
            throw Error("lineIx must be an int.");
        }

        let oldLine = this.lines[lineIx];

        // don't do anything if we don't need to
        if (oldLine == newVal) {
            return;
        }

        this.lines[lineIx] = newVal;

        let newMultilineState = computeNetMultilineString(newVal);

        if (newMultilineState != this.lineNetMultilineString[lineIx]) {
            this.isInMultilineString = null;
        }
        this.lineNetMultilineString[lineIx] = newMultilineState;

        this.cursors.map((cursor) => cursor.ensureValid(this.lines));

        this.changesSinceLastCheckpoint.push({
            oldLines: [oldLine],
            newLines: [newVal],
            lineIndex: lineIx
        });
    }

    insertLine(lineIx, newVal) {
        if (!Number.isInteger(lineIx)) {
            throw Error("lineIx must be an int.");
        }

        this.changesSinceLastCheckpoint.push({
            oldLines: [],
            newLines: [newVal],
            lineIndex: lineIx
        });

        this.lines.splice(lineIx, 0, newVal);
        let newMultilineState = computeNetMultilineString(newVal);

        if (newMultilineState != STRING_STATE_UNCHANGED) {
            this.isInMultilineString = null;
        } else {
            // just repeat the current value
            if (this.isInMultilineString !== null) {
                this.isInMultilineString.splice(
                    lineIx, 0, this.isInMultilineString[lineIx]
                );
            }
        }

        this.lineNetMultilineString.splice(
            lineIx, 0, newMultilineState
        );

        this.cursors.map(
            (cursor) => {
                cursor.lineInserted(this.lines, lineIx);
            }
        );
    }

    removeLine(lineIx) {
        if (!Number.isInteger(lineIx)) {
            throw Error("lineIx must be an int.");
        }

        this.changesSinceLastCheckpoint.push({
            oldLines: [this.lines[lineIx]],
            newLines: [],
            lineIndex: lineIx
        });

        this.lines.splice(lineIx, 1);

        if (this.lineNetMultilineString[lineIx] != STRING_STATE_UNCHANGED) {
            this.isInMultilineString = null;
        } else {
            if (this.isInMultilineString !== null) {
                this.isInMultilineString.splice(lineIx, 1);
            }
        }

        this.lineNetMultilineString.splice(lineIx, 1);

        this.cursors.map(
            (cursor) => {
                cursor.lineRemoved(this.lines, lineIx);
            }
        );
    }

    /************** high level manipulation **************/
    collapseLineIntoPrior(lineIx) {
        let upperLine = this.lines[lineIx - 1];
        let curLine = this.lines[lineIx];

        this.replaceLine(lineIx - 1, upperLine + curLine);

        this.cursors.map((c) => {
            c.collapseLineIntoPrior(this.lines, lineIx, upperLine.length);
        });

        this.removeLine(lineIx);
    }

    // only keep unique cursors.
    collapseCommonCursors() {
        let idToCursor = {};

        let newCursors = [];

        for (let i = 0; i < this.cursors.length; i++) {
            let id = this.cursors[i].getIdentity();
            if (idToCursor[id] === undefined) {
                idToCursor[id] = this.cursors[i];
                newCursors.push(this.cursors[i]);
            }
        }

        this.cursors = newCursors;
    }

    replaceText(cursor, newText) {
        this.clearCursorOverlap(cursor);

        let lines = newText.split("\n");

        for (let i = 0; i < lines.length; i++) {
            this.insertChar(cursor, lines[i]);
            if (i + 1 < lines.length) {
                this.insertNewline(cursor);
            }
        }
    }

    // delete anything the cursor is currently hovering over
    clearCursorOverlap(cursor) {
        if (!cursor.hasTail()) {
            return;
        }

        let startRow = cursor.tailLineOffset;
        let startCol = cursor.tailColOffset;
        let endRow = cursor.lineOffset;
        let endCol = cursor.colOffset;

        if (startRow > endRow || startRow == endRow && startCol > endCol) {
            endRow = cursor.tailLineOffset;
            endCol = cursor.tailColOffset;
            startRow = cursor.lineOffset;
            startCol = cursor.colOffset;
        }

        if (startRow < endRow) {
            this.deleteRange(startRow, startCol, this.lines[startRow].length);
            this.deleteRange(endRow, 0, endCol);
            for (let i = startRow + 1; i < endRow; i++) {
                this.removeLine(startRow + 1);
            }
            this.collapseLineIntoPrior(startRow + 1);
        } else {
            this.deleteRange(startRow, startCol, endCol);
        }
    }

    deleteRange(lineIx, startCol, endCol) {
        let curLine = this.lines[lineIx];

        let leftPart = curLine.substring(0, startCol);
        let rightPart = curLine.substring(endCol);

        this.cursors.map((c) => {
            c.rangeDeleted(this.lines, lineIx, startCol, endCol);
        });

        this.replaceLine(lineIx, leftPart + rightPart);
    }

    deleteChar(cursor, direction) {
        this.clearCursorOverlap(cursor);

        let lineIx = cursor.lineOffset;

        let curLine = this.lines[lineIx];

        let colIx = cursor.colOffset;

        if (direction < 0 && colIx == 0) {
            // this is deleting a newline
            if (lineIx == 0) {
                return;
            }

            this.collapseLineIntoPrior(lineIx)
            return;
        }

        if (direction == 1 && colIx == curLine.length) {
            if (lineIx == this.lines.length - 1) {
                return;
            }

            this.collapseLineIntoPrior(lineIx + 1);
        return;
        }


        let leftPart = curLine.substring(0, cursor.colOffset + Math.min(0, direction));
        let rightPart = curLine.substring(cursor.colOffset + Math.max(0, direction));

        this.cursors.map((c) => {
            if (direction > 0) {
                c.rangeDeleted(this.lines, lineIx, colIx, colIx + direction);
            } else {
                c.rangeDeleted(this.lines, lineIx, colIx + direction, colIx);
            }
        });

        this.replaceLine(lineIx, leftPart + rightPart);
    }

    // insert a single character or a set of text without newlines
    insertCharOnRange(lineIx, colIx, char) {
        let curLine = this.lines[lineIx];
        let leftPart = curLine.substring(0, colIx);
        let rightPart = curLine.substring(colIx);

        this.replaceLine(lineIx, leftPart + char + rightPart);

        this.cursors.map((c) => {
            c.rangeInserted(this.lines, lineIx, colIx, colIx + char.length);
        });
    }

    insertChar(cursor, char) {
        this.clearCursorOverlap(cursor);
        this.insertCharOnRange(cursor.lineOffset, cursor.colOffset, char);
    }

    insertNewline(cursor, andAlsoWhitespace=false) {
        this.clearCursorOverlap(cursor);

        let curLine = this.lines[cursor.lineOffset];
        let leftPart = curLine.substring(0, cursor.colOffset);
        let rightPart = curLine.substring(cursor.colOffset);

        let lineIx = cursor.lineOffset;
        let colIx = cursor.colOffset;

        this.insertLine(lineIx + 1, rightPart);

        this.cursors.map((c) => {
            c.newlineInserted(this.lines, lineIx, colIx);
        });

        this.replaceLine(lineIx, leftPart);

        if (andAlsoWhitespace) {
            let leftPartWs = leftPart.length - 1;

            while (leftPartWs >= 0 && leftPart[leftPartWs] == ' ') {
                leftPartWs -= 1;
            }

            let wsToAdd = Math.min(firstWhitespaceIx(curLine), colIx);

            if (leftPartWs >= 0 && leftPart[leftPartWs] == ':') {
                wsToAdd = Math.floor((wsToAdd + 4) / 4) * 4;
            }

            this.insertChar(
                cursor,
                ' '.repeat(wsToAdd)
            );
        }
    }

    /***** non-editing interface ********/
    // apply an 'event' which is a record of a state change
    // this doesn't create any new events
    pushEvent(event) {
        if (this.changesSinceLastCheckpoint.length) {
            throw new Error('DataModel has changes. cant accept an event');
        }

        // we don't have to worry about keeping our cursors up to date
        event.changes.map((change) => {
            this.lines.splice(
                change.lineIndex, change.oldLines.length, ... change.newLines
            );
            this.lineNetMultilineString.splice(
                change.lineIndex, change.oldLines.length, ... change.newLines.map(
                    computeNetMultilineString
                )
            );
            this.isInMultilineString = null;
        })

        this.cursors = event.newCursors.map(
            (json) => Cursor.fromJson(json)
        );

        if (this.lines.length == 0) {
            throw new Error("DataModel ended up with no lines somehow");
        }

        this.cursors.forEach(cursor => {
            if (cursor.lineOffset < 0 || cursor.lineOffset >= this.lines.length) {
                throw new Error("DataModel ended up with a bad cursor.");
            }
            if (cursor.colOffset < 0 || cursor.colOffset > this.lines[cursor.lineOffset].length) {
                throw new Error("DataModel ended up with a bad cursor.");
            }
            if (cursor.tailLineOffset < 0 || cursor.tailLineOffset >= this.lines.length) {
                throw new Error("DataModel ended up with a bad cursor.");
            }
            if (cursor.tailColOffset < 0 || cursor.tailColOffset > this.lines[cursor.tailLineOffset].length) {
                throw new Error("DataModel ended up with a bad cursor.");
            }
        });

        this.cursorAtLastCheckpoint = event.newCursors;
    }

    pushEventButRetainCursors(event) {
        if (this.changesSinceLastCheckpoint.length) {
            throw new Error('DataModel has changes. cant accept an event');
        }

        event.changes.map((change) => {
            for (let i = 0; i < change.newLines.length && i < change.oldLines.length;i++) {
                this.replaceLine(change.lineIndex + i, change.newLines[i]);
            }

            for (let i = change.newLines.length; i < change.oldLines.length; i++) {
                this.removeLine(change.lineIndex + change.newLines.length);
            }

            for (let i = change.oldLines.length; i < change.newLines.length; i++) {
                this.insertLine(change.lineIndex + i, change.newLines[i]);
            }

            // reset the changes
            this.changesSinceLastCheckpoint = [];
        });
    }

    toggleComment(constants) {
        this.cursors.map((cursor) => {
            // toggle comments for this cursor
            let [topLine, bottomLine] = cursor.nontrivialSelectedRange(this.lines);

            let lineIsCommented = (ix) => {
                if (ix < 0 || ix >= this.lines.length) {
                    return true;
                }

                let wsIx = firstWhitespaceIx(this.lines[ix]);
                if (wsIx < this.lines[ix].length) {
                    if (this.lines[ix][wsIx] == '#') {
                        return true;
                    }
                    return false;
                }

                return true;
            };

            let rangeIsCommented = () => {
                for (let i = topLine; i <= bottomLine; i++) {
                    if (!lineIsCommented(i)) {
                        return false;
                    }
                }

                return true;
            }

            if (rangeIsCommented()) {
                for (let i = topLine; i <= bottomLine; i++) {
                    let firstWS = firstWhitespaceIx(this.lines[i]);

                    if (firstWS < this.lines[i].length && this.lines[i][firstWS] == '#') {
                        this.deleteRange(i, firstWS, firstWS + 1);
                    }
                }
            } else {
                let minWs = -1;

                for (let i = topLine; i <= bottomLine; i++) {
                    let ws = firstWhitespaceIx(this.lines[i]);
                    if (ws < this.lines[i].length) {
                        if (minWs == -1 || ws < minWs) {
                            minWs = ws;
                        }
                    }
                }

                if (minWs >= 0) {
                    for (let i = topLine; i <= bottomLine; i++) {
                        if (firstWhitespaceIx(this.lines[i]) < this.lines[i].length) {
                            this.insertCharOnRange(i, minWs, '#')
                        }
                    }
                }
            }
        })
    }

    tabKey(wasShift, constants) {
        let anyCursorsMultline = () => {
            for (let i = 0; i < this.cursors.length; i++) {
                if (this.cursors[i].lineOffset != this.cursors[i].tailLineOffset) {
                    return true;
                }
            }

            return false;
        };

        if (anyCursorsMultline()) {
            let linesToIndent = {};
            this.cursors.map((cursor) => {
                cursor.selectedRanges(this.lines, false).map((range) => {
                    linesToIndent[range[0]] = true;
                });
            });

            let spaces = ' '.repeat(constants.spacesPerTab);

            Object.keys(linesToIndent).map((lineIxAsStr) => {
                let lineIx = parseInt(lineIxAsStr);

                if (!wasShift) {
                    this.insertCharOnRange(lineIx, 0, spaces);
                } else {
                    let line = this.lines[lineIx];
                    let i = 0;
                    while (i < constants.spacesPerTab && i < line.length && line[i] == ' ') {
                        i++;
                    }

                    this.deleteRange(lineIx, 0, i);
                }
            });
        } else {
            this.cursors.map((cursor) => {
                if (wasShift &&
                        cursor.colOffset <= firstWhitespaceIx(this.lines[cursor.lineOffset])) {
                    this.deleteRange(
                        cursor.lineOffset,
                        Math.max(0, cursor.colOffset - constants.spacesPerTab),
                        cursor.colOffset
                    );
                } else {
                    this.insertChar(cursor, ' '.repeat(4 - (cursor.colOffset % 4)));
                }
            });
        }
    }

    pasteText(clipboardText) {
        clipboardText = clipboardText.replace("\t", "    ");

        let lines = clipboardText.split("\n")
        if (this.cursors.length > 1 && this.cursors.length == lines.length) {
            for (let i = 0; i < this.cursors.length; i++) {
                this.replaceText(this.cursors[i], lines[i]);
            }
        } else {
            this.cursors.map((cursor) => { this.replaceText(cursor, clipboardText); });
        }
    }

    pageBy(lineCount) {
        this.cursors.map((cursor) => {
            cursor.offset(this.lines, 0, lineCount);

            if (!event.shiftKey) {
                cursor.removeTail();
            }
        });
    }

    startClick(lineOffset, colOffset, ctrlKey, shiftKey) {
        if (shiftKey && this.cursors.length > 0) {
            let lastCursor = this.cursors[this.cursors.length - 1];
            lastCursor.colOffset = colOffset;
            lastCursor.lineOffset = lineOffset;
            lastCursor.touch();
            lastCursor.ensureValid(this.lines);
            return;
        }

        if (!ctrlKey) {
            this.cursors = [];
        }

        this.cursors.push(new Cursor(lineOffset, colOffset, lineOffset, colOffset, colOffset));
        this.cursors[this.cursors.length-1].ensureValid(this.lines);
    }

    continueClick(lineOffset, colOffset, isDoubleClick) {
        let curs = this.cursors[this.cursors.length - 1];

        curs.colOffset = colOffset;
        curs.lineOffset = lineOffset;

        let isToRight = (curs.lineOffset > curs.tailLineOffset ||
            curs.lineOffset == curs.tailLineOffset && curs.colOffset > curs.tailColOffset
        );

        if (isDoubleClick) {
            curs.offsetWord(this.lines, isToRight);
        }

        curs.touch();
        curs.ensureValid(this.lines);
    }

    // handle an event and return true if we consume the event.
    handleKey(event) {
        if (event.ctrlKey && !event.metaKey && !event.altKey && !event.shiftKey) {
            if (event.key == 'a') {
                // select all
                this.cursors = [new Cursor(0, 0, 0, 0, 0)];
                this.cursors[0].toEndOfDocument(this.lines);

                return true;
            }
        }

        if (event.ctrlKey && !event.metaKey && !event.altKey && !event.shiftKey) {
            if (event.key == 'd') {
                // take the last cursor
                let lastCursor = this.cursors[this.cursors.length-1];

                if (!lastCursor.hasTail()) {
                    lastCursor.selectWord(this.lines);
                } else {
                    let text = lastCursor.getSelectedText(this.lines);

                    let newCursor = lastCursor.clone();
                    newCursor.removeTail(true);

                    if (newCursor.searchForwardFor(this.lines, text)) {
                        this.cursors.push(newCursor);
                    }
                }

                return true;
            }
        }

        if (event.ctrlKey && !event.metaKey && !event.altKey && event.key == '/') {
            this.toggleComment(this.constants);
            return true;
        }

        if (!event.ctrlKey && !event.metaKey && !event.altKey && event.key == 'Tab') {
            this.tabKey(event.shiftKey, this.constants);
            return true;
        }

        if (!event.ctrlKey && !event.metaKey) {
            if (event.key == 'ArrowRight' || event.key == 'ArrowLeft' ||
                    event.key == 'ArrowUp' || event.key == 'ArrowDown') {
                var x = 0;
                var y = 0;

                if (event.key == 'ArrowRight') {
                    x = 1;
                    y = 0;
                }
                if (event.key == 'ArrowLeft') {
                    x = -1;
                    y = 0;
                }
                if (event.key == 'ArrowUp') {
                    x = 0;
                    y = -1;
                }
                if (event.key == 'ArrowDown') {
                    x = 0;
                    y = 1;
                }

                // navigate to the next section
                if (x == 0 && event.altKey && !event.shiftKey) {
                    this.cursors.map(
                        (cursor) => {
                            cursor.offsetSections(this.constants, this.lines, y);
                            cursor.removeTail();
                        }
                    );

                    return true;
                }

                // shift-alt-up/down arrow produces a new cursor
                if (event.altKey && event.shiftKey && x == 0) {
                    let newCursor = this.cursors[this.cursors.length-1].clone();
                    this.cursors.push();
                    this.cursors.push(newCursor);
                    newCursor.offset(this.lines, x, y, event.shiftKey);
                    newCursor.removeTail();
                } else {
                    this.cursors.map(
                        (cursor) => {
                            cursor.offset(this.lines, x, y, event.shiftKey);

                            if (!event.shiftKey) {
                                cursor.removeTail();
                            }
                        }
                    );
                }

                return true;
            }
        }

        if (event.ctrlKey && !event.altKey && !event.metaKey) {
            if (event.key == 'ArrowRight' || event.key == 'ArrowLeft') {
                this.cursors.map(
                    (cursor) => {
                        cursor.offsetWord(this.lines, event.key == 'ArrowRight');

                        if (!event.shiftKey) {
                            cursor.removeTail();
                        }
                    }
                );

                return true;
            }
        }

        if (event.key == 'End' && !event.metaKey && !event.altKey) {
            this.cursors.map((cursor) => {
                if (event.ctrlKey) {
                    cursor.toEndOfDocument(this.lines);
                } else {
                    cursor.toEndOfLine(this.lines);
                }

                if (!event.shiftKey) {
                    cursor.removeTail();
                }
            });
            return true;
        }

        if (event.key == 'Home' && !event.metaKey && !event.altKey) {
            this.cursors.map((cursor) => {
                if (event.ctrlKey) {
                    cursor.toStartOfDocument(this.lines);
                } else {
                    cursor.toStartOfLine(this.lines, true);
                }

                if (!event.shiftKey) {
                    cursor.removeTail();
                }
            });
            return true;
        }

        if (event.key == 'Escape') {
            this.cursors = [this.cursors[0]];
            return true;
        }

        if (event.key == 'Delete') {
            if (this.readOnly) {
                return false;
            }

            this.cursors.map((cursor) => {
                if (cursor.hasTail()) {
                    this.clearCursorOverlap(cursor);
                    return;
                }

                if (event.ctrlKey) {
                    cursor.offsetWord(
                        this.lines, true, false /* never delete whitespace and also a word */
                    );
                    this.clearCursorOverlap(cursor);
                } else {
                    this.deleteChar(cursor, 1);
                }
            });
            return true;
        }

        if (event.key == 'Backspace') {
            if (this.readOnly) {
                return false;
            }
            this.cursors.map((cursor) => {
                if (cursor.hasTail()) {
                    this.clearCursorOverlap(cursor);
                    return;
                }

                if (event.ctrlKey) {
                    cursor.offsetWord(
                        this.lines, false, false /* never delete whitespace and also a word */
                    );
                    this.clearCursorOverlap(cursor);
                    return;
                }

                if (
                    cursor.colOffset > 0 &&
                    cursor.colOffset <= firstWhitespaceIx(this.lines[cursor.lineOffset])
                ) {
                    let targetCol = cursor.colOffset - 1;
                    targetCol = targetCol - (targetCol % this.constants.spacesPerTab);

                    this.deleteRange(cursor.lineOffset, targetCol, cursor.colOffset);
                } else {
                    this.deleteChar(cursor, -1)
                }
            });
            return true;
        }

        if (event.key.length == 1 && !event.ctrlKey && !event.metaKey && !event.altKey) {
            if (this.readOnly) {
                return false;
            }
            this.cursors.map((cursor) => this.insertChar(cursor, event.key));
            return true;
        }

        if (event.key == 'Enter' && !event.ctrlKey && !event.metaKey && !event.altKey) {
            if (this.readOnly) {
                return false;
            }
            this.cursors.map((cursor) => this.insertNewline(cursor, true));
            return true;
        }

        return false;
    }
}

export {DataModel};
