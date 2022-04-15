import {makeDomElt as h} from '../Cell';
import {ConcreteCell} from '../ConcreteCell';
import {Cursor} from './Cursor';
import {ViewOfDivs} from '../util/ViewOfDivs';

let reservedWordRegex = new RegExp("\\b(and|as|assert|async|await|break|continue|del|"
    + "elif|else|except|False|finally|for|from|global|if|import|in|is|"
    + "None|nonlocal|not|or|pass|raise|return|True|try|while|with|yield)\\b",
    "g"
);

let SECONDS_UNTIL_CURSOR_BLURS = 30;
let SECONDS_TO_BLUR_CURSOR = 3;

let keywordRegex = new RegExp("\\b("
    + "lambda|def|class"
    + "|ArithmeticError|AssertionError|AttributeError|BaseException"
    + "|BlockingIOError|BrokenPipeError|BufferError|BytesWarning|ChildProcessError"
    + "|ConnectionAbortedError|ConnectionError|ConnectionRefusedError|ConnectionResetError"
    + "|DeprecationWarning|EOFError|Ellipsis|EnvironmentError|Exception|False|FileExistsError"
    + "|FileNotFoundError|FloatingPointError|FutureWarning|GeneratorExit|IOError|ImportError"
    + "|ImportWarning|IndentationError|IndexError|InterruptedError|IsADirectoryError"
    + "|KeyError|KeyboardInterrupt|LookupError|MemoryError|ModuleNotFoundError|NameError"
    + "|None|NotADirectoryError|NotImplemented|NotImplementedError|OSError|OverflowError"
    + "|PendingDeprecationWarning|PermissionError|ProcessLookupError|RecursionError"
    + "|ReferenceError|ResourceWarning|RuntimeError|RuntimeWarning|StopAsyncIteration"
    + "|StopIteration|SyntaxError|SyntaxWarning|SystemError|SystemExit|TabError"
    + "|TimeoutError|True|TypeError|UnboundLocalError|UnicodeDecodeError|UnicodeEncodeError"
    + "|UnicodeError|UnicodeTranslateError|UnicodeWarning|UserWarning|ValueError|Warning"
    + "|ZeroDivisionError|__build_class__|__debug__|__doc__|__import__|__loader__|__name__"
    + "|__package__|__spec__|abs|all|any|ascii|bin|bool|bytearray|bytes|callable|chr"
    + "|classmethod|compile|complex|copyright|credits|delattr|dict|dir|divmod"
    + "|enumerate|eval|exec|exit|filter|float|format|frozenset|getattr|globals|hasattr|hash"
    + "|help|hex|id|input|int|isinstance|issubclass|iter|len|license|list|locals|map|max"
    + "|memoryview|min|next|object|oct|open|ord|pow|print|property|quit|range|repr|reversed"
    + "|round|set|setattr|slice|sorted|staticmethod|str|sum|super|tuple|type|vars|zip)\\b",
    "g"
);

class RenderedCursor {
    constructor(renderModel, cursor, username=null, isPrimaryCursor=false, lastUpdateTimestamp=null) {
        this.renderModel = renderModel;
        this.cursor = cursor;
        this.lastUpdateTimestamp = lastUpdateTimestamp;
        this.username = username;
        this.isPrimaryCursor = isPrimaryCursor;

        this.render = this.render.bind(this);
    }

