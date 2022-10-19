import {makeDomElt as h} from '../Cell';

class Autocompletion {
    constructor(dataModel, constants, isActive) {
        this.dataModel = dataModel;
        this.constants = constants;
        this.isActive = isActive;

        this.setAutocompletions = this.setAutocompletions.bind(this);
        this.render = this.render.bind(this);
        this.handleKey = this.handleKey.bind(this);
        this.isIdentifierEvent = this.isIdentifierEvent.bind(this);
        this.triggerNewAutocomplete = this.triggerNewAutocomplete.bind(this);
        this.checkForCloseAfterEvent = this.checkForCloseAfterEvent.bind(this);
        this.computeWordStartCursor = this.computeWordStartCursor.bind(this);
        this.currentWordValue = this.currentWordValue.bind(this);
        this.getValidCompletions = this.getValidCompletions.bind(this);
        this.computeValidCompletionScore = this.computeValidCompletionScore.bind(this);

        // the current completions we're showing
        // can be null if we don't know them yet in which case we'll get a (...)
        // in the rendering
        this.completions = null;

        // context on the object we're completing
        this.contextDescriptor = null;

        // true if we're showing this autocompletion
        this.isVisible = false;

        // current autocompletion state
        this.selectedIx = 0;
        this.scrollIx = 0;

        this.completionRequestId = null;
        this.maxCompletionRequestId = 0;

        // a cursor indicating where the popup box should be
        // we'll close it
        this.wordStartCursor = null;
    }

    computeWordCursor() {
        if (this.dataModel.cursors.length == 0) {
            return null;
        }

        let cursor = this.dataModel.cursors[0].clone();
        cursor.selectWord(this.dataModel.lines);
        return cursor;
    }

    computeWordStartCursor() {
        if (this.dataModel.cursors.length == 0) {
            return null;
        }

        let cursor = this.dataModel.cursors[0].clone();
        cursor.selectWord(this.dataModel.lines);
        cursor.becomeTail();
        return cursor;
    }

    currentWordValue() {
        let cursor = this.computeWordCursor();

        if (cursor === null) {
            return "";
        }

        return cursor.getSelectedText(this.dataModel.lines);
    }

    getValidCompletions() {
        let word = this.currentWordValue();

        if (this.completions === null) {
            return null;
        }

        let valid = [];

        this.completions.forEach((completeWord) => {
            let validCompletionScore = this.computeValidCompletionScore(word, completeWord);

            if (validCompletionScore !== null) {
                valid.push([completeWord, validCompletionScore]);
            }
        });

        // order our completions - place completions that have fewer
        // unmatched characters in them first. Then, all things equal,
        // use the user priority if it was given to us.
        let orderPriority = (a, b) => {
            if (a[1] < b[1]) {
                return -1;
            }
            if (a[1] > b[1]) {
                return 1;
            }

            let priorityA = this.completionPriorities[a[0]] || 0;
            let priorityB = this.completionPriorities[b[0]] || 0;

            return priorityB - priorityA;
        };

        valid.sort(orderPriority);

        return valid.map((a) => a[0]);
    }

    computeValidCompletionScore(partial, complete) {
        if (partial.length > complete.length) {
            return null;
        }

        partial = partial.toLowerCase();
        complete = complete.toLowerCase();

        if (partial.length > complete.length) {
            return null;
        }

        let posInComplete = 0

        for (let i = 0; i < partial.length; i++) {
            while (posInComplete < complete.length && partial[i] != complete[posInComplete]) {
                posInComplete += 1;
            }

            if (posInComplete >= complete.length) {
                return null;
            }

            posInComplete += 1;
        }

        return posInComplete;
    }

    checkForCloseAfterEvent() {
        if (!this.isVisible) {
            return;
        }

        let updatedCursor = this.computeWordStartCursor();

        if (updatedCursor === null) {
            this.isVisible = false;
            return;
        }

        if (updatedCursor.lineOffset != this.wordStartCursor.lineOffset ||
                updatedCursor.colOffset != this.wordStartCursor.colOffset) {
            this.isVisible = false;
            return;
        }

        let valid = this.getValidCompletions();

        if (valid !== null && valid.length == 0) {
            this.isVisible = false;
            return;
        }

        if (valid !== null && valid.indexOf(this.selectedWord) == -1) {
            this.selectedWord = valid[0];
        }
    }

