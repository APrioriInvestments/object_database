let isWordPart = (char) => {
    let cc = char.charCodeAt(0);
    if (cc >= 'a'.charCodeAt(0) && cc <= 'z'.charCodeAt(0)) {
        return true;
    }
    if (cc >= 'A'.charCodeAt(0) && cc <= 'Z'.charCodeAt(0)) {
        return true;
    }
    if (cc >= '0'.charCodeAt(0) && cc <= '9'.charCodeAt(0)) {
        return true;
    }
    if (char == '_') {
        return true;
    }
    return false;
};

let isSymbol = (char) => {
    return '.,<>/?!@#$%^&*()-=_+`\'"'.includes(char);
};

let isSpace = (char) => {
    return char == ' ' || char == '\t';
};

let firstWhitespaceIx = (line) => {
    let firstWhitespace = 0;
    while (firstWhitespace < line.length && isSpace(line[firstWhitespace])) {
        firstWhitespace++;
    }

    return firstWhitespace;
};

class Cursor {
    constructor(lineOffset, colOffset, tailLine, tailCol, desiredCol) {
        // endpoints for the 'tail' of the cursor (when it's a selection)
        this.tailLineOffset = tailLine;
        this.tailColOffset = tailCol;

        // the head of the cursor
        this.lineOffset = lineOffset;
        this.colOffset = colOffset;

        // where in the line we'd like to be (but can't because the line is too long)
        this.desiredColOffset = desiredCol;

        this.offset = this.offset.bind(this);
        this.ensureValid = this.ensureValid.bind(this);
        this.touch = this.touch.bind(this);
        this.setDesiredToActual = this.setDesiredToActual.bind(this);
        this.removeTail = this.removeTail.bind(this);
        this.lineInserted = this.lineInserted.bind(this);
        this.lineRemoved = this.lineRemoved.bind(this);
        this.collapseLineIntoPrior = this.collapseLineIntoPrior.bind(this);
        this.rangeDeleted = this.rangeDeleted.bind(this);
        this.rangeInserted = this.rangeInserted.bind(this);
        this.newlineInserted = this.newlineInserted.bind(this);
        this.selectedRanges = this.selectedRanges.bind(this);
        this.getSelectedText = this.getSelectedText.bind(this);
        this.getHighlights = this.getHighlights.bind(this);
        this.getIdentity = this.getIdentity.bind(this);
        this.toEndOfLine = this.toEndOfLine.bind(this);
        this.toEndOfDocument = this.toEndOfDocument.bind(this);
        this.toStartOfLine = this.toStartOfLine.bind(this);
        this.toStartOfDocument = this.toStartOfDocument.bind(this);
        this.toJson = this.toJson.bind(this);
        this.offsetWord = this.offsetWord.bind(this);
        this.becomeTail = this.becomeTail.bind(this);
        this.offsetSections = this.offsetSections.bind(this);
        this.selectWord = this.selectWord.bind(this);
        this.nontrivialSelectedRange = this.nontrivialSelectedRange.bind(this);
    }

    toJson() {
        return {
            pos: [this.lineOffset, this.colOffset],
            tail: [this.tailLineOffset, this.tailColOffset],
            desiredCol: this.desiredColOffset
        }
    }

    static fromJson(json) {
        return new Cursor(
            json.pos[0],
            json.pos[1],
            json.tail[0],
            json.tail[1],
            json.desiredCol
        );
    }

    getIdentity() {
        return (
            this.tailLineOffset + "_"
            + this.tailColOffset + "_"
            + this.lineOffset + "_"
            + this.colOffset + "_"
            + this.owner
        );
    }

    clone() {
        return new Cursor(
            this.lineOffset,
            this.colOffset,
            this.tailLineOffset,
            this.tailColOffset,
            this.desiredColOffset
        );
    }

    setDesiredToActual() {
        this.desiredColOffset = this.colOffset;
    }

    hasTail() {
        return this.tailLineOffset != this.lineOffset || this.tailColOffset != this.colOffset;
    }