    render(renderingModel, lines) {
        let isOtherCursor = this.username !== null && this.username !== undefined;

        let constants = renderingModel.constants;

        let leftPx = constants.gutterWidth
            + this.cursor.colOffset * constants.charWidth
            + constants.cursorHShift;

        let topPx = this.cursor.lineOffset * constants.lineHeight
            - constants.cursorVExtent + constants.topPxOffset;

        let heightPx = constants.lineHeight + 2 * constants.cursorVExtent;
        let widthPx = constants.cursorWidth;

        let res = [h('div', {
            'class': isOtherCursor ? 'editor-cursor-other-user' : 'editor-cursor',
            'style': 'left: ' + leftPx + "px;top: " + topPx + "px;"
                + 'width:' + widthPx + "px;height:" + heightPx + "px;"
                + 'background-color: ' + (isOtherCursor ? constants.cursorColorOther : constants.cursorColor),
        })];

        if (isOtherCursor) {
            // pick the position where we're going to show this highlight
            let curCol = this.cursor.colOffset + 3;
            let curRow = this.cursor.lineOffset - 2;

            while (curRow >= 0 && curRow < lines.length && curCol < lines[curRow].length + 3) {
                curRow -= 1;
                curCol += 1;
            }

            if (curRow < 0) {
                curRow = this.cursor.lineOffset + 2;
                curCol = this.cursor.colOffset + 3;

                while (curRow >= 0 && curRow < lines.length && curCol < lines[curRow].length + 3) {
                    curRow += 1;
                    curCol += 1;
                }
            }

            if (curRow >= 0) {
                let labelLeftPx = constants.gutterWidth
                    + curCol * constants.charWidth
                    + constants.cursorHShift;

                let labelTopPx = curRow * constants.lineHeight
                    - constants.cursorVExtent + constants.topPxOffset;

                res.push(
                    h('div', {
                        'class': 'editor-cursor-name-label',
                        'style': 'left: ' + labelLeftPx + "px;top: " + labelTopPx + "px;"
                                + 'background-color:' + constants.nameLabelBackgroundColor +";"
                                + 'color:' + constants.nameLabelColor +";"
                    }, [this.username])
                )

                if (topPx < labelTopPx) {
                    let calloutTop = topPx + constants.lineHeight;
                    let calloutBottom = labelTopPx + 1;
                    let calloutLeft = leftPx;
                    let calloutWidth = (curCol - this.cursor.colOffset) * constants.charWidth;

                    res.push(
                        h('div', {
                            'class': 'editor-cursor-callout-below',
                            'style': 'left: ' + calloutLeft + "px;top: " + calloutTop + "px;"
                            + 'width:' + calloutWidth + "px;" + "height:" + (calloutBottom - calloutTop) + "px;"
                            + 'border-left:1px solid ' + constants.nameLabelCalloutColor + ";"
                            + 'border-bottom:1px solid ' + constants.nameLabelCalloutColor + ";"
                        }, [])
                    )
                } else {
                    let calloutTop = labelTopPx + constants.lineHeight + 1;
                    let calloutBottom = topPx;
                    let calloutLeft = leftPx;
                    let calloutWidth = (curCol - this.cursor.colOffset) * constants.charWidth;

                    res.push(
                        h('div', {
                            'class': 'editor-cursor-callout-above',
                            'style': 'left: ' + calloutLeft + "px;top: " + calloutTop + "px;"
                            + 'width:' + calloutWidth + "px;" + "height:" + (calloutBottom - calloutTop) + "px;"
                            + 'border-left:1px solid ' + constants.nameLabelCalloutColor + ";"
                            + 'border-top:1px solid ' + constants.nameLabelCalloutColor + ";"
                        }, [])
                    )
                }
            }

            if (this.lastUpdateTimestamp !== null) {
                let curTimestamp = Date.now() / 1000.0;

                if (curTimestamp - this.lastUpdateTimestamp > SECONDS_TO_BLUR_CURSOR + SECONDS_UNTIL_CURSOR_BLURS) {
                    return [];
                }

                let startOpacity = Math.min(1.0,
                    (1.0 - (curTimestamp - this.lastUpdateTimestamp - SECONDS_UNTIL_CURSOR_BLURS) / SECONDS_TO_BLUR_CURSOR)
                );

                let delaySec = Math.max(
                    0,
                    SECONDS_UNTIL_CURSOR_BLURS - (curTimestamp - this.lastUpdateTimestamp)
                );

                let durationSec = Math.min(
                    SECONDS_UNTIL_CURSOR_BLURS + SECONDS_TO_BLUR_CURSOR - (curTimestamp - this.lastUpdateTimestamp),
                    SECONDS_TO_BLUR_CURSOR
                );

                // trigger the transition to not opaque once we're rendered in an actual div
                let onRender = (div) => {
                    window.requestAnimationFrame(() => {
                        div.style.opacity=0;
                    })
                };

                res = [
                    h('div', {
                        'class': 'editor-cursor-transition-layer',
                        'style': `opacity: ${startOpacity}`,
                    }, [
                        h('div', {
                            'class': 'editor-cursor-transition-layer',
                            'style': `transition: opacity ${durationSec}s linear ${delaySec}s`,
                            'onrender': onRender
                        }, res)
                    ]
                    )
                ];
            }
        }

        return res;
    }

