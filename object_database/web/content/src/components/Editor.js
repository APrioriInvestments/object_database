/**
 * Editor Cell
 */

import {makeDomElt as h, replaceChildren} from './Cell';
import {DragHelper} from './WebglPlot';
import {ConcreteCell} from './ConcreteCell';
import {Cursor} from './editor/Cursor';
import {DataModel} from './editor/DataModel';
import {RenderingModel} from './editor/RenderingModel';
import {TransactionManager} from './editor/TransactionManager';


class Constants {
    constructor(darkMode) {
        this.gutterWidth = 50;
        this.lineGutterColorInset = 3;
        this.lineHeight = 14;
        this.charWidth = 7;
        this.fontSize = 14;

        this.splitterWidth = 10;

        this.topPxOffset = 2;
        this.cursorVExtent = 2;
        this.cursorHShift = -1;
        this.cursorWidth = 2;

        this.scrollbarInset = 3;
        this.scrollbarMinPxHigh = 20;
        this.scrollbarWidth = 6;

        this.spacesPerTab = 4;
        this.autoscrollDelayMs = 50;

        this.renderSections = true;
        this.sectionStarter = '#-';

        this.stringColor = '#777777';
        this.commentColor = '#777777';
        this.reservedWordColor = '#DD0055';
        this.keywordColor = '#5555FF';

        if (darkMode) {
            this.cursorColor = 'white';
            this.selectionColor = '#666666';
            this.cursorColorOther = '#007bff88';
            this.selectionColorOther = '#007bff88';
            this.nameLabelBackgroundColor = '#007bff88';
            this.nameLabelColor = '#FFFFFFBB';
            this.nameLabelCalloutColor = '#007bff88';
            this.lineNumberColor = '#AAAAAA';
            this.lineGutterColor = '#EEEEEE';
            this.textColor = 'white';
            this.backgroundColor = 'black';
            this.backgroundBorder = 'black';

            this.sectionBackgroundColor = '#333333';
            this.sectionSeparatorColor = '#444444';

            this.scrollbarBackgroundColor = '#AAAAAA';
            this.scrollbarColor = '#DDDDDD';
        } else {
            this.cursorColor = 'black';
            this.selectionColor = '#BBBBBB';
            this.cursorColorOther = '#007bff88';
            this.selectionColorOther = '#007bff88';
            this.nameLabelBackgroundColor = '#007bff88';
            this.nameLabelColor = '#000000BB';
            this.nameLabelCalloutColor = '#007bff88';
            this.lineNumberColor = '#333333';
            this.lineGutterColor = '#CCCCCC';
            this.textColor = 'black';
            this.backgroundColor = 'white';
            this.backgroundBorder = '#AAAAAA';

            this.sectionSeparatorColor = '#DDDDDD';
            this.sectionBackgroundColor = '#F8F8F8';

            this.scrollbarBackgroundColor = '#DDDDDD';
            this.scrollbarColor = '#AAAAAA';
        }
    }
}


class Editor extends ConcreteCell {
    constructor(props, ...args){
        super(props, ...args);

        this.onKeydown = this.onKeydown.bind(this);
        this.onMousedown = this.onMousedown.bind(this);
        this.onPreventMousedown = this.onPreventMousedown.bind(this);
        this.onGutterMousedown = this.onGutterMousedown.bind(this);
        this.onWheel = this.onWheel.bind(this);
        this.installResizeObserver = this.installResizeObserver.bind(this);
        this.sendEventToServer = this.sendEventToServer.bind(this);
        this.mouseEventToPos = this.mouseEventToPos.bind(this);
        this.requestAnimationFrame = this.requestAnimationFrame.bind(this);
        this.checkAutoscroll = this.checkAutoscroll.bind(this);
        this.sendSelectionState = this.sendSelectionState.bind(this);
        this.renderAndPlaceDivs = this.renderAndPlaceDivs.bind(this);
        this.positionNamedChild = this.positionNamedChild.bind(this);
        this.setCursorsTo = this.setCursorsTo.bind(this);

        this.hasSectionHeaders = this.props.hasSectionHeaders;
        this.div = null;
        this.lastWidth = null;
        this.lastHeight = null;
        this.focusOnCreate = false;
        this.animationFrameRequested = false;
        this.currentDragHelper = null;
        this.lastClickTs = null;
        this.lastClickPos = null;
        this.isDoubleClick = false;

        this.lastAutoscrollTs = null;
        this.lastAutoscrollPoint = null;
        this.lastSentSelectionStateString = null;
        this.commitDelay = this.props.commitDelay;
        this.editSessionId = this.props.editSessionId;

        this.splitFraction = this.props.splitFraction;

        this.constants = new Constants(this.props.darkMode);
        this.dataModel = new DataModel(
            this.constants,
            this.props.readOnly,
            this.props.initialState.lines
        );

        this.transactionManager = new TransactionManager(
            this.dataModel, this.constants, this.sendEventToServer, this.props.editSessionId,
            this.props.initialState.topEventIndex - this.props.initialState.events.length
        );

        // send the initial events into the transaction manager
        this.props.initialState.events.forEach(this.transactionManager.pushBaseEvent);

        this.renderModel = new RenderingModel(
            this.dataModel, this.constants, this.props.firstLineIx
        );

        if (this.props.initialCursors !== null) {
            this.setCursorsTo(this.props.initialCursors)
        }
        else {
            this.dataModel.cursors = [new Cursor(0,0,0,0,0)];
        }
    }