    //reset the
    triggerNewAutocomplete() {
        this.maxCompletionRequestId += 1;

        this.completions = null;
        this.completionDocstrings = null;
        this.completionPriorities = null;
        this.completionTypes = null;
        this.completionModules = null;

        this.isVisible = true;

        // the currently selected autocompletion
        this.selectedWord = null;

        // the scroll offset of the current autocompletion. Zero means its at the top
        this.scrollOffset = 0;

        this.completionRequestId = this.maxCompletionRequestId;
        this.wordStartCursor = this.computeWordStartCursor();

        console.info("Triggering " + this.completionRequestId);
        return this.maxCompletionRequestId;
    }

    isIdentifierEvent(event) {
        return (
            event.key.length == 1
            && 'abcdefghijklmnopqrstuvwxyz._'.includes(event.key.toLowerCase())
        );
    }

    handleKey(event) {
        if (this.completions === null) {
            return false;
        }

        if (!event.ctrlKey && !event.metaKey && !event.altKey) {
            if (event.key == 'ArrowUp' && this.isVisible) {
                let completions = this.getValidCompletions();

                if (completions.length > 0) {
                    if (this.selectedWord === null) {
                        return false;
                    } else {
                        let ix = completions.indexOf(this.selectedWord);
                        ix = ix - 1;

                        this.scrollOffset = Math.max(0, this.scrollOffset - 1);

                        if (ix >= 0 && ix < completions.length) {
                            this.selectedWord = completions[ix];
                        } else {
                            return false;
                        }
                    };

                    return true;
                }

                return false;
            }

            if (event.key == 'ArrowDown' && this.isVisible) {
                let completions = this.getValidCompletions();

                if (completions.length > 0) {
                    if (this.selectedWord === null) {
                        return false;
                    } else {
                        let ix = completions.indexOf(this.selectedWord);
                        ix = ix + 1;

                        this.scrollOffset = Math.min(
                            this.scrollOffset + 1, this.constants.maxVisibleAutocompletions - 1
                        );

                        if (ix >= 0 && ix < completions.length) {
                            this.selectedWord = completions[ix];
                        } else {
                            return false;
                        }
                    };

                    return true;
                }

                return false;
            }

            if ((event.key == 'Enter' || event.key == 'Tab') && this.isVisible) {
                let cursor = this.dataModel.cursors[0];

                let completions = this.getValidCompletions();

                if (completions == null) {
                    return false;
                }

                if (this.selectedWord !== null) {
                    cursor.selectWord(this.dataModel.lines);
                    this.dataModel.replaceText(cursor, this.selectedWord);
                    cursor.removeTail();
                }

                this.isVisible = false;
                return true;
            }

            if (event.key == 'Escape' && this.isVisible) {
                this.isVisible = false;
                return true;
            }

            if (event.key.length == 1 && !this.isIdentifierEvent(event) && this.isVisible) {
                this.isVisible = false;
            }
        }

        return false;
    }

    // returns true if a given event should trigger an autocomplete
    shouldOpenAutocomplete(event) {
        if (!this.isActive) {
            return false;
        }

        if (this.isVisible) {
            return false;
        }

        if (!this.isIdentifierEvent(event)) {
            return false;
        }

        if (this.dataModel.cursors.length == 0) {
            return false;
        }

        let cursor = this.computeWordCursor();

        if (cursor.colOffset != this.dataModel.cursors[0].colOffset) {
            return false;
        }

        return true;
    }

    setAutocompletions(completions, contextDescriptor, requestId) {
        if (requestId != this.completionRequestId) {
            return;
        }

        this.contextDescriptor = contextDescriptor;
        this.completions = completions.map((x) => x.completion);
        this.completionDocstrings = Object.fromEntries(
            completions.filter(c => c.docstring !== undefined).map(x => [x.completion, x.docstring])
        );
        this.completionModules = Object.fromEntries(
            completions.filter(c => c.module !== undefined).map(x => [x.completion, x.module])
        );
        this.completionTypes = Object.fromEntries(
            completions.filter(c => c.type !== undefined).map(x => [x.completion, x.type])
        );
        this.completionPriorities = Object.fromEntries(
            completions.filter(c => c.priority !== undefined).map(x => [x.completion, x.priority])
        );

        let valid = this.getValidCompletions();

        if (valid === null || valid.length == 0) {
            this.isVisible = false;
        } else {
            this.scrollOffset = 0;
            this.selectedWord = valid[0];
        }
    }