    // return a pair of line indices that are ordered, where we drop the last line if we
    // don't have anything selected in it
    nontrivialSelectedRange(lines) {
        if (this.tailLineOffset > this.lineOffset || this.tailLineOffset == this.lineOffset && this.tailColOffset > this.colOffset) {
            let a = this.lineOffset;
            let b = this.tailLineOffset;
            if (this.tailColOffset == 0 && this.tailLineOffset > this.lineOffset) {
                b -= 1;
            }

            return [a, b];
        } else {
            let a = this.tailLineOffset;
            let b = this.lineOffset;

            if (this.colOffset == 0 && this.lineOffset > this.tailLineOffset) {
                b -= 1;
            }

            return [a, b];
        }
    }

    ensureOrdered() {
        if (this.tailLineOffset > this.lineOffset || this.tailLineOffset == this.lineOffset &&
                this.tailColOffset > this.colOffset) {
            let p1 = [this.lineOffset, this.colOffset]
            let p2 = [this.tailLineOffset, this.tailColOffset]

            this.lineOffset = p2[0];
            this.colOffset = p2[1];

            this.tailLineOffset = p1[0];
            this.tailColOffset = p1[1];

            this.touch();
        }
    }

    // return a string representing this selection
    getSelectedText(lines) {
        let selRanges = this.selectedRanges(lines, false, false);

        let res = [];

        selRanges.map((rng) => {
            res.push(lines[rng[0]].substring(rng[1], rng[2]));
        });

        return res.join("\n");
    }

    // return a list of (lineIx, startCol, endCol) of selected character offsets
    selectedRanges(lines, includeLineGutterHighlight=true, includeLineOffsets=true) {
        let res = [];

        // this renders a 'selection' on the current line
        if (includeLineGutterHighlight) {
            res.push([this.lineOffset, -10, -1]);
        }

        if (!this.hasTail()) {
            return res;
        }

        let lineOffset = includeLineOffsets ? .5 : 0;

        if (this.tailLineOffset == this.lineOffset && this.tailColOffset != this.colOffset) {
            res.push([
                this.lineOffset,
                Math.min(this.tailColOffset, this.colOffset),
                Math.max(this.tailColOffset, this.colOffset)
            ])
        }
        if (this.tailLineOffset < this.lineOffset) {
            res.push([this.tailLineOffset, this.tailColOffset, lines[this.tailLineOffset].length + lineOffset]);

            for (let i = this.tailLineOffset + 1; i < this.lineOffset; i++) {
                res.push([i, 0, lines[i].length + lineOffset]);
            }

            res.push([this.lineOffset, 0, this.colOffset]);
        }

        if (this.tailLineOffset > this.lineOffset) {
            res.push([this.lineOffset, this.colOffset, lines[this.lineOffset].length + lineOffset]);

            for (let i = this.lineOffset + 1; i < this.tailLineOffset; i++) {
                res.push([i, 0, lines[i].length + lineOffset]);
            }

            res.push([this.tailLineOffset, 0, Math.max(this.tailColOffset, lineOffset)]);
        }

        return res;
    }