    setCursorsTo(newCursors) {
        try {
            this.dataModel.cursors = (
                newCursors.map(Cursor.fromJson)
            );
        } catch(e) {
            this.dataModel.cursors = [new Cursor(0,0,0,0,0)];
        }

        this.dataModel.cursors.forEach(
            (cursor) => { cursor.ensureValid(this.dataModel.lines) }
        );
    }

    sendSelectionState() {
        if (this.lastWidth === null) {
            // don't send anything to the server until we have a height!
            return;
        }

        let newState = {
            msg: 'selectionState',
            currentCursors: this.dataModel.cursors.map((cursor) => cursor.toJson()),
            topLineNumber: this.renderModel.topLineNumber,
            bottomLineNumber: this.renderModel.topLineNumber + this.renderModel.viewHeight,
            splitFraction: this.splitFraction
        };

        if (JSON.stringify(newState) != this.lastSentSelectionStateString) {
            this.lastSentSelectionStateString = JSON.stringify(newState);
            this.sendMessage(newState);
        }
    }

    installResizeObserver() {
        let observer = new ResizeObserver(entries => {
            for (let entry of entries) {
                if (entry.contentRect.width == this.lastWidth &&
                    entry.contentRect.height == this.lastHeight) {
                    return
                }

                this.lastWidth = entry.contentRect.width;
                this.lastHeight = entry.contentRect.height;
            }

            this.renderModel.setViewSizePixels(this.lastWidth, this.lastHeight);
            this.requestAnimationFrame();
        });

        observer.observe(this.div);
    }

    sendEventToServer(topEventIndex, relativeEventIndex, event) {
        if (this.commitDelay) {
            setTimeout(() => {
                this.sendMessage({
                    msg: 'newEvent',
                    topEventIndex: topEventIndex,
                    relativeEventIndex: relativeEventIndex,
                    event: event
                });
            }, this.commitDelay);
        } else {
            this.sendMessage({
                msg: 'newEvent',
                topEventIndex: topEventIndex,
                relativeEventIndex: relativeEventIndex,
                event: event
            })
        }
    }

    serverKnowsAsFocusedCell() {
        if (this.div !== null) {
            this.div.focus();
        } else {
            this.focusOnCreate = true;
        }
    }

    mouseEventToPos(point) {
        let rect = this.div.getBoundingClientRect();

        let x = point[0] - rect.left;
        let y = point[1] - rect.top;

        return {
            lineOffset: this.renderModel.topLineNumber + Math.floor((y - this.constants.topPxOffset) / this.constants.lineHeight),
            colOffset: Math.floor((x - this.constants.gutterWidth) / this.constants.charWidth)
        }
    }

    onGutterMousedown(event) {
        event.preventDefault();
        event.stopPropagation();

        if (this.currentDragHelper) {
            this.currentDragHelper.teardown();
        }

        let initWidth = this.lastWidth;
        let initSplitFrac = this.splitFraction;

        this.currentDragHelper = new DragHelper(event,
            (event, startPoint, lastPoint,  curPoint) => {
                if (event == "teardown") {
                    return;
                }

                let initPixel = initSplitFrac * initWidth
                let newPixel = this.splitFraction * initWidth

                this.splitFraction = Math.max(
                    .05,
                    Math.min(
                        .95,
                        (curPoint[0] - startPoint[0]) / initWidth + initSplitFrac
                    )
                );

                this.requestAnimationFrame();

                if (event == 'end') {
                    this.currentDragHelper = null;
                }
            }
        );
    }

