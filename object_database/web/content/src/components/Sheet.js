import {SheetState, charWidthPx} from "./SheetState";
import {makeDomElt as h, replaceChildren} from './Cell';
import {ConcreteCell} from './ConcreteCell';
import {DragHelper} from './WebglPlot';


let scrollbarWidthPx = 8;
let scrollbarPadding = 2;

class Sheet extends ConcreteCell {
    constructor(props, ...args){
        super(props, ...args);

        // We hardcode the maximum selector.selectionFrame.area to copy
        // to clipboard
        this.maxCellsToClipboard = 1000000;
        this.animationFrameRequested = false;
        this.lastWidth = null;
        this.lastHeight = null;

        this.div = null;
        this.sheetDiv = null;
        this.sheetHeaderDiv = null;

        this.showOverlay = false;
        this.focusOnCreate = false;
        this.currentDragHelper = null;
        this.bottomScrollbarState = null;
        this.rightScrollbarState = null;
        this.visibleOverlayDiv = null;

        this.onMousedown = this.onMousedown.bind(this);
        this.onScrollbarMousedown = this.onScrollbarMousedown.bind(this);

        this.onKeydown = this.onKeydown.bind(this);
        this.installResizeObserver = this.installResizeObserver.bind(this);
        this.requestAnimationFrame = this.requestAnimationFrame.bind(this);
        this.render = this.render.bind(this);
        this.focusLost = this.focusLost.bind(this);
        this.triggerCopy = this.triggerCopy.bind(this);
        this.computeOverlayChildren = this.computeOverlayChildren.bind(this);

        this.sheetState = new SheetState(
            this.props.colWidth,
            this.props.rowHeight,
            this.props.totalColumns,
            this.props.totalRows,
            this.props.numLockColumns,
            this.props.numLockRows
        );

    }

    focusReceived() {
        ConcreteCell.prototype.focusReceived.call(this);
        this.requestAnimationFrame();
    }

    focusLost() {
        this.requestAnimationFrame();
    }

    onScrollbarMousedown(event, whichScrollbar) {
        event.preventDefault();
        event.stopPropagation();

        if (this.currentDragHelper) {
            this.currentDragHelper.teardown();
        }

        let whichDiv = whichScrollbar == 'right' ?
            this.sheetRightScrollbarHolder
            : this.sheetBottomScrollbarHolder;

        let whichState = whichScrollbar == 'right' ? this.rightScrollbarState : this.bottomScrollbarState;

        let rect = whichDiv.getBoundingClientRect();
        let x = event.pageX - rect.left;
        let y = event.pageY - rect.top;

        if (whichScrollbar == 'right') {
            if (y < whichState.offsetPx) {
                this.sheetState.corner[1] -= Math.ceil(this.lastHeight / this.sheetState.cellHeight);
                this.requestAnimationFrame();
                return;
            }
            if (y > whichState.offsetPx + whichState.visiblePx) {
                this.sheetState.corner[1] += Math.ceil(this.lastHeight / this.sheetState.cellHeight);
                this.requestAnimationFrame();
                return;
            }
        } else {
            if (x < whichState.offsetPx) {
                this.sheetState.corner[0] -= Math.ceil(this.lastWidth / this.sheetState.cellWidth);
                this.requestAnimationFrame();
                return;
            }
            if (x > whichState.offsetPx + whichState.visiblePx) {
                this.sheetState.corner[0] += Math.ceil(this.lastWidth / this.sheetState.cellWidth);
                this.requestAnimationFrame();
                return;
            }
        }

        let originalCorner = [this.sheetState.corner[0], this.sheetState.corner[1]];

        this.currentDragHelper = new DragHelper(event,
            (event, startPoint, lastPoint, curPoint) => {
                if (event == "teardown") {
                    return;
                }
                if (event == 'end') {
                    this.currentDragHelper = null;
                    return;
                }

                if (whichScrollbar == 'right') {
                    this.sheetState.corner[1] = originalCorner[1] +
                        (curPoint[1] - startPoint[1])
                        / (whichState.sizePx - whichState.visiblePx)
                        * (whichState.totalRows - whichState.visibleRows);
                } else {
                    this.sheetState.corner[0] = originalCorner[0] +
                        (curPoint[0] - startPoint[0])
                        / (whichState.sizePx - whichState.visiblePx)
                        * (whichState.totalCols - whichState.visibleCols);
                }

                this.requestAnimationFrame();

            }
        );
    }