    getHighlights(
        lines,
        startLineIndex=0,
        endLineIndex=null,
        includeLineGutterHighlight=true,
        includeEndOfLineOffsets=true
    ) {
        let result = [];
        let text = this.getSelectedText(lines);

        if (text.trim() == '') {
            return result;
        }

        let ranges = this.selectedRanges(lines, false, false);
        let lineGutterColOffset = -10;
        let lineGutterTailColOffset = -1;
        endLineIndex = endLineIndex === null ? lines.length : endLineIndex;

        if (ranges.length == 0) {
            return result;
        } else if (ranges.length == 1) {
            // Search for a single line of text
            let [lineOffset, colOffset, tailColOffset] = ranges[0];

            for (let i = startLineIndex; i < endLineIndex; i++) {
                let line = lines[i];
                let j = 0;

                if (i == lineOffset) {
                    if (includeLineGutterHighlight) {
                        result.push([i, lineGutterColOffset, lineGutterTailColOffset]);
                    }

                    while (j < line.length) {
                        if (j + text.length > colOffset && j <= colOffset) {
                            result.push(ranges[0]);
                            j = tailColOffset + 1;
                        } else if (line.substring(j).startsWith(text)) {
                            result.push([i, j, j + text.length]);
                            j += text.length;
                        } else {
                            j++;
                        }
                    }
                } else {
                    let addedLineGutterHighlight = false;

                    while (j < line.length) {
                        if (line.substring(j).startsWith(text)) {
                            if (includeLineGutterHighlight && !addedLineGutterHighlight) {
                                result.push([
                                    i,
                                    lineGutterColOffset,
                                    lineGutterTailColOffset

                                ]);
                                addedLineGutterHighlight = true;
                            }

                            result.push([i, j, j + text.length]);
                            j += text.length;
                        } else {
                            j++;
                        }
                    }
                }
            }
        } else {
            // Search for multiple lines of text
            let i = startLineIndex;
            let firstLineOffset = ranges[0][0];
            let firstColOffset = ranges[0][1];
            let lastLineOffset = ranges[ranges.length - 1][0];
            let lastTailColOffset = ranges[ranges.length - 1][2];
            let subResult = [];
            let endOfLineOffset = includeEndOfLineOffsets ? 0.5 : 0;

            var pushRange = function(range, i) {
                let [lineOffset, colOffset, tailColOffset] = range;

                if (includeEndOfLineOffsets && i != ranges.length - 1) {
                    tailColOffset += endOfLineOffset;
                }

                if (includeLineGutterHighlight
                    && (
                        result.length == 0
                        || result[result.length - 1][0] != lineOffset
                    )
                ) {
                    result.push([lineOffset, lineGutterColOffset, lineGutterTailColOffset]);
                }

                result.push([lineOffset, colOffset, tailColOffset]);
            };

            while (i < endLineIndex) {
                let line = lines[i];
                let [lineOffset, colOffset, tailColOffset] = ranges[subResult.length];
                let testSubString = lines[lineOffset].substring(colOffset, tailColOffset);
                let currentSubString = line.substring(colOffset, tailColOffset);

                if (subResult.length == 0) {
                    colOffset = line.length - testSubString.length;
                    tailColOffset = line.length
                    currentSubString = line.substring(colOffset, tailColOffset);
                }

                if (currentSubString == testSubString) {
                    if (
                        subResult.length == 0
                        && result.length != 0
                        && result[result.length - 1][0] == i
                    ) {
                        if (colOffset >= lastTailColOffset) {
                            subResult.push([i, colOffset, tailColOffset]);
                        }
                    } else {
                        subResult.push([i, colOffset, tailColOffset]);
                    }

                    if (subResult.length == ranges.length) {
                        if (i == firstLineOffset) {
                            if (tailColOffset <= firstColOffset) {
                                subResult.forEach(pushRange);
                            }
                        } else {
                            subResult.forEach(pushRange);
                        }
                    }
                } else {
                    subResult = [];
                }

                if (i == firstLineOffset) {
                    subResult = [];
                    ranges.forEach(pushRange);
                    i = lastLineOffset;
                } else if (subResult.length == ranges.length) {
                    subResult = [];
                } else {
                    i++;
                }
            }
        }

        return result;
    }

    newlineInserted(lines, lineIx, colIx) {
        if (this.lineOffset == lineIx && this.colOffset >= colIx) {
            this.lineOffset += 1;
            this.colOffset -= colIx;
            this.setDesiredToActual();
            this.touch();
        }

        if (this.tailLineOffset == lineIx && this.tailColOffset >= colIx) {
            this.tailLineOffset += 1;
            this.tailColOffset -= colIx;
            this.setDesiredToActual();
            this.touch();
        }
    }