    onPreventMousedown(event) {
        event.preventDefault();
        event.stopPropagation();
    }


    onMousedown(event) {
        event.preventDefault();
        event.stopPropagation();

        this.focusReceived();
        this.div.focus();

        if (this.currentDragHelper) {
            this.currentDragHelper.teardown();
        }

        let rect = this.editorContentsHolder.getBoundingClientRect();

        // see if this is a scrollbar click
        if (event.pageX > rect.right - this.constants.scrollbarInset * 2 - this.constants.scrollbarWidth) {
            let scrollbarRect = this.renderModel.scrollbar.getBoundingClientRect();

            if (event.pageY < scrollbarRect.top) {
                // this is just a page up event
                this.renderModel.moveViewBy(-this.renderModel.viewHeight, true);
                this.requestAnimationFrame();
                return;
            }

            if (event.pageY > scrollbarRect.bottom) {
                // this is just a page up event
                this.renderModel.moveViewBy(this.renderModel.viewHeight, true);
                this.requestAnimationFrame();
                return;
            }

            let originalTopLine = this.renderModel.topLineNumber;

            this.currentDragHelper = new DragHelper(event,
                (event, startPoint, lastPoint,  curPoint) => {
                    if (event == "teardown") {
                        return;
                    }

                    let linesPerPx = this.renderModel.getScrollbarSensitivity();

                    this.renderModel.topLineNumber = Math.round(
                        originalTopLine + (lastPoint[1] - startPoint[1]) * linesPerPx
                    );
                    this.renderModel.ensureTopLineValid(true);
                    this.requestAnimationFrame();

                    if (event == 'end') {
                        this.currentDragHelper = null;
                    }
                }
            );

            return;
        }

        let isCtrl = event.ctrlKey;
        let isShift = event.shiftKey;

        let pos = this.mouseEventToPos([event.pageX, event.pageY]);

        this.isDoubleClick = false;
        if (Date.now() - this.lastClickTs < 300 && !isCtrl && !isShift) {
            if (pos.lineOffset == this.lastClickPos.lineOffset &&
                Math.abs(pos.colOffset - this.lastClickPos.colOffset) < 3
            ) {
                this.isDoubleClick = true;
            }
        }

        this.dataModel.startClick(pos.lineOffset, pos.colOffset, isCtrl, isShift);

        if (this.isDoubleClick) {
            this.dataModel.cursors[this.dataModel.cursors.length - 1].selectWord(
                this.dataModel.lines
            );
        }

        this.requestAnimationFrame();

        this.lastAutoscrollTs = null;
        this.lastAutoscrollPoint = null;

        this.lastClickTs = Date.now();
        this.lastClickPos = pos;

        this.currentDragHelper = new DragHelper(event,
            (event, startPoint, lastPoint,  curPoint) => {
                if (event == "teardown") {
                    return;
                }

                let rect = this.div.getBoundingClientRect();

                if (curPoint[1] < rect.top || curPoint[1] > rect.bottom) {
                    // we're out of bounds. Let's update every 10th of a second so we don't
                    // scroll too fast
                    if (this.lastAutoscrollTs === null) {
                        this.lastAutoscrollTs = Date.now();
                        this.lastAutoscrollPoint = curPoint;

                        setTimeout(this.checkAutoscroll, this.constants.autoscrollDelayMs);
                    } else {
                        this.lastAutoscrollPoint = curPoint;
                    }

                } else {
                    let pos = this.mouseEventToPos(curPoint);
                    this.dataModel.continueClick(pos.lineOffset, pos.colOffset, this.isDoubleClick);
                    this.renderModel.ensureTopCursorOnscreen(true);
                    this.requestAnimationFrame();
                    this.lastAutoscrollTs = null;
                }

                if (event == 'end') {
                    this.currentDragHelper = null;
                }
            }
        );
    }