    renderSelections(lines, constants) {
        let res = [];

        let isOtherCursor = this.username !== null && this.username !== undefined;
        let includeLineGutterHighlight = !isOtherCursor;
        let ranges = this.cursor.selectedRanges(lines, includeLineGutterHighlight);

        ranges.map((lineStartAndEnd) => {
            let lineIx = lineStartAndEnd[0];
            let startColIx = lineStartAndEnd[1];
            let endColIx = lineStartAndEnd[2];

            let startX = constants.gutterWidth + startColIx * constants.charWidth;
            let widthPx = (endColIx - startColIx) * constants.charWidth;
            let startY = lineIx * constants.lineHeight + constants.topPxOffset;
            let heightPx = constants.lineHeight;

            res.push(
                h('div', {
                    'class': isOtherCursor ? 'editor-selection-highlight-other-user' : 'editor-selection-highlight',
                    'style': 'left:' + startX + "px;" + 'top:' + startY + "px;"
                        +    'height:' + heightPx + "px;" + 'width:' + widthPx + "px;"
                        +    'background-color: ' + (isOtherCursor ? constants.selectionColorOther : constants.selectionColor)
                })
            )
        });

        return res;
    }

    renderBackgrounds(lines, constants) {
        let res = [];

        if (this.isPrimaryCursor && constants.renderSections) {
            // search forward and backward from the current line to see
            // what section we're in
            let curSectionStart = this.cursor.lineOffset;
            let curSectionEnd = this.cursor.lineOffset + 1;

            while (curSectionStart > 0 &&
                !lines[curSectionStart].startsWith(constants.sectionStarter)) {
                curSectionStart--;
            }

            while (curSectionEnd < lines.length &&
                !lines[curSectionEnd].startsWith(constants.sectionStarter)) {
                curSectionEnd++;
            }

            let topPx = curSectionStart * constants.lineHeight;
            let heightPx = (curSectionEnd - curSectionStart) * constants.lineHeight;

            res.push(
                h('div', {
                    'class': 'editor-section-background',
                    'style': 'top:' + topPx + "px;"
                        + "left:0px;width:100%;height:" + heightPx + "px;"
                        + "background-color:" + constants.sectionBackgroundColor
                })
            )
        }

        return res;
    }
};

class RenderedLine {
    constructor(lineNumber, text, incomingMultilineStringState) {
        this.lineNumber = lineNumber;
        this.text = text;
        this.incomingMultilineStringState = incomingMultilineStringState;
        this.div = null;

        this.render = this.render.bind(this);
        this.renderText = this.renderText.bind(this);
    }

    render(constants, syntaxCache) {
        let topPx = this.lineNumber * constants.lineHeight + constants.topPxOffset;

        let renderedText = this.renderText(
            constants,
            this.text,
            this.incomingMultilineStringState,
            syntaxCache
        );

        if (renderedText === null || renderedText === undefined) {
            throw new Error("TextRendering returned null")
        }

        let linePieces = [
            h('div', {'class': 'editor-line-number',
                      'style': 'width:' + constants.gutterWidth + "px;"
                      + "color:" + constants.lineNumberColor + ";"
                  },
                [(this.lineNumber + 1) + "  "]),
            h('div', {'class': 'editor-line-contents'}, renderedText)
        ];

        if (constants.renderSections && this.text.startsWith(constants.sectionStarter)) {
            linePieces.push(
                h('div', {'class': 'editor-section-sep',
                    'style': 'background-color:' + constants.sectionSeparatorColor}
                )
            )
        }

        this.div = h('div', {
            'class': 'editor-line',
            'style': 'top:' + topPx + "px;" +
                      'height:' + constants.lineHeight + "px"
        }, linePieces);

        return this.div;
    }