    rangeInserted(lines, lineIx, startCol, endCol) {
        if (this.lineOffset == lineIx && this.colOffset >= startCol) {
            this.colOffset += endCol - startCol;
            this.setDesiredToActual();
            this.touch();
        }

        if (this.tailLineOffset == lineIx && this.tailColOffset >= startCol) {
            this.tailColOffset += endCol - startCol;
            this.touch();
        }
    }

    rangeDeleted(lines, lineIx, startCol, endCol) {
        if (this.lineOffset == lineIx && this.colOffset > endCol) {
            this.colOffset -= endCol - startCol;
            this.setDesiredToActual();
            this.touch()
        } else if (this.lineOffset == lineIx && this.colOffset > startCol) {
            this.colOffset = startCol;
            this.setDesiredToActual();
            this.touch()
        }

        if (this.tailLineOffset == lineIx && this.tailColOffset > endCol) {
            this.tailColOffset -= endCol - startCol;
            this.touch()
        } else if (this.tailLineOffset == lineIx && this.tailColOffset > startCol) {
            this.tailColOffset = startCol;
            this.touch()
        }
    }

    collapseLineIntoPrior(lines, lineIx, priorLineLength) {
        if (this.lineOffset == lineIx) {
            this.lineOffset -= 1;
            this.colOffset += priorLineLength;
            this.setDesiredToActual();
            this.touch();
        }

        if (this.tailLineOffset == lineIx) {
            this.tailLineOffset -= 1;
            this.tailColOffset += priorLineLength;
            this.touch();
        }
    }

    lineInserted(lines, lineIx) {
        if (this.lineOffset >= lineIx) {
            this.lineOffset += 1;
            this.touch();
        }
        if (this.tailLineOffset >= lineIx) {
            this.tailLineOffset += 1;
            this.touch();
        }

        this.ensureValid(lines);
    }

    lineRemoved(lines, lineIx) {
        if (this.lineOffset > lineIx) {
            this.lineOffset -= 1;
            this.touch();
        } else if (this.lineOffset == lineIx) {
            this.colOffset = 0;
            this.touch();
        }

        if (this.tailLineOffset > lineIx) {
            this.tailLineOffset -= 1;
            this.touch();
        } else if (this.tailLineOffset == lineIx) {
            this.tailColOffset = 0;
            this.touch();
        }

        this.ensureValid(lines);
    }

    touch() {}

    becomeTail() {
        this.colOffset = this.tailColOffset;
        this.lineOffset = this.tailLineOffset;
    }

    removeTail(forceEnd=false) {
        if (forceEnd) {
            if (this.tailLineOffset > this.lineOffset || this.tailLineOffset == this.lineOffset && this.tailColOffset > this.colOffset) {
                this.lineOffset = this.tailLineOffset;
                this.colOffset = this.tailColOffset;
                this.touch();
                return;
            }
        }

        if (this.tailLineOffset != this.lineOffset || this.tailColOffset != this.colOffset) {
            this.tailLineOffset = this.lineOffset;
            this.tailColOffset = this.colOffset;
            this.touch();
        }
    }

    ensureValid(lines) {
        if (this.lineOffset === null) {
            this.lineOffset = 0;
        }

        if (this.colOffset === null) {
            this.colOffset = 0;
        }

        if (this.desiredColOffset === null) {
            this.desiredColOffset = 0;
        }

        if (this.tailCol === null) {
            this.tailCol = 0;
        }

        if (this.tailLineOffset === null) {
            this.tailLineOffset = 0;
        }

        if (this.lineOffset < 0) {
            this.lineOffset = 0;
            this.colOffset = 0;
            this.touch();
        }

        if (this.lineOffset >= lines.length) {
            this.lineOffset = lines.length - 1;
            this.colOffset = lines[lines.length - 1].length;
            this.touch();
        }

        if (this.colOffset < 0) {
            this.colOffset = 0;
            this.touch();
        }

        if (this.colOffset > lines[this.lineOffset].length) {
            this.colOffset = lines[this.lineOffset].length;
            this.touch();
        }

        if (this.tailLineOffset < 0) {
            this.tailLineOffset = 0;
            this.tailColOffset = 0;
            this.touch();
        }

        if (this.tailLineOffset >= lines.length) {
            this.tailLineOffset = lines.length - 1;
            this.tailColOffset = lines[lines.length - 1].length;
            this.touch();
        }

        if (this.tailColOffset < 0) {
            this.tailColOffset = 0;
            this.touch();
        }

        if (this.tailColOffset > lines[this.tailLineOffset].length) {
            this.tailColOffset = lines[this.tailLineOffset].length;
            this.touch();
        }
    }