    checkAutoscroll() {
        if (this.lastAutoscrollTs === null) {
            return;
        }

        if (this.currentDragHelper === null) {
            return;
        }

        let curTs = Date.now()

        if (curTs - this.lastAutoscrollTs > this.constants.autoscrollDelayMs - 1) {
            // execute an autoscroll
            let pos = this.mouseEventToPos(this.lastAutoscrollPoint);
            this.dataModel.continueClick(pos.lineOffset, pos.colOffset);
            this.renderModel.ensureTopCursorOnscreen(true);
            this.requestAnimationFrame();

            this.lastAutoscrollTs = curTs;
            // schedule another timeout
            setTimeout(this.checkAutoscroll, this.constants.autoscrollDelayMs);
        } else {
            setTimeout(this.checkAutoscroll, this.constants.autoscrollDelayMs - (curTs - this.lastAutoscrollTs));
        }
    }

    onWheel(event) {
        if (event.ctrlKey || event.altKey || event.metaKey) {
            return;
        }

        event.stopPropagation();
        event.preventDefault();

        this.renderModel.moveViewBy(Math.round(event.deltaY / 10), true);
        this.requestAnimationFrame();
    }

    handleMessages(messages) {
        messages.forEach((message) => {
            if (message.firstLine !== undefined) {
                this.renderModel.topLineNumber = message.firstLine;
                this.renderModel.ensureTopLineValid(true);
                this.requestAnimationFrame();
            }

            if (message.selectionState !== undefined) {
                this.setCursorsTo(message.selectionState)
                this.requestAnimationFrame();
            }

            if (message.resetState !== undefined) {
                // we're being completely reset -> reset the state of the system completely
                let oldCursors = this.dataModel.cursors;

                this.dataModel = new DataModel(
                    this.constants,
                    this.readOnly,
                    message.resetState.lines
                );

                console.log("Resetting state to event " + message.resetState.topEventIndex);

                this.transactionManager = new TransactionManager(
                    this.dataModel, this.constants, this.sendEventToServer, this.editSessionId,
                    message.resetState.topEventIndex - message.resetState.events.length
                );

                // send the initial events into the transaction manager
                message.resetState.events.forEach(this.transactionManager.pushBaseEvent);

                this.renderModel.resetDataModel(this.dataModel);

                this.dataModel.cursors = oldCursors;
                this.dataModel.cursors.forEach((cursor) => { cursor.ensureValid(this.dataModel.lines) });
                this.requestAnimationFrame();
            }

            if (message.userSelectionSlotChanged !== undefined) {
                this.renderModel.setOtherCursors(message.userSelections);
                this.requestAnimationFrame();
            }

            if (message.acceptedEvents !== undefined) {
                let needsRender = false;

                message.acceptedEvents.forEach((event) => {
                    if (this.transactionManager.pushBaseEvent(event)) {
                        needsRender = true;
                    }
                });

                if (needsRender) {
                    this.requestAnimationFrame();
                }
            }
        });
    }

    requestAnimationFrame() {
        if (this.animationFrameRequested) {
            return;
        }

        this.animationFrameRequested = true;

        window.requestAnimationFrame(() => {
            this.animationFrameRequested = false;

            this.renderModel.render();
            this.renderAndPlaceDivs();
            this.sendSelectionState();
        })
    }

    renderAndPlaceDivs() {
        let namedChildrenDivs = Object.keys(this.namedChildren).sort().map((name) => {
            let childContainer = this.childNameToDomElt[name];
            if (childContainer === undefined) {
                childContainer = this.renderChildNamed(name);
            }

            if (childContainer === undefined) {
                console.log("WARNING: no child for " + name);
            }

            if (!this.positionNamedChild(childContainer, name)) {
                return undefined;
            }

            return childContainer;
        });

        replaceChildren(
            this.sectionDivHolder,
            namedChildrenDivs.filter((x) => x !== undefined)
        );

        if (this.hasSectionHeaders) {
            let splitterWidth = this.constants.splitterWidth;
            let splitPct = this.splitFraction * 100.0;

            this.editorContentsHolder.style.width = (
                'calc(' + splitPct + '% - ' + this.constants.splitterWidth + 'px)'
            );

            this.sectionSplitter.style.left = (
                'calc(' + splitPct + '% - ' + this.constants.splitterWidth + 'px)'
            );

            this.sectionSplitter.style.width = splitterWidth + "px";

            this.sectionDivHolder.style.width = (
                'calc(' + (100.0-splitPct) + '% - ' + this.constants.splitterWidth + 'px)'
            )

            this.sectionDivHolder.style.left = (
                splitPct + "%"
            );
        }
    }