    renderCompletionText(completion) {
        let moduleText = this.completionModules[completion] || '';

        let selectedWord = this.currentWordValue().toLowerCase();
        let completionLower = completion.toLowerCase();

        let isBold = new Array(completion.length);

        let indexInWord = 0;

        for (let i = 0; i < completion.length; i++) {
            if (selectedWord[indexInWord] == completionLower[i]) {
                isBold[i] = 1;
                indexInWord += 1;
            } else {
                isBold[i] = 0;
            }
        }

        let divs = [];

        if (moduleText.length) {
            divs.push(
                h('div',
                    {'class': 'editor-line-piece',
                     'style': 'opacity:.6'},
                    [moduleText]
                )
            )
        }

        let i = 0;
        let blockStart = 0;
        while (i < isBold.length) {
            if (i + 1 == isBold.length || isBold[i + 1] != isBold[i]) {
                divs.push(
                    h('div',
                        {'class': 'editor-line-piece',
                         'style': 'font-weight:' + (isBold[i] ? 'bold': 'normal')},
                        [completion.slice(blockStart, i + 1)]
                    )
                );

                i += 1;
                blockStart = i;
            } else {
                i += 1;
            }
        }

        return divs;
    }


    render(topLineNumber, viewHeight) {
        if (!this.isVisible) {
            return [];
        }

        if (this.dataModel.cursors.length == 0) {
            return [];
        }

        let constants = this.constants;

        let completionsToUse = this.getValidCompletions();

        if (completionsToUse == null || completionsToUse.length == 0) {
            return [];
        }

        let autocompletionBoxHeight = Math.min(
            constants.maxVisibleAutocompletions,
            completionsToUse.length
        );

        if (this.contextDescriptor !== null) {
            autocompletionBoxHeight += 1;
        }

        let selectedIxToUse = Math.max(0, completionsToUse.indexOf(this.selectedWord));

        let scrollIxToUse = Math.max(
            0,
            Math.min(
                selectedIxToUse - this.scrollOffset,
                completionsToUse.length - constants.maxVisibleAutocompletions
            )
        );

        let cursor = this.computeWordStartCursor();

        let leftPx = constants.gutterWidth
            + cursor.colOffset * constants.charWidth
            + constants.cursorHShift;

        let topPx = null;

        if (cursor.lineOffset + autocompletionBoxHeight < topLineNumber + viewHeight) {
            // render the autocomplete below us
            topPx = (cursor.lineOffset + 1) * constants.lineHeight;
            topPx += constants.topPxOffset + constants.autocompletionTopPadding - constants.cursorVExtent;
        } else {
            topPx = (cursor.lineOffset - autocompletionBoxHeight - 1) * constants.lineHeight;
            topPx -= constants.topPxOffset + constants.autocompletionTopPadding - constants.cursorVExtent;
        }

        let autocompletionWidth = Math.min(
            Math.max(
                Math.max(...completionsToUse.map(
                    (x) => (x.length + ((this.completionModules[x] + '   ') || '').length))
                ),
                constants.autocompletionsMinWidth
            ),
            constants.autocompletionsMaxWidth
        )

        let autocompletionTypeWidth = Math.min(
            Math.max(...completionsToUse.map(
                (x) => ((this.completionTypes[x] + '   ') || '').length)
            ),
            constants.autocompletionsTypeMaxWidth
        );

        let autocompletionDocstringWidth = Math.min(
            Math.max(...completionsToUse.map((x) => (this.completionDocstrings[x] || '').length)) + 2,
            constants.autocompletionsDocstringMaxWidth
        );

        let heightPx = constants.lineHeight * autocompletionBoxHeight + constants.cursorVExtent;
        let widthPx = constants.charWidth * (
            autocompletionWidth
            + autocompletionTypeWidth
            + autocompletionDocstringWidth
        ) + constants.autocompletionLeftPadding;

        let res = [];

        res.push(
            h('div', {
                'class': 'editor-autocompletion-box',
                'style':
                      'left: ' + (leftPx - constants.autocompletionLeftPadding) + "px;"
                    + "top: " + topPx + "px;"
                    + 'width:' + (widthPx + constants.autocompletionLeftPadding) + "px;"
                    + "height:" + heightPx + "px;"
                    + 'background-color:' + constants.autocompleteBackgroundColor + ';'
                    + 'border: 1px solid ' + constants.autocompleteBorderColor + ';'
                ,
            })
        );

        if (this.contextDescriptor !== null) {
            res.push(
                h('div', {
                    'class': 'editor-autocompletion-line',
                    'style': 'left:' + leftPx + 'px;' +
                    'top: ' + (topPx) + 'px;' +
                    'width: ' + (widthPx - 2) + 'px;' +
                    'height: ' + constants.lineHeight + 'px;'
                }, [this.contextDescriptor])
            )
        }

        if (selectedIxToUse !== null) {
            let lineIx = selectedIxToUse - scrollIxToUse;

            if (this.contextDescriptor !== null) {
                lineIx += 1;
            }

            res.push(
                h('div', {
                    'class': 'editor-autocompletion-line',
                    'style': 'left:' + (leftPx - constants.autocompletionLeftPadding) + 'px;' +
                    'top: ' + (topPx + lineIx * constants.lineHeight) + 'px;' +
                    'width: ' + (widthPx
                                    + constants.autocompletionLeftPadding) + 'px;' +
                    'height: ' + (constants.lineHeight + constants.cursorVExtent) + 'px;' +
                    'background-color:' + constants.autocompleteSelectionColor + ';'
                })
            );
        }
        for (let i = scrollIxToUse;
            i < completionsToUse.length
            && i < constants.maxVisibleAutocompletions + scrollIxToUse;
            i++
        ) {
            let lineIx = i - scrollIxToUse;

            if (this.contextDescriptor !== null) {
                lineIx += 1;
            }

            res.push(
                h('div', {
                    'class': 'editor-autocompletion-line',
                    'style': 'left:' + leftPx + 'px;' +
                    'top: ' + (topPx + lineIx * constants.lineHeight) + 'px;' +
                    'width: ' + (constants.charWidth * autocompletionWidth) + 'px;' +
                    'height: ' + constants.lineHeight + 'px;'
                }, this.renderCompletionText(completionsToUse[i]))
            )

            if (this.completionTypes[completionsToUse[i]] !== undefined) {
                res.push(
                    h('div', {
                        'class': 'editor-autocompletion-type-line',
                        'style': 'left:' + (leftPx + constants.charWidth * autocompletionWidth) + 'px;' +
                        'top: ' + (topPx + lineIx * constants.lineHeight) + 'px;' +
                        'width: ' + (constants.charWidth * autocompletionTypeWidth) + 'px;' +
                        'height: ' + constants.lineHeight + 'px;'
                    }, [this.completionTypes[completionsToUse[i]]])
                );
            }

            if (this.completionDocstrings[completionsToUse[i]] !== undefined) {
                res.push(
                    h('div', {
                        'class': 'editor-autocompletion-docstring-line',
                        'style': 'left:' + (
                            leftPx + constants.charWidth * (
                                autocompletionWidth +
                                autocompletionTypeWidth
                            )
                        ) + 'px;' +
                        'top: ' + (topPx + lineIx * constants.lineHeight) + 'px;' +
                        'width: ' + (constants.charWidth * autocompletionDocstringWidth) + 'px;' +
                        'height: ' + constants.lineHeight + 'px;'
                    }, [this.completionDocstrings[completionsToUse[i]]])
                );
            }
        }

        if (completionsToUse.length > constants.maxVisibleAutocompletions) {
            // render a 'scrollbar' - not clickable but enough to see whats up
            let scrollBackground = h('div', {
                'class': 'editor-scrollbar-background',
                'style': 'background-color:' + constants.scrollbarBackgroundColor}
            );

            let scrollbar = h('div', {
                'class': 'editor-scrollbar',
                'style': 'background-color:' + constants.scrollbarColor
            });

            res.push(scrollBackground);
            res.push(scrollbar);

            let maxVis = constants.maxVisibleAutocompletions;

            let backgroundHt = maxVis * constants.lineHeight;

            let INSET_V = 3;
            let INSET_H = 2;

            let barHt = Math.max(
                backgroundHt * maxVis / completionsToUse.length,
                constants.scrollbarMinPxHigh
            ) - INSET_V * 2;

            let barTop = (backgroundHt - INSET_V * 2 - barHt) * scrollIxToUse / (completionsToUse.length - maxVis)

            scrollBackground.style.top = (topPx + 1) + "px";
            scrollBackground.style.left = (leftPx + widthPx - constants.scrollbarWidth - 1 - INSET_H * 2) + "px";
            scrollBackground.style.height = backgroundHt + "px";
            scrollBackground.style.width = (constants.scrollbarWidth + INSET_H * 2) + "px";

            scrollbar.style.top = (topPx + barTop + INSET_V) + "px";
            scrollbar.style.left = (leftPx + widthPx - constants.scrollbarWidth - INSET_H) + "px";
            scrollbar.style.height = barHt + "px";
            scrollbar.style.width = constants.scrollbarWidth + "px";
        }

        return res;
    }
}

export {Autocompletion};