    // simple syntax highlighting
    renderText(constants, text, incomingMultilineStringState, syntaxCache) {
        let cacheKey = incomingMultilineStringState + text;

        if (syntaxCache[cacheKey] !== undefined) {
            return syntaxCache[cacheKey].map((node) => node.cloneNode(true));
        }

        let STRING = 1;
        let KEYWORD = 2;
        let RESERVED_WORD = 3;
        let COMMENT = 4;

        let colorGrid = {};
        colorGrid[0] = constants.textColor;
        colorGrid[STRING] = constants.stringColor;
        colorGrid[COMMENT] = constants.commentColor;
        colorGrid[RESERVED_WORD] = constants.reservedWordColor;
        colorGrid[KEYWORD] = constants.keywordColor;

        let colors = new Uint8Array(text.length);

        let i = 0;

        let inMultilineString = incomingMultilineStringState;
        let inString = ' ';

        let isInComment = false;

        while (i < text.length) {
            if (inMultilineString != ' ') {
                colors[i] = STRING;

                if (i + 2 < text.length && text[i] == inMultilineString
                    && text[i+1] == inMultilineString && text[i+2] == inMultilineString) {
                    inMultilineString = ' ';
                    colors[i + 1] = STRING;
                    colors[i + 2] = STRING;
                    i += 2;
                } else if (text[i] == '\\') {
                    i++;
                    colors[i] = STRING;
                }
            } else if (inString != ' ') {
                colors[i] = STRING;

                if (text[i] == inString) {
                    inString = ' ';
                }

                if (text[i] == '\\') {
                    i++;
                    colors[i] = STRING;
                }
            } else if (isInComment) {
                colors[i] = COMMENT;
            } else {
                if (i + 2 < text.length && text[i] == '"' && text[i+1] == '"' && text[i+2] == '"') {
                    colors[i] = STRING;
                    colors[i+1] = STRING;
                    colors[i+2] = STRING;
                    i += 2;
                    inMultilineString = '"';
                }
                else if (i + 2 < text.length && text[i] == "'" && text[i+1] == "'" && text[i+2] == "'") {
                    colors[i] = STRING;
                    colors[i+1] = STRING;
                    colors[i+2] = STRING;
                    i += 2;
                    inMultilineString = "'";
                }
                else if (text[i] == "'" || text[i] == '"') {
                    inString = text[i];
                    colors[i] = STRING;
                } else if (text[i] == '#') {
                    isInComment = true;
                    colors[i] = COMMENT;
                }
            }

            i++;
        }

        // now walk through and see if we find any matches for keywords

        let divs = [];

        Array.from(text.matchAll(reservedWordRegex)).forEach((match) => {
            if (colors[match.index] == 0) {
                for (let i = match.index; i < match.index + match[0].length; i++) {
                    colors[i] = RESERVED_WORD;
                }
            }
        });

        Array.from(text.matchAll(keywordRegex)).forEach((match) => {
            if (colors[match.index] == 0) {
                for (let i = match.index; i < match.index + match[0].length; i++) {
                    colors[i] = KEYWORD;
                }
            }
        });

        let symbols = "!@#$%^&*-=+<>?/"

        for (let i = 0; i < text.length; i++) {
            if (colors[i] == 0 && symbols.includes(text[i])) {
                colors[i] = RESERVED_WORD;
            }
        }

        let blockStart = 0;
        i = 1;

        while (i <= text.length) {
            if (i == text.length || colors[i] != colors[blockStart]) {
                divs.push(
                    h('div',
                        {'class': 'editor-line-piece', 'style': 'color:' + colorGrid[colors[blockStart]]},
                        [text.slice(blockStart, i)]
                    )
                )

                blockStart = i;
            }
            i++;
        }

        if (text.startsWith(constants.sectionStarter)) {
            divs.forEach((div) => {
                div.style['font-weight'] = 'bold';
                div.style['color'] = constants.textColor;
            });
        }

        syntaxCache[cacheKey] = divs;

        return divs.map((node) => node.cloneNode(true));
    }

};