    toEndOfLine(lines) {
        this.colOffset = lines[this.lineOffset].length;
        this.desiredColOffset = 1e9;
        this.touch();
    }

    toStartOfLine(lines, seekWhitespaceFirst=false) {
        if (seekWhitespaceFirst) {
            let firstWhitespace = firstWhitespaceIx(lines[this.lineOffset]);

            if (this.colOffset == firstWhitespace) {
                this.colOffset = 0;
            } else {
                this.colOffset = firstWhitespace;
            }
        } else {
            this.colOffset = 0;
        }

        this.desiredColOffset = this.colOffset;
        this.touch();
    }

    toEndOfDocument(lines) {
        this.lineOffset = lines.length - 1;
        this.colOffset = lines[lines.length - 1].length;
        this.desiredColOffset = 1e9;
        this.touch();
    }

    toStartOfDocument(lines) {
        this.lineOffset = 0;
        this.colOffset = 0;
        this.desiredColOffset = 0;
        this.touch();
    }

    selectWord(lines) {
        this.removeTail();

        let line = lines[this.lineOffset];
        let wordStart = this.colOffset;
        let wordEnd = this.colOffset;

        while (wordEnd < line.length && isWordPart(line[wordEnd])) {
            wordEnd += 1;
        }

        while (wordStart > 0 && isWordPart(line[wordStart - 1])) {
            wordStart -= 1;
        }

        this.tailLineOffset = this.lineOffset;
        this.tailColOffset = wordStart;
        this.colOffset = wordEnd;
        this.desiredColOffset = this.colOffset;
    }

    selectLine(lines, goToNextLine=true) {
        this.removeTail();
        this.tailColOffset = 0;

        if (goToNextLine && this.lineOffset < lines.length - 1) {
            this.lineOffset += 1;
            this.colOffset = 0;
            this.desiredColOffset = 0;
        } else {
            this.colOffset = lines[this.lineOffset].length;
            this.desiredColOffset = this.colOffset;
        }
    }

    searchForwardFor(lines, text) {
        let searchLines = text.split('\n');

        if (searchLines.length == 1) {
            let index = lines[this.lineOffset].indexOf(searchLines[0], this.colOffset);

            if (index >= 0) {
                this.tailColOffset = index;
                this.colOffset = index + searchLines[0].length;
                this.desiredColOffset = this.colOffset;
                this.touch();
                return true;
            }

            let lineOffset = this.lineOffset + 1;
            while (lineOffset < lines.length) {
                index = lines[lineOffset].indexOf(searchLines[0]);

                if (index >= 0) {
                    this.tailColOffset = index;
                    this.colOffset = index + searchLines[0].length;
                    this.desiredColOffset = this.colOffset;
                    this.lineOffset = lineOffset;
                    this.tailLineOffset = lineOffset;
                    this.touch();
                    return true;
                }

                lineOffset++;
            }

            return false;
        } else {
            let isMatch = (lineOffset) => {
                if (lineOffset + searchLines.length > lines.length) {
                    return false;
                }

                if (!lines[lineOffset].endsWith(searchLines[0])) {
                    return false;
                }

                for (let i = 1; i < searchLines.length - 1; i++) {
                    if (lines[lineOffset + i] != searchLines[i]) {
                        return false;
                    }
                }

                if (!lines[lineOffset + searchLines.length - 1].startsWith(searchLines[searchLines.length - 1])) {
                    return false;
                }

                return true;
            }

            let lineOffset = this.lineOffset;

            while (lineOffset < lines.length) {
                if (isMatch(lineOffset)) {
                    this.tailLineOffset = lineOffset;
                    this.tailCol = lines[lineOffset].length - searchLines[0].length;

                    this.lineOffset = lineOffset + searchLines.length - 1;
                    this.colOffset = searchLines[searchLines.length - 1].length;
                    this.desiredColOffset = this.colOffset;
                    this.touch();
                    return true;
                }

                lineOffset++;
            }
            return false;
        }
    }