    onMousedown(event) {
        if (event.button == 2) {
            return;
        }

        event.preventDefault();
        event.stopPropagation();

        this.focusReceived();
        this.sheetDiv.focus();

        if (this.currentDragHelper) {
            this.currentDragHelper.teardown();
        }

        let isFirstClick = true;

        this.currentDragHelper = new DragHelper(event,
            (event, startPoint, lastPoint, curPoint) => {
                if (event == "teardown") {
                    return;
                }
                if (event == 'end') {
                    this.currentDragHelper = null;
                    return;
                }

                let rect = this.sheetContentHolder.getBoundingClientRect();

                let x = curPoint[0] - rect.left;
                let y = curPoint[1] - rect.top;

                this.sheetState.onMouseDrag(
                    x, y, this.lastWidth, this.lastHeight, isFirstClick
                );
                this.requestAnimationFrame(true);

                isFirstClick = false;
            }
        );

        this.currentDragHelper.triggerInitial();
    }

    onKeydown(event) {
        if (!event.ctrlKey && !event.shiftKey && !event.altKey && !event.metaKey) {
            if (event.key == 'Enter') {
                event.stopPropagation();
                event.preventDefault();
                this.showOverlay = !this.showOverlay;
                this.requestAnimationFrame();
                return true;
            }
        }

        if (event.ctrlKey && !event.shiftKey && !event.altKey && !event.metaKey) {
            if (event.key == "c") {
                event.stopPropagation();
                event.preventDefault();
                this.triggerCopy();
                return;
            }
        }

        this.sheetState.ensureCWCache(this.lastWidth);

        if (this.sheetState.handleKeyDown(event, this.lastHeight, this.lastWidth)) {
            event.stopPropagation();
            event.preventDefault();
            this.requestAnimationFrame(true);
        }
    }


    onFirstInstalled(){
        if (this.focusOnCreate) {
            this.sheetDiv.focus();
            this.focusOnCreate = false;
        }

        this.installResizeObserver();
    }

    _computeFillSpacePreferences() {
        return {horizontal: true, vertical: true}
    }