    positionNamedChild(childContainer, name) {
        if (name == "_overlay") {
            childContainer.style.width = "100%"
            childContainer.style.height = "100%"
            childContainer.style.top = "0px"
            childContainer.style.left = "0px"
            return true;
        }

        let indexNumberAsStr = name.split("_", 1)[0];
        let sequenceName = name.substr(indexNumberAsStr.length + 1);

        let lineRange = this.dataModel.lineRangeForSection(
            this.constants,
            sequenceName,
            parseInt(indexNumberAsStr)
        );

        if (lineRange === null) {
            return false;
        }

        if (childContainer.style.width != "100%") {
            childContainer.style.width = "100%";
        }

        let newTop = (lineRange[0] - this.renderModel.topLineNumber)
            * this.constants.lineHeight + this.constants.topPxOffset + "px";

        let newHeight = (lineRange[1] - lineRange[0])
            * this.constants.lineHeight - 2 + "px";

        if (childContainer.style.top != newTop) {
            childContainer.style.top = newTop;
        }

        if (childContainer.style.height != newHeight) {
            childContainer.style.height = newHeight;
        }

        return true;
    }

    childChanged(child) {
        ConcreteCell.prototype.childChanged.call(this, child);

        let childName = this.cellIdToChildName[child.identity];
        let childContainer = this.childNameToDomElt[childName];

        this.positionNamedChild(childContainer, childName);
    }

    renderChildUncached(child) {
        let renderedChild = ConcreteCell.prototype.renderChildUncached.call(
            this, child
        );

        let bgColorStyle = 'background-color:' + this.constants.backgroundColor;

        if (child.namedChildren.content !== undefined &&
                child.namedChildren.content.isEmptyCell()) {
            bgColorStyle = '';
        }

        return h('div', {
            class: 'allow-child-to-fill-space overflow-hidden editor-section-display',
            style: 'position:absolute;' + bgColorStyle
        }, [renderedChild]);
    }

    allottedSpaceIsInfinite(child) {
        return false;
    }

    onKeydown(event) {
        if (document.activeElement !== this.div) {
            return;
        }

        this.dataModel.updateCursorAtLastCheckpoint();

        // see if the main model wants to handle it
        if (this.dataModel.handleKey(event)) {
            event.preventDefault();
            event.stopPropagation();

            this.renderModel.sync();
            this.transactionManager.snapshot({'keystroke': event.key});
            this.requestAnimationFrame();
            return;
        }

        // handle things that interact with the rendering layer.
        if (event.ctrlKey && !event.metaKey && !event.altKey && !event.shiftKey) {
            if (event.key == 'c') {
                // handle copy event
                navigator.clipboard.writeText(
                    (this.dataModel.cursors.map((cursor) => cursor.getSelectedText(this.dataModel.lines)))
                    .join("\n")
                );

                event.preventDefault();
                event.stopPropagation();
                return;
            }

            if (event.key == 'x') {
                // handle copy event
                navigator.clipboard.writeText(
                    (this.dataModel.cursors.map((cursor) => cursor.getSelectedText(this.dataModel.lines)))
                    .join("\n")
                );

                if (!this.readOnly) {
                    this.dataModel.cursors.map((cursor) => {
                        if (cursor.hasTail()) {
                            this.dataModel.clearCursorOverlap(cursor);
                            return;
                        }
                    });

                    this.renderModel.sync();
                    this.transactionManager.snapshot({'event': 'paste'});
                    this.requestAnimationFrame();
                }

                event.preventDefault();
                event.stopPropagation();
                return;
            }

            if (event.key == 'v') {
                // handle paste event
                navigator.clipboard.readText().then((clipboardText) => {
                    this.dataModel.pasteText(clipboardText);
                    this.renderModel.sync();
                    this.transactionManager.snapshot({'event': 'paste'});
                    this.requestAnimationFrame();
                });

                event.preventDefault();
                event.stopPropagation();
                return;
            }
        }

        // handle things that interact with the rendering layer.
        if (event.ctrlKey && !event.metaKey && !event.altKey) {
            if (event.key == 'z' || event.key == 'Z') {
                if (event.shiftKey) {
                    // see if we can redo. If not, ask the server to try, since it
                    // may have a longer history than we do
                    if (!this.transactionManager.redo()) {
                        if (this.commitDelay) {
                            setTimeout(() => {
                                this.sendMessage({'msg': 'triggerRedo'})
                            }, this.commitDelay);
                        } else {
                            this.sendMessage({'msg': 'triggerRedo'})
                        }
                        return;
                    }
                } else {
                    // see if we can undo. If not, ask the server to try, since it
                    // may have a longer history than we do
                    if (!this.transactionManager.undo()) {
                        if (this.commitDelay) {
                            setTimeout(() => {
                                this.sendMessage({'msg': 'triggerUndo'})
                            }, this.commitDelay);
                        } else {
                            this.sendMessage({'msg': 'triggerUndo'})
                        }
                        return;
                    }
                }

                this.renderModel.sync();
                this.requestAnimationFrame();
                event.preventDefault();
                event.stopPropagation();
                return;
            }
        }

        if ((event.key == 'PageUp' || event.key == 'PageDown')
                    && !event.metaKey && !event.altKey && !event.ctrlKey) {
            let direction = event.key == 'PageUp' ? -1 : 1;
            this.renderModel.moveViewBy(this.renderModel.viewHeight * direction);
            this.dataModel.pageBy(this.renderModel.viewHeight * direction);

            event.preventDefault();
            event.stopPropagation();

            this.renderModel.sync();
            this.requestAnimationFrame();
        }

        if (event.ctrlKey && !event.metaKey && !event.shiftKey && !event.altKey) {
            if (event.key == 'ArrowUp' || event.key == 'ArrowDown') {
                var y = event.key == 'ArrowUp' ? -1 : 1;
                this.renderModel.moveViewBy(y, true);

                event.preventDefault();
                event.stopPropagation();

                this.renderModel.sync();
                this.requestAnimationFrame();
            }
        }

    }