    offsetSections(constants, lines, direction) {
        let lineIx = this.lineOffset;

        if (direction < 0) {
            if (lineIx == 0) {
                this.colOffset = 0;
                this.desiredColOffset = 0;
                this.touch();
                return;
            }

            lineIx--;

            while (lineIx > 0 && !lines[lineIx].startsWith(constants.sectionStarter)) {
                lineIx--;
            }

            this.lineOffset = lineIx;
            this.colOffset = Math.max(0, Math.min(this.desiredColOffset, lines[lineIx].length));
            this.touch();
            return;
        } else {
            if (lineIx == lines.length - 1) {
                this.colOffset = lines[lineIx].length;
                this.desiredColOffset = lines[lineIx].length;
                this.touch();
                return;
            }

            lineIx++;

            while (lineIx + 1 < lines.length && !lines[lineIx].startsWith(constants.sectionStarter)) {
                lineIx++;
            }

            this.lineOffset = lineIx;
            this.colOffset = Math.max(0, Math.min(this.desiredColOffset, lines[lineIx].length));
            this.touch();
            return;
        }
    }

    // offset the cursor by a single word (e.g. "ctrl->arrow")
    // skipWordAfterSpacePolicy - if true, then if we are on whitespace, skip that and then
    //      continue to skip. Otherwise, if we're on whitespace just stop after that.
    //      if null, then do the standard thing (true on the right, false on the left)
    offsetWord(
        lines,
        toRight,
        skipWordAfterSpacePolicy=null,
        noChangeIfAtEndOfWord=false
    ) {
        let line = lines[this.lineOffset];
        let co = this.colOffset;

        if (toRight) {
            if (skipWordAfterSpacePolicy === null) {
                skipWordAfterSpacePolicy = true;
            }

            if (co >= line.length) {
                if (this.lineOffset + 1 < lines.length) {
                    this.colOffset = 0;
                    this.desiredColOffset = 0;
                    this.lineOffset++;
                    this.touch();
                    return;
                }
                return;
            }

            // check if we want to do nothing
            if (noChangeIfAtEndOfWord) {
                if (co > 0 && co <= line.length && isWordPart(line[co - 1]) &&
                        (co == line.length || !isWordPart(line[co]))) {
                    return;
                }
            }

            if (isSpace(line[co])) {
                while (co < line.length && isSpace(line[co])) {
                    co++;
                }

                if (!skipWordAfterSpacePolicy) {
                    this.colOffset = co;
                    this.desiredColOffset = co;
                    this.touch();
                    return;
                }
            }

            if (co < line.length && isWordPart(line[co])) {
                // search forward until we are not on a word char
                while (co < line.length && isWordPart(line[co])) {
                    co++;
                }
            } else if (co < line.length && isSymbol(line[co])) {
                // search forward until we are not on a word char
                while (co < line.length && isSymbol(line[co])) {
                    co++;
                }
                if (co < line.length && isWordPart(line[co])) {
                    while (co < line.length && isWordPart(line[co])) {
                        co++;
                    }
                }
            } else {
                while (co < line.length && !isSymbol(line[co]) && !isWordPart(line[co])) {
                    co++;
                }
            }

            this.colOffset = co;
            this.desiredColOffset = co;
            this.touch();
            return;
        } else {
            if (skipWordAfterSpacePolicy === null) {
                skipWordAfterSpacePolicy = false;
            }

            if (co == 0) {
                if (this.lineOffset > 0) {
                    this.lineOffset--;
                    this.colOffset = lines[this.lineOffset].length;
                    this.desiredColOffset = this.colOffset;
                    this.touch();
                    return;
                }
                return;
            }

            // check if we want to do nothing
            if (noChangeIfAtEndOfWord) {
                if (co > 0 && co <= line.length && !isWordPart(line[co - 1])) {
                    return;
                }
                if (co < line.length && isWordPart(line[co]) && (co == 0 || !isWordPart(line[co - 1]))) {
                    return;
                }
            }

            if (co > 0 && isSpace(line[co - 1])) {
                while (co > 0 && isSpace(line[co - 1])) {
                    co--;
                }

                if (!skipWordAfterSpacePolicy) {
                    this.colOffset = co;
                    this.desiredColOffset = co;
                    this.touch();
                    return;
                }
            }

            if (co > 0 && isWordPart(line[co - 1])) {
                // search forward until we are not on a word char
                while (co > 0 && isWordPart(line[co - 1])) {
                    co--;
                }
            } else if (co > 0 && isSymbol(line[co - 1])) {
                // search forward until we are not on a word char
                while (co > 0 && isSymbol(line[co - 1])) {
                    co--;
                }
                if (co > 0 && isWordPart(line[co - 1])) {
                    while (co > 0 && isWordPart(line[co - 1])) {
                        co--;
                    }
                }
            } else {
                while (co > 0 && !isSymbol(line[co - 1]) && !isWordPart(line[co - 1])) {
                    co--;
                }
            }

            this.colOffset = co;
            this.desiredColOffset = co;
            this.touch();
            return;
        }
    }