class RenderingModel {
    constructor(dataModel, constants, firstLineIx=null) {
        this.constants = constants;
        this.dataModel = dataModel;
        this.topLineNumber = firstLineIx === null ? 0 : firstLineIx;
        this.viewHeight = 1;
        this.viewHeightPixels = 12;
        this.viewWidthPixels = 0;

        this.lineGutterLayer = h('div', {
            'class': 'editor-line-gutter-layer',
            'style': 'background-color:' + constants.lineGutterColor
                + ";width:" + (constants.gutterWidth - constants.lineGutterColorInset) + "px;height:100%"
        });

        this.backgroundLayer = h('div', {'class': 'editor-background-layer',
            'style': "background-color:" + constants.backgroundColor
            }, []);

        this.linesView = new ViewOfDivs();
        this.lineLayer = h('div', {'class': 'editor-line-layer', 'style': 'font-size:'
                + constants.fontSize + "px;color:" + constants.textColor}, [
            this.linesView.mainDiv
        ])

        this.selectionLayer = h('div', {'class': 'editor-selection-layer'}, []);
        this.otherSelectionLayer = h('div', {'class': 'editor-selection-layer'}, []);
        this.cursorLayer = h('div', {'class': 'editor-cursor-layer'}, []);
        this.otherCursorLayer = h('div', {'class': 'editor-cursor-layer'}, []);

        this.cursorBackgroundLayer = h('div', {'class': 'editor-cursor-background-layer'}, []);
        this.scrollBackground = h('div', {
            'class': 'editor-scrollbar-background',
            'style': 'background-color:' + constants.scrollbarBackgroundColor}
        )
        this.scrollbar = h('div', {
            'class': 'editor-scrollbar', 'style': 'background-color:' + constants.scrollbarColor}
        )
        this.scrollbarLayer = h('div', {'class': 'editor-scrollbar-layer'}, [
            this.scrollBackground,
            this.scrollbar
        ]);

        // if other users are also editing, their cursors
        this.otherCursors = null;

        this.syntaxCache = {};

        this.renderedCursors = [];
        this.renderedOtherCursors = [];

        this.divs = [this.backgroundLayer,
            this.cursorBackgroundLayer,
            this.lineGutterLayer,
            this.otherSelectionLayer, this.selectionLayer,
            this.lineLayer, this.otherCursorLayer, this.cursorLayer, this.scrollbarLayer];

        this.render = this.render.bind(this);
        this.setOtherCursors = this.setOtherCursors.bind(this);
        this.resetDataModel = this.resetDataModel.bind(this);
        this.buildRenderedLines = this.buildRenderedLines.bind(this);
        this.buildRenderedOtherCursors = this.buildRenderedOtherCursors.bind(this);
        this.buildRenderedCursors = this.buildRenderedCursors.bind(this);
        this.moveViewBy = this.moveViewBy.bind(this);
        this.sync = this.sync.bind(this);
        this.ensureTopCursorOnscreen = this.ensureTopCursorOnscreen.bind(this);
        this.ensureTopLineValid = this.ensureTopLineValid.bind(this);
        this.setViewSizePixels = this.setViewSizePixels.bind(this);
        this.setScrollbarPosition = this.setScrollbarPosition.bind(this);
        this.getScrollbarSensitivity = this.getScrollbarSensitivity.bind(this);

        this.buildRenderedLines();
    }

    resetDataModel(dataModel) {
        this.dataModel = dataModel;
    }

    setOtherCursors(otherCursors) {
        this.otherCursors = otherCursors;
    }

    setViewSizePixels(viewWidthPixels, viewHeightPixels) {
        this.viewWidthPixels = viewWidthPixels;

        if (this.viewHeightPixels == viewHeightPixels) {
            return;
        }

        this.viewHeightPixels = viewHeightPixels;
        this.viewHeight = Math.floor(
            Math.max(1, this.viewHeightPixels / this.constants.lineHeight)
        );
    }


    // perform any updates needed after any update to the state.
    sync() {
        this.dataModel.collapseCommonCursors();
        this.ensureTopCursorOnscreen();
    }

    ensureTopCursorOnscreen(lastInstead=false) {
        let cursorLine = this.dataModel.cursors[
            lastInstead ? this.dataModel.cursors.length - 1 : 0
        ].lineOffset;

        if (cursorLine < this.topLineNumber) {
            this.topLineNumber = cursorLine;
        } else if (cursorLine > this.topLineNumber + this.viewHeight - 1) {
            this.topLineNumber = cursorLine - this.viewHeight + 1;
        }

        this.ensureTopLineValid(true);
    }

    moveViewBy(offset, allowBottomShift=false) {
        this.topLineNumber += offset;
        this.ensureTopLineValid(allowBottomShift);
    }

    ensureTopLineValid(allowBottomShift=false) {
        if (allowBottomShift) {
            if (this.topLineNumber > this.dataModel.lines.length - 1) {
                this.topLineNumber = this.dataModel.lines.length - 1;
            }
        } else {
            if (this.topLineNumber > this.dataModel.lines.length - this.viewHeight + 1) {
                this.topLineNumber = this.dataModel.lines.length - this.viewHeight + 1;
            }
        }

        if (this.topLineNumber < 0) {
            this.topLineNumber = 0;
        }
    }

    buildRenderedLines() {
        this.linesView.resetTouched();

        var i = this.topLineNumber;
        while (i < this.topLineNumber + this.viewHeight + 1 && i < this.dataModel.lines.length) {
            let key = i + "_" + this.dataModel.getIsInMultilineString()[i] + "_" + this.dataModel.lines[i];

            this.linesView.touch(key);

            if (!this.linesView.hasChild(key)) {
                let renderer = new RenderedLine(
                    i,
                    this.dataModel.lines[i],
                    // ' ' if we're not in a multiline string, '"' if we're in a """, "'" if
                    // we're in a ''' string.
                    this.dataModel.getIsInMultilineString()[i]
                );

                this.linesView.setChild(
                    key,
                    renderer.render(this.constants, this.syntaxCache),
                    [0, i * this.constants.lineHeight]
                );
            }

            i += 1;
        }

        this.linesView.removeUntouched();
        this.linesView.resetView(
            [0, 0],
            [0, this.topLineNumber * this.constants.lineHeight],
            [this.viewWidthPixels, this.viewHeightPixels]
        );
    }