    onFirstInstalled() {
        if (this.focusOnCreate) {
            this.div.focus();
            this.focusOnCreate = false;
        }

        this.installResizeObserver();
    }

    rebuildDomElement() {
        // restrict to the set of dom elements that are still here
        let newChildNameToChild = {};
        let newChildNameToDomElt = {};
        let newCellIdToChildName = {};

        Object.keys(this.namedChildren).forEach((name) => {
            let existingChild = this.childNameToChild[name];

            if (existingChild !== undefined && existingChild === this.namedChildren[name]) {
                newChildNameToChild[name] = existingChild;
                newChildNameToDomElt[name] = this.childNameToDomElt[name];
                newCellIdToChildName[existingChild.identity] = name;
            }
        })

        this.childNameToChild = newChildNameToChild;
        this.childNameToDomElt = newChildNameToDomElt;
        this.cellIdToChildName = newCellIdToChildName;

        this.renderAndPlaceDivs();
    }

    build(){
        if (this.div !== null) {
            return this.div;
        }

        this.mouseDiv = h('div',
            {
                class: "editor-mouse-event-div",
                onmousedown: this.onMousedown,
                onwheel: this.onWheel,
            }
        )
        this.sectionDivHolder = h('div', {
            class: 'editor-subsection-holder',
            onmousedown: this.onPreventMousedown
        });

        let subDivs = Array.from(this.renderModel.divs);
        subDivs.push(this.mouseDiv);

        this.sectionSplitter = h(
            'div', {'class': 'gutter', 'onmousedown': this.onGutterMousedown}
        )

        this.editorContentsHolder = h('div', {'class': 'editor-edit-contents-holder'}, subDivs)

        if (this.hasSectionHeaders) {
        } else {
            this.editorContentsHolder.style.width = '100%';
        }

        this.div = h('div',
            {
                class: "cell editor",
                id: this.getElementId(),
                "data-cell-id": this.identity,
                "data-cell-type": "Editor",
                "onkeydown": this.onKeydown,
                'tabindex': 0,
                "style": 'border: 1px solid ' + this.constants.backgroundBorder,
                key: this
            },
            [
                h('div', {'class': 'editor-content-and-split-holder'},
                this.hasSectionHeaders ? [
                    this.editorContentsHolder,
                    this.sectionSplitter,
                    this.sectionDivHolder,
                ] : [this.editorContentsHolder])
            ]
        );

        this.renderAndPlaceDivs();

        return this.div;
    }

    _computeFillSpacePreferences() {
        return {horizontal: true, vertical: true};
    }
}

export {Editor, Constants, Editor as default};