    requestAnimationFrame(forceCursorOnscreen=false) {
        if (forceCursorOnscreen) {
            this.sheetState.ensureCursorOnscreen(
                this.sheetState.buildRenderingConfig(
                    this.lastWidth,
                    this.lastHeight,
                    document.activeElement === this.sheetDiv
                )
            );
        }

        if (this.animationFrameRequested) {
            return;
        }

        this.animationFrameRequested = true;

        window.requestAnimationFrame(() => {
            this.animationFrameRequested = false;

            this.render();
        })
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

            this.requestAnimationFrame();
        });

        observer.observe(this.sheetDiv);
    }

    serverKnowsAsFocusedCell() {
        if (this.sheetDiv !== null) {
            this.sheetDiv.focus();
        } else {
            this.focusOnCreate = true;
        }
    }

    handleMessages(messages) {
        messages.forEach((message) => {
            if (message.reason == 'copy') {
                let text = message.data.map(item => {return item.join("\t");}).join("\n");

                navigator.clipboard.writeText(text);
            } else if (message.data) {
                let x = message.range[0][0];
                let y = message.range[0][1];

                this.sheetState.absorbCellContents(x, y, message.data);
                this.requestAnimationFrame();
            }
        })
    }

    triggerCopy() {
        this.sendMessage(
            {
                event: 'sheet_needs_data',
                reason: 'copy',
                range: [
                    [
                        Math.min(this.sheetState.selection[0][0], this.sheetState.selection[1][0]),
                        Math.min(this.sheetState.selection[0][1], this.sheetState.selection[1][1])
                    ],
                    [
                        Math.max(this.sheetState.selection[0][0], this.sheetState.selection[1][0]),
                        Math.max(this.sheetState.selection[0][1], this.sheetState.selection[1][1])
                    ]
                ]
            }
        )
    }

    render() {
        let isFocused = document.activeElement === this.sheetDiv;

        this.sheetState.ensureCWCache(this.lastWidth);

        let renderingConfig = this.sheetState.buildRenderingConfig(
            this.lastWidth,
            this.lastHeight,
            isFocused
        );

        this.sheetState.ensureCornerValid(renderingConfig);

        replaceChildren(
            this.sheetCellDataLayer,
            this.sheetState.renderCellDivs(
                this.lastWidth,
                this.lastHeight,
                isFocused
            )
        );
        replaceChildren(
            this.sheetSelectionLayer,
            this.sheetState.renderSelectionDivs(
                this.lastWidth,
                this.lastHeight,
                isFocused
            )
        );
        replaceChildren(
            this.sheetCellGridLayer,
            this.sheetState.renderGridlineDivs(
                this.lastWidth,
                this.lastHeight,
                isFocused
            )
        );

        replaceChildren(
            this.sheetHeaderDiv,
            this.sheetState.renderHeaderDivs(this.lastWidth, this.lastHeight, this.showOverlay)
        );

        this.sheetState.getBlockRangesToRequest(renderingConfig).forEach((block) => {
            this.sendMessage(
            {
                event: 'sheet_needs_data',
                range: [
                    [block[0] * this.sheetState.blockSize[0],
                     block[1] * this.sheetState.blockSize[1]],
                    [Math.min((block[0] + 1) * this.sheetState.blockSize[0], this.sheetState.columnCt - 1),
                     Math.min((block[1] + 1) * this.sheetState.blockSize[1], this.sheetState.rowCt - 1)]
                ]
            })
        })

        let scrollbarWidth = '8px';
        let minScrollbarSizePx = 30;

        if (renderingConfig.bottomScrollbar) {
            this.sheetContentHolder.style.height = 'calc(100% - ' + (scrollbarWidthPx + 4) + 'px)';
            this.sheetBottomScrollbarHolder.style.height = scrollbarWidth;
            this.sheetBottomScrollbarHolder.style.display = '';

            let visibleCols = Math.ceil(this.lastWidth / this.sheetState.cellWidth);
            let totalCols = this.sheetState.columnCt;
            let frac = this.sheetState.corner[0] / Math.max(1, totalCols - visibleCols);
            let fracVisible = visibleCols / Math.max(totalCols, 1);
            let visiblePx = Math.max(minScrollbarSizePx, fracVisible * this.lastWidth);
            let leftPx = frac * (this.lastWidth - scrollbarWidthPx - visiblePx);

            this.bottomScrollbarState = {
                visibleCols: visibleCols,
                totalCols: totalCols,
                frac: frac,
                fracVisible: fracVisible,
                visiblePx: visiblePx,
                offsetPx: leftPx,
                sizePx: this.lastWidth - scrollbarWidthPx - scrollbarPadding * 2
            }

            this.sheetBottomScrollbarBody.style.height = scrollbarWidth;
            this.sheetBottomScrollbarBody.style.width = visiblePx + "px";
            this.sheetBottomScrollbarBody.style.left = leftPx + "px";
        } else {
            this.sheetContentHolder.style.height = '100%';
            this.sheetBottomScrollbarHolder.style.height = '0px';
            this.sheetBottomScrollbarHolder.style.display = 'none';
        }

        // right scrollbar
        if (renderingConfig.rightScrollbar) {
            this.sheetContentHolder.style.width = 'calc(100% - ' + (scrollbarWidthPx + 4) + 'px)';
            this.sheetRightScrollbarHolder.style.width = scrollbarWidth;
            this.sheetRightScrollbarHolder.style.display = '';

            let visibleRows = Math.ceil(this.lastHeight / this.sheetState.cellHeight);
            let totalRows = this.sheetState.rowCt;
            let frac = this.sheetState.corner[1] / Math.max(1, totalRows - visibleRows);
            let fracVisible = visibleRows / Math.max(totalRows, 1);
            let visiblePx = Math.max(minScrollbarSizePx, fracVisible * this.lastHeight);
            let topPx = frac * (this.lastHeight - scrollbarWidthPx - visiblePx);

            this.sheetRightScrollbarBody.style.width = scrollbarWidth;
            this.sheetRightScrollbarBody.style.height = visiblePx + "px";
            this.sheetRightScrollbarBody.style.top = topPx + "px";

            this.rightScrollbarState = {
                visibleRows: visibleRows,
                totalRows: totalRows,
                frac: frac,
                fracVisible: fracVisible,
                visiblePx: visiblePx,
                offsetPx: topPx,
                sizePx: this.lastHeight - scrollbarWidthPx - scrollbarPadding * 2
            }
        } else {
            this.sheetContentHolder.style.width = '100%';
            this.sheetRightScrollbarHolder.style.width = '0px';
            this.sheetRightScrollbarHolder.style.display = 'none';
        }

        if (this.visibleOverlayDiv !== null) {
            replaceChildren(
                this.visibleOverlayDiv,
                this.computeOverlayChildren()
            );
        }
    }

    computeOverlayChildren() {
        if (!this.showOverlay) {
            return [];
        }

        let x = this.sheetState.selection[1][0];
        let y = this.sheetState.selection[1][1];
        let contents = this.sheetState.getContentsFor(
            x, y, false
        );

        return [
            h('div', {class: 'sheet-cell-overlay-contents'}, [contents])
        ]
    }

    build() {
        if (this.div !== null) {
            return this.div;
        }

        this.sheetCellGridLayer = h('div', {class: 'sheet-cell-layer'}, []);
        this.sheetCellDataLayer = h('div', {class: 'sheet-cell-layer'}, []);
        this.sheetSelectionLayer = h('div', {class: 'sheet-cell-layer'}, []);
        this.visibleOverlayDiv = h('div', {class: 'sheet-visible-overlay-layer'}, [])

        this.sheetContentHolder = h('div',
            { class: 'sheet-content-holder',
             'onmousedown': this.onMousedown
            },
            [
                this.sheetCellGridLayer,
                this.sheetSelectionLayer,
                this.sheetCellDataLayer,
            ]
        );

        this.sheetRightScrollbarBackground = h('div', {class: 'sheet-scrollbar-background'}, []);
        this.sheetRightScrollbarBody = h('div', {class: 'sheet-scrollbar'}, []);

        this.sheetBottomScrollbarBackground = h('div', {class: 'sheet-scrollbar-background'}, []);
        this.sheetBottomScrollbarBody = h('div', {class: 'sheet-scrollbar'}, []);

        this.sheetRightScrollbarHolder = h('div',
            {
                class: 'sheet-right-scrollbar-holder',
                onmousedown: (event) => this.onScrollbarMousedown(event, 'right')
            },
            [
                this.sheetRightScrollbarBackground,
                this.sheetRightScrollbarBody,
            ]
        )

        this.sheetBottomScrollbarHolder = h('div',
            {
                class: 'sheet-bottom-scrollbar-holder',
                onmousedown: (event) => this.onScrollbarMousedown(event, 'bottom')
            },
            [
                this.sheetBottomScrollbarBackground,
                this.sheetBottomScrollbarBody,
            ]
        )

        this.sheetDiv = h('div', {
            class: 'sheet-main-display',
            style: 'height:calc(100% - ' + (this.props.rowHeight + 2) + "px);"
                + 'width:100%;position:absolute;'
                + 'top:' + (this.props.rowHeight + 2) + 'px;'
                + 'left:0px;',
            onkeydown: this.onKeydown,
            onfocus: this.focusReceived,
            onblur: this.focusLost,
            tabindex: 0
        }, [
            this.sheetContentHolder,
            this.sheetRightScrollbarHolder,
            this.sheetBottomScrollbarHolder,
            this.visibleOverlayDiv
        ]);

        this.sheetHeaderDiv = h('div', {
            class: 'sheet-header',
            style: 'height:' + (this.props.rowHeight + 2) + "px;"
                + 'width:100%;position:absolute;top:0px;left:0px'
        }, []);

        this.div = h('div', {
            id: this.getElementId(),
            class: 'cell sheet',
            'data-cell-id': this.identity,
            'data-cell-type': 'Sheet',
        }, [
            this.sheetHeaderDiv,
            this.sheetDiv
        ]);

        return this.div;
    }
};

export {
    Sheet,
    Sheet as default
};