    buildRenderedCursors() {
        this.renderedCursors = this.dataModel.cursors.map(
            (cursor, ix) => new RenderedCursor(this, cursor, null, ix == 0)
        );
    }

    buildRenderedOtherCursors() {
        this.renderedOtherCursors = [];

        if (this.otherCursors === null) {
            return;
        }

        Object.keys(this.otherCursors).forEach((sessionId) => {
            let jsonCursorRep = this.otherCursors[sessionId].selectionState;
            let username = this.otherCursors[sessionId].username;
            let lastUpdateTimestamp = this.otherCursors[sessionId].lastUpdateTimestamp;

            jsonCursorRep.forEach((cursorJson) => {
                let cursor = Cursor.fromJson(cursorJson);
                cursor.ensureValid(this.dataModel.lines);

                this.renderedOtherCursors.push(
                    new RenderedCursor(this, cursor, username, false, lastUpdateTimestamp)
                );
            });
        });
    }

    getScrollbarSensitivity() {
        let insetPx = this.constants.scrollbarInset;
        let usableHeight = this.viewHeightPixels - insetPx * 2;
        let totalContentHeight = this.dataModel.lines.length + this.viewHeight - 1;
        let heightPx = Math.max(
            this.viewHeight / totalContentHeight * usableHeight,
            this.constants.scrollbarMinPxHigh
        );

        return this.dataModel.lines.length / Math.max(usableHeight - heightPx, 1);
    }

    setScrollbarPosition() {
        let insetPx = this.constants.scrollbarInset;
        let usableHeight = this.viewHeightPixels - insetPx * 2;
        let totalContentHeight = this.dataModel.lines.length + this.viewHeight - 1;
        let heightPx = Math.max(
            this.viewHeight / totalContentHeight * usableHeight,
            this.constants.scrollbarMinPxHigh
        );

        let offsetPx = insetPx + this.topLineNumber / totalContentHeight * usableHeight;

        this.scrollBackground.style.height = Math.round(usableHeight) + "px";
        this.scrollBackground.style.top = Math.round(insetPx) + "px";

        this.scrollbar.style.height = Math.round(heightPx) + "px";
        this.scrollbar.style.top = Math.round(offsetPx) + "px";
    }

    render() {
        let t0 = Date.now();

        // compute the offset
        let offsetStyle = '-' + (this.topLineNumber * this.constants.lineHeight) + "px";

        this.selectionLayer.style.top = offsetStyle;
        this.cursorLayer.style.top = offsetStyle;
        this.otherCursorLayer.style.top = offsetStyle;
        this.otherSelectionLayer.style.top = offsetStyle;
        this.cursorBackgroundLayer.style.top = offsetStyle;

        this.buildRenderedLines();
        this.buildRenderedCursors();
        this.buildRenderedOtherCursors();

        ConcreteCell.replaceChildren(
            this.cursorLayer,
            this.renderedCursors.map(
                (cursor) => cursor.render(this, this.dataModel.lines)
            ).flat()
        );

        ConcreteCell.replaceChildren(
            this.selectionLayer,
            this.renderedCursors.map(
                (cursor) => cursor.renderSelections(this.dataModel.lines, this.constants)
            ).flat()
        );

        ConcreteCell.replaceChildren(
            this.cursorBackgroundLayer,
            this.renderedCursors.map(
                (cursor) => cursor.renderBackgrounds(this.dataModel.lines, this.constants)
            ).flat()
        );

        ConcreteCell.replaceChildren(
            this.otherCursorLayer,
            this.renderedOtherCursors.map(
                (cursor) => cursor.render(this, this.dataModel.lines)
            ).flat()
        );

        ConcreteCell.replaceChildren(
            this.otherSelectionLayer,
            this.renderedOtherCursors.map(
                (cursor) => cursor.renderSelections(this.dataModel.lines, this.constants)
            ).flat()
        );

        this.setScrollbarPosition()
    }
}

export {RenderingModel};