    offset(lines, x, y, isShifted=false) {
        if (lines.length == 0) {
            this.desiredColOffset = 0;
            this.lineOffset = 0;
            this.touch();
            return;
        }

        if (this.hasTail() && x == 1 && y == 0 && !isShifted) {
            this.removeTail(true);
            this.touch();
            return;
        }

        if (this.hasTail() && x == -1 && y == 0 && !isShifted) {
            this.ensureOrdered();
            this.lineOffset = this.tailLineOffset;
            this.colOffset = this.tailColOffset;
            this.desiredColOffset = this.colOffset;
            this.touch();
            return;
        }

        // desired col offset only should affect us when we are
        // moving between lines.
        if (y == 0) {
            this.desiredColOffset = this.colOffset;
        }

        this.desiredColOffset += x;
        this.lineOffset += y;

        if (this.lineOffset < 0) {
            this.lineOffset = 0;
            this.desiredColOffset = 0;
            this.colOffset = 0;
            this.touch();
            return;
        }

        if (this.lineOffset >= lines.length) {
            this.lineOffset = lines.length - 1;
            this.desiredColOffset = lines[this.lineOffset].length;
            this.colOffset = lines[this.lineOffset].length;
        }

        if (x != 0) {
            if (this.desiredColOffset < 0) {
                if (this.lineOffset == 0) {
                    this.desiredColOffset = 0;
                    this.colOffset = 0;
                    this.touch();
                    return;
                }

                this.lineOffset -= 1;
                this.desiredColOffset = lines[this.lineOffset].length;
                this.colOffset = this.desiredColOffset;
            } else if (this.desiredColOffset > lines[this.lineOffset].length) {
                if (this.lineOffset == lines.length - 1) {
                    this.desiredColOffset = lines[this.lineOffset].length;
                    this.colOffset = this.desiredColOffset;
                    this.touch();
                    return;
                }

                this.lineOffset += 1;
                this.desiredColOffset = 0;
                this.colOffset = 0;
            }
        }

        this.colOffset = Math.max(0, Math.min(lines[this.lineOffset].length, this.desiredColOffset));
        this.touch();
    }
};


export {Cursor, firstWhitespaceIx};
