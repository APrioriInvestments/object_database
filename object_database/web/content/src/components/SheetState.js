import {makeDomElt as h, replaceChildren} from './Cell';

let scrollbarWidthPx = 8;
let scrollbarPadding = 2;
let lockedCellColor = "#EEEEEE";
let charWidthPx = 8;
let minCharsInCell = 10;
let maxFloatPrecision = 10;
let headerBarGuideWidthPx = 240;

let toPrecision = (flt, precision) => {
    let res = flt.toPrecision(precision);

    // no decimal? we're done
    if (res.indexOf('.') == -1) {
        return res;
    }

    // don't worry about exponentials yet
    if (res.indexOf('e') >= 0) {
        return res;
    }

    let i = res.length - 1;
    while (i > 0 && res[i] == '0') {
        i--;
    }

    if (i > 0 && res[i] == '.') {
        i--;
    }

    return res.slice(0, i + 1);
};

class SheetRenderingConfig {
    constructor(sheetState, width, height, isFocused, rightScrollbar, bottomScrollbar) {
        this.sheetState = sheetState;
        this.width = width;
        this.height = height;
        this.isFocused = isFocused;
        this.rightScrollbar = rightScrollbar;
        this.bottomScrollbar = bottomScrollbar;

        this.effectiveWidth = width - (rightScrollbar ? scrollbarWidthPx + scrollbarPadding * 2 : 0);
        this.effectiveHeight = height - (bottomScrollbar ? scrollbarWidthPx + scrollbarPadding * 2 : 0);
    }
};


// everything we know about the sheet:
//     current corner cell, (x,y), zero based
//     cell contents: xBlock->yBlock->[[values]]

class SheetState {
    constructor(cellWidth, cellHeight, columns, rows, lockColumns, lockRows) {
        // x -> y -> data. will be 'null' if server declined to produce
        this.cellContents = {};

        // blockX -> blockY -> true if data is already known
        this.blocksRequested = {};
        this.blockSize = [100, 100];

        // zero-based corner of the current view. note that this can be a float
        this.corner = [0, 0];

        // [[leftCol, topRow], [rightCol, bottomRow]] of the current selection cursor
        // these can be out of order - the second tuple is where the 'cursor' is.
        this.selection = [[0, 0], [0, 0]];

        this.columnCt = columns;
        this.rowCt = rows;
        this.lockColumns = lockColumns;
        this.lockRows = lockRows;

        this.cellWidth = cellWidth;
        this.cellHeight = cellHeight;

        // how many characters wide the maximum value is
        this.columnCharWidths = {};

        // if populated, the pixel offset to the _start_ of that column
        this.lastSheetWidth = null;
        this.cumulativeColumnWidths = null;

        this.computeSelectionBounds = this.computeSelectionBounds.bind(this);
        this.ensureSelectionInBounds = this.ensureSelectionInBounds.bind(this);
        this.ensureCursorOnscreen = this.ensureCursorOnscreen.bind(this);
        this.offsetSelection = this.offsetSelection.bind(this);
        this.renderCellDivs = this.renderCellDivs.bind(this);
        this.renderGridlineDivs = this.renderGridlineDivs.bind(this);
        this.renderHeaderDivs = this.renderHeaderDivs.bind(this);

        this.renderDivs = this.renderDivs.bind(this);
        this.renderSelectionDivs = this.renderSelectionDivs.bind(this);
        this.renderCell = this.renderCell.bind(this);

        this.columnOffset = this.columnOffset.bind(this);
        this.xPixelToColumn = this.xPixelToColumn.bind(this);
        this.totalWidth = this.totalWidth.bind(this);

        // when rendering numbers, how many digits would we need left or right of the
        // decimal to represent it?
        this.columnMaxLeftPrecisionRequired = {};
        this.columnMaxRightPrecisionRequired = {};

        this.renderGridCell = this.renderGridCell.bind(this);
        this.getContentsFor = this.getContentsFor.bind(this);
        this.handleKeyDown = this.handleKeyDown.bind(this);
        this.renderBoxDiv = this.renderBoxDiv.bind(this);
        this.getBlockRangesToRequest = this.getBlockRangesToRequest.bind(this);
        this.buildRenderingConfig = this.buildRenderingConfig.bind(this);
        this.onMouseDrag = this.onMouseDrag.bind(this);
        this.ensureCornerValid = this.ensureCornerValid.bind(this);
        this.absorbCellContents = this.absorbCellContents.bind(this);
        this.ensureCWCache = this.ensureCWCache.bind(this);
        this.columnWidth = this.columnWidth.bind(this);

        this.makeViewOf = this.makeViewOf.bind(this);
    }

    ensureCWCache(sheetWidth) {
        if (this.cumulativeColumnWidths === null || sheetWidth != this.lastSheetWidth) {
            this.lastSheetWidth = sheetWidth;
            this.cumulativeColumnWidths = new Int32Array(this.columnCt + 1);

            let offset = 0;
            for (let ix = 0; ix <= this.columnCt; ix++) {
                let spaceRemaining = sheetWidth - offset - 1 - scrollbarPadding * 2 - scrollbarWidthPx;

                let maxColumnWidth = Math.max(
                    sheetWidth / 3,
                    minCharsInCell * charWidthPx,
                    Math.floor(spaceRemaining / (this.columnCt - ix + 1e-6))
                );

                this.cumulativeColumnWidths[ix] = offset;

                let cw = this.columnCharWidths[ix];
                let cwPx = 0;
                if (cw === undefined) {
                    // the default
                    cwPx = charWidthPx * minCharsInCell;
                } else {
                    cwPx = Math.max(cw, minCharsInCell) * charWidthPx;
                }

                offset += Math.min(cwPx, maxColumnWidth);
            }
        }
    }

    columnWidth(i) {
        if (i < 0 || i >= this.columnCt) {
            return this.cellWidth;
        }

        return this.cumulativeColumnWidths[i + 1] - this.cumulativeColumnWidths[i];
    }

    columnOffset(i) {
        if (i < 0) {
            return (this.cellWidth * i);
        }

        if (i >= this.cumulativeColumnWidths.length) {
            return this.cumulativeColumnWidths[this.cumulativeColumnWidths.length - 1] + (
                i - this.cumulativeColumnWidths.length + 1
            ) * this.cellWidth;
        }

        let floorI = Math.floor(i);

        if (floorI == i) {
            return this.cumulativeColumnWidths[floorI];
        }

        return this.cumulativeColumnWidths[floorI] + (i % 1.0) * this.columnWidth(floorI);
    }

    totalWidth() {
        return this.cumulativeColumnWidths[this.cumulativeColumnWidths.length - 1];
    }

    xPixelToColumn(xPx) {
        if (xPx <= 0) {
            return xPx / this.cellWidth;
        }

        let pos = 0;
        while (this.columnOffset(pos) < xPx) {
            pos += 1;

            let skip = 1;
            while (this.columnOffset(pos + skip) < xPx) {
                pos += skip;
                skip *= 2;
            }
        }

        let topPx = this.columnOffset(pos);
        let bottomPx = this.columnOffset(pos - 1);

        return pos - 1 + (xPx - bottomPx) / (topPx - bottomPx);
    }

    getContentsFor(i, j, applyFormatting=true) {
        if (this.cellContents[i] === undefined) {
            return ''
        }

        let contents = this.cellContents[i][j];

        if (contents === null || contents == undefined) {
            return ''
        }

        if (typeof(contents) == 'number' && applyFormatting) {
            let rep = toPrecision(contents, maxFloatPrecision);

            let dotIx = rep.indexOf('.');
            if (dotIx == -1) {
                dotIx = rep.indexOf('e');
            }
            if (dotIx == -1) {
                dotIx = rep.length;
            }

            let extra = 0;
            if (this.columnMaxLeftPrecisionRequired[i] + this.columnMaxRightPrecisionRequired[i] + 1 < minCharsInCell) {
                extra = Math.floor(
                    (minCharsInCell - (
                        this.columnMaxLeftPrecisionRequired[i] + this.columnMaxRightPrecisionRequired[i] + 1
                    )) / 2
                );
            }

            return ' '.repeat(Math.max(this.columnMaxLeftPrecisionRequired[i] - dotIx, 0) + extra) + rep;
        }

        return '' + contents;
    }

    absorbCellContents(x, y, data) {
        let widthOf = (s) => {
            if (typeof(s) == 'number') {
                return Math.min(
                    s.toString().length,
                    toPrecision(s, maxFloatPrecision).length
                ) + 1;
            }

            s = '' + s;

            return s.length + s.split('\n').length
        }

        for (let yOff = 0; yOff < data.length; yOff++) {
            let row = data[yOff];

            for (let xOff = 0; xOff < row.length; xOff++) {
                let widthOfCell = Math.min(widthOf(row[xOff]), 500);

                if (this.cellContents[x + xOff] === undefined) {
                    this.cellContents[x + xOff] = {};
                }

                this.cellContents[x + xOff][y + yOff] = row[xOff];

                if (typeof(row[xOff]) == 'number') {
                    // this is going to get shown as a number. Calculate the number
                    // of digits to the left and right of the decimal.
                    let rep = toPrecision(row[xOff], maxFloatPrecision);

                    let dotIx = rep.indexOf('.')
                    let leftOf = 0;
                    let rightOf = 0;
                    if (dotIx == -1) {
                        dotIx = rep.indexOf('e');
                    }
                    if (dotIx == -1) {
                        leftOf = rep.length;
                        rightOf = 0;
                    } else {
                        leftOf = dotIx;
                        rightOf = rep.length - dotIx - 1;
                    }

                    let col = x + xOff;
                    if (this.columnMaxLeftPrecisionRequired[col] === undefined) {
                        this.columnMaxLeftPrecisionRequired[col] = leftOf;
                    } else {
                        this.columnMaxLeftPrecisionRequired[col] = Math.max(
                            leftOf, this.columnMaxLeftPrecisionRequired[col]
                        );
                    }

                    if (this.columnMaxRightPrecisionRequired[col] === undefined) {
                        this.columnMaxRightPrecisionRequired[col] = rightOf;
                    } else {
                        this.columnMaxRightPrecisionRequired[col] = Math.max(
                            rightOf, this.columnMaxRightPrecisionRequired[col]
                        );
                    }

                    let worstWidth = (
                        this.columnMaxRightPrecisionRequired[col] +
                        this.columnMaxLeftPrecisionRequired[col] + 1
                    );

                    if (worstWidth > widthOfCell) {
                        widthOfCell = worstWidth;
                    }
                }

                // upsize the column widths
                if (this.columnCharWidths[x + xOff] === undefined || this.columnCharWidths[x + xOff] < widthOfCell) {
                    this.columnCharWidths[x + xOff] = widthOfCell;
                    this.cumulativeColumnWidths = null;
                }
            }
        }
    }


    onMouseDrag(x, y, width, height, isFirst) {
        let xCell = Math.floor(this.xPixelToColumn(this.columnOffset(this.corner[0]) + x));
        let yCell = Math.floor(this.corner[1] + y / this.cellHeight);

        if (x < this.columnOffset(this.lockColumns)) {
            xCell = Math.floor(this.xPixelToColumn(x));
        }

        if (y < this.lockRows * this.cellHeight) {
            yCell = Math.floor(y / this.cellHeight);
        }

        xCell = Math.max(0, Math.min(xCell, this.columnCt - 1));
        yCell = Math.max(0, Math.min(yCell, this.rowCt - 1));

        this.selection[1] = [xCell, yCell];

        if (isFirst) {
            this.selection[0] = [xCell, yCell];
        }
    }

    buildRenderingConfig(width, height, isFocused) {
        return new SheetRenderingConfig(
            this,
            width,
            height,
            isFocused,
            height < this.rowCt * this.cellHeight,
            width < this.totalWidth()
        );
    }

    getBlockRangesToRequest(renderConfig) {
        let height = renderConfig.effectiveHeight;
        let width = renderConfig.effectiveWidth;

        let visibleRows = Math.ceil(height / this.cellHeight);
        let visibleCols = this.xPixelToColumn(this.columnOffset(this.corner[0]) + width) - this.corner[0] + 1;

        // return a list of ranges we should request, and mark them as requested
        let x = this.corner[0];
        let y = this.corner[1];

        let x0 = Math.max(0, Math.floor((x - visibleCols * 2) / this.blockSize[0]));
        let x1 = Math.max(0, Math.ceil((x + visibleCols * 2) / this.blockSize[0]));

        let y0 = Math.max(0, Math.floor((y - visibleRows * 2) / this.blockSize[1]));
        let y1 = Math.max(0, Math.ceil((y + visibleRows * 2) / this.blockSize[1]));

        let res = [];

        for (let blockX = x0; blockX <= x1; blockX++) {
            for (let blockY = y0; blockY <= y1; blockY++) {
                if (this.blocksRequested[blockX] === undefined
                        || this.blocksRequested[blockX][blockY] === undefined) {
                    if (blockX * this.blockSize[0] < this.columnCt &&
                            blockY * this.blockSize[1] < this.rowCt) {
                        res.push([blockX, blockY]);

                        if (this.blocksRequested[blockX] === undefined) {
                            this.blocksRequested[blockX] = {};
                        }

                        this.blocksRequested[blockX][blockY] = true;
                    }
                }
            }
        }

        return res;
    }

    ensureCursorOnscreen(renderConfig) {
        if (this.selection[0][0] < this.lockColumns || this.selection[0][1] < this.lockRows) {
            // do nothing - by definition our cursor is onscreen
            return;
        }

        let lockXWidth = this.columnOffset(this.lockColumns);
        let lockYHeight = this.cellHeight * this.lockRows;

        let xOff = this.columnOffset(this.corner[0]);
        let yOff = this.cellHeight * this.corner[1];

        // this is the effective width of the visible non-lock portion of the screen
        // this is what's supposed to be on screen
        let width = renderConfig.effectiveWidth - 1 - lockXWidth;
        let height = renderConfig.effectiveHeight - 1 - lockYHeight;

        // this is the upper left corner of what's visible.
        let ulPixelX = xOff + lockXWidth;
        let ulPixelY = yOff + lockYHeight;

        let ulColumn = this.xPixelToColumn(ulPixelX);
        let ulRow = ulPixelY / this.cellHeight;

        let lrColumn = this.xPixelToColumn(ulPixelX + width);
        let lrRow = (ulPixelY + height) / this.cellHeight;

        if (this.selection[0][0] < ulColumn) {
            this.corner[0] = this.xPixelToColumn(
                this.columnOffset(this.selection[0][0]) - lockXWidth
            );
        }

        if (this.selection[0][0] + 1 >= lrColumn) {
            this.corner[0] = this.xPixelToColumn(
                this.columnOffset(this.selection[0][0] + 1) - lockXWidth - width
            );
        }

        if (this.selection[0][1] < ulRow) {
            this.corner[1] = this.selection[0][1] - lockYHeight / this.cellHeight;
        }

        if (this.selection[0][1] + 1 >= lrRow) {
            this.corner[1] = this.selection[0][1] + 1 - (lockYHeight + height) / this.cellHeight;
        }

        this.ensureCornerValid(renderConfig);
    }

    ensureCornerValid(renderConfig) {
        let width = renderConfig.effectiveWidth - 1;
        let height = renderConfig.effectiveHeight - 1;

        let rightmost = this.xPixelToColumn(this.totalWidth() - width);
        let topmost = this.rowCt - height / this.cellHeight;

        this.corner[0] = Math.max(0, Math.min(rightmost, this.corner[0]))
        this.corner[1] = Math.max(0, Math.min(topmost, this.corner[1]))

        if (this.corner[0] < Math.floor(rightmost)) {
            this.corner[0] = Math.floor(this.corner[0]);
        }

        if (this.corner[1] < Math.floor(topmost)) {
            this.corner[1] = Math.floor(this.corner[1]);
        }
    }

    ensureSelectionInBounds() {
        this.selection[0][0] = Math.min(this.columnCt - 1, Math.max(0, this.selection[0][0]));
        this.selection[1][0] = Math.min(this.columnCt - 1, Math.max(0, this.selection[1][0]));
        this.selection[0][1] = Math.min(this.rowCt - 1, Math.max(0, this.selection[0][1]));
        this.selection[1][1] = Math.min(this.rowCt - 1, Math.max(0, this.selection[1][1]));
    }

    offsetSelection(x, y, shiftKey, ctrlKey) {
        if (ctrlKey) {
            x *= this.columnCt;
            y *= this.rowCt;
        }

        this.selection[1][0] += x;
        this.selection[1][1] += y;

        if (!shiftKey) {
            this.selection[0][0] = this.selection[1][0];
            this.selection[0][1] = this.selection[1][1];
        }

        this.ensureSelectionInBounds();
    }

    // return a selection box where the bounds are in the correct order,
    // since the col/row can be out of bounds
    computeSelectionBounds() {
        let s = this.selection;

        return [
            [Math.min(s[0][0], s[1][0]), Math.min(s[0][1], s[1][1])],
            [Math.max(s[0][0], s[1][0]), Math.max(s[0][1], s[1][1])],
        ]
    }

    handleKeyDown(event, height, width) {
        if (!event.altKey && !event.metaKey) {
            if (event.key == 'ArrowRight') {
                this.offsetSelection(1, 0, event.shiftKey, event.ctrlKey);
                return true;
            }
            if (event.key == 'ArrowLeft') {
                this.offsetSelection(-1, 0, event.shiftKey, event.ctrlKey);
                return true;
            }
            if (event.key == 'ArrowUp') {
                this.offsetSelection(0, -1, event.shiftKey, event.ctrlKey);
                return true;
            }
            if (event.key == 'ArrowDown') {
                this.offsetSelection(0, 1, event.shiftKey, event.ctrlKey);
                return true;
            }
        }

        if (!event.metaKey && !event.ctrlKey) {
            if (event.key == "PageDown" || event.key == "PageUp") {
                let sign = event.key == "PageDown" ? 1 : -1;
                let visibleRows = Math.ceil(height / this.cellHeight) * sign;
                let visibleCols = this.xPixelToColumn(this.columnOffset(this.corner[0]) + width) - this.corner[0] + 1;
                visibleCols *= sign;

                this.offsetSelection(
                    event.altKey ? visibleCols : 0, event.altKey ? 0 : visibleRows,
                    event.shiftKey, event.ctrlKey
                );

                return true;
            }
        }

        return false;
    }

    // produce a correctly-placed div for a single cell
    renderBoxDiv(i, j, frameLeft, frameTop, properties, children, background=false) {
        let leftPx = this.columnOffset(i);
        let widthPx = this.columnOffset(i + 1) - leftPx;
        leftPx -= this.columnOffset(frameLeft);

        let topPx = (j - frameTop) * this.cellHeight;

        let style = (
            'left:' + leftPx + "px;top:" + topPx + "px;"
            +"width:" + widthPx + "px;"
            +"height:" + this.cellHeight + "px;"
        )

        if (background && (i < this.lockColumns || j < this.lockRows) &&
                i < this.columnCt && j < this.rowCt) {
            style += "background-color: " + lockedCellColor + ";";
        }

        let props = {};
        Object.assign(props, properties);
        if (props.style !== undefined) {
            props.style = props.style + ";" + style;
        } else {
            props.style = style;
        }

        return h('div', props, children);
    }

    renderCell(i, j, frameLeft, frameTop) {
        if (i >= this.columnCt || j >= this.rowCt) {
            return null;
        }

        let contents = this.getContentsFor(i,j);

        let cw = this.columnWidth(i);
        let maxChars = Math.ceil(cw / charWidthPx);

        let overflowed = false;
        if (maxChars < contents.length) {
            contents = contents.slice(0, maxChars);
            overflowed = true;
        }

        let divs = [];

        let lines = contents.split('\n')

        for (let ix = 0; ix < lines.length; ix++) {
            if (divs.length) {
                divs.push(h('div', {style:'color:#BBBBBB;display:inline;padding:2px'}, ['\\n']))
            }
            divs.push(h('div', {style:"display:inline"}, [lines[ix]]));
        }

        let newlinePos = contents.indexOf('\n');

        if (overflowed) {
            divs = [h('div',
                {style: 'display:inline;position:absolute;height:100%;width:calc(100% - 30px);overflow:hidden'},
                divs
            )]

            divs.push(
                h('div', {class: 'sheet-cell-more-content-available'}, ['...'])
            );
        }

        return this.renderBoxDiv(i, j, frameLeft, frameTop, {class: 'sheet-cell'}, divs);
    }

    renderGridCell(i, j, frameLeft, frameTop) {
        let res = this.renderBoxDiv(i, j, frameLeft, frameTop, {class: 'sheet-grid-cell'}, [], true);

        if (i >= this.columnCt) {
            res.style['border-top'] = '0px';
        }
        if (j >= this.rowCt) {
            res.style['border-left'] = '0px';
        }

        if (i > this.columnCt || j > this.rowCt) {
            return null;
        }

        return res;
    }

    // render 'divs' in a view where we show 'upperLeft/lowerRight' (in screen coords) with
    // the upper left corner of the screen at 'corner'
    makeViewOf(corner, upperLeft, lowerRight, divs) {
        return h('div', {
            class: 'sheet-restriction-panel',
            style: `left:${upperLeft[0]}px;top:${upperLeft[1]}px;`
                +  `width:${lowerRight[0] - upperLeft[0]}px;`
                +  `height:${lowerRight[1] - upperLeft[1]}px;`
            },
            [
                h('div', {
                    class: 'sheet-restriction-panel',
                    style: `left:${-upperLeft[0]}px;top:${-upperLeft[1]}px;`
                        +  `width:${lowerRight[0]+1}px;`
                        +  `height:${lowerRight[1]+1}px;`
                    },
                    divs.filter((x) => x !== null)
                )
            ]
        )
    }

    renderDivs(width, height, isFocused, renderFun) {
        let res = [];
        let maxColumn = Math.ceil(this.xPixelToColumn(this.columnOffset(this.corner[0]) + width)) + 1;
        let rows = Math.ceil(height / this.cellHeight) + 1;

        let lockPoint = [this.columnOffset(this.lockColumns), this.lockRows * this.cellHeight];
        let cornerPoint = [this.columnOffset(this.corner[0]), this.corner[1] * this.cellHeight];

        let bodyDivs = [];
        let leftDivs = [];
        let topDivs = [];
        let cornerDivs = [];

        // body
        for (let i = Math.floor(Math.max(this.corner[0], this.lockColumns)); i <= maxColumn && i <= this.columnCt; i++) {
            for (let j = Math.floor(Math.max(this.corner[1], this.lockRows)); j <= Math.ceil(this.corner[1] + rows) && j <= this.rowCt; j++) {
                bodyDivs.push(renderFun(i, j, this.corner[0], this.corner[1]));
            }
        }

        for (let i = 0; i < this.lockColumns; i++) {
            for (let j = 0; j < this.lockRows; j++) {
                cornerDivs.push(renderFun(i, j, 0, 0));
            }
        }

        for (let i = Math.max(this.lockColumns, Math.floor(this.corner[0])); i <= maxColumn && i <= this.columnCt; i++) {
            for (let j = 0; j < this.lockRows; j++) {
                leftDivs.push(renderFun(i, j, this.corner[0], 0));
            }
        }

        for (let i = 0; i < this.lockColumns; i++) {
            for (let j = Math.max(this.lockRows, Math.floor(this.corner[1])); j <= Math.ceil(this.corner[1] + rows) && j <= this.rowCt; j++) {
                topDivs.push(renderFun(i, j, 0, this.corner[1]));
            }
        }

        return [
            this.makeViewOf([0,0], [0, 0], lockPoint, cornerDivs),
            this.makeViewOf(cornerPoint, lockPoint, [width + 1, height + 1], bodyDivs),
            this.makeViewOf([cornerPoint[0], 0], [lockPoint[0], 0], [width + 1, lockPoint[1]], leftDivs),
            this.makeViewOf([0, cornerPoint[1]], [0, lockPoint[1]], [lockPoint[0], height + 1], topDivs),
        ];
    }

    renderCellDivs(width, height, isFocused) {
        return this.renderDivs(width, height, isFocused,
            (x, y, frameLeft, frameTop) => this.renderCell(x, y, frameLeft, frameTop));
    }

    renderHeaderDivs(width, height, isShowingFullOverlay) {
        let rep = '(' + (this.selection[0][0] + 1) + ", " + (this.selection[0][1] + 1) + ")";
        rep += " of (" + this.columnCt + ", " + this.rowCt + ")";

        let x = this.selection[1][0];
        let y = this.selection[1][1];

        let contents = this.getContentsFor(
            x, y, false
        );

        // don't show a summary in the header if we're showing the full overlay
        if (isShowingFullOverlay) {
            contents = ""
        }

        return [
            h('div', {
                'class': 'sheet-header-bar-guide',
                'style':
                    'height:' + this.cellHeight + "px;"
                  + 'width:' + headerBarGuideWidthPx + "px;"
                  + 'background-color:' + lockedCellColor + ";"

            }, [rep]),
            h('div', {
                'class': 'sheet-currently-selected-contents',
                'style': 'width: calc(100% - ' + (headerBarGuideWidthPx - 2) + "px);"
                    + 'left:' + (headerBarGuideWidthPx - 1) + "px;"
                    + 'background-color:' + lockedCellColor + ";"
                  + 'z-index: 1;'
                  + 'top: -1px;'
                  + 'max-height: ' + (height - this.cellHeight * 2) + "px;"
                  + 'min-height: ' + (this.cellHeight + 2) + "px;"
                },
                [contents]
            )
        ]
    }

    renderGridlineDivs(width, height, isFocused) {
        return this.renderDivs(width, height, isFocused,
            (x, y, frameLeft, frameTop) => this.renderGridCell(x, y, frameLeft, frameTop));
    }

    renderSelectionDivs(width, height, isFocused) {
        let lockPoint = [this.columnOffset(this.lockColumns), this.lockRows * this.cellHeight];
        let cornerPoint = [this.columnOffset(this.corner[0]), this.corner[1] * this.cellHeight];

        let cornerDivs = this.renderSelectionDivsInner(isFocused, 0, 0);
        let bodyDivs = this.renderSelectionDivsInner(isFocused, this.corner[0], this.corner[1]);
        let leftDivs = this.renderSelectionDivsInner(isFocused, 0, this.corner[1]);
        let topDivs = this.renderSelectionDivsInner(isFocused, this.corner[0], 0);

        return [
            this.makeViewOf([0, 0], [0, 0], lockPoint, cornerDivs),
            this.makeViewOf(cornerPoint, lockPoint, [width + 1, height + 1], bodyDivs),
            this.makeViewOf([cornerPoint[0], 0], [lockPoint[0], 0], [width + 1, lockPoint[1]], topDivs),
            this.makeViewOf([0, cornerPoint[1]], [0, lockPoint[1]], [lockPoint[0], height + 1], leftDivs),
        ]
    }

    renderSelectionDivsInner(isFocused, frameLeft, frameTop) {
        let res = [];

        let selectionBounds = this.computeSelectionBounds();

        let leftPx = this.columnOffset(Math.max(selectionBounds[0][0], frameLeft - 10000));
        let widthPx = this.columnOffset(Math.min(selectionBounds[1][0], frameLeft + 10000) + 1) - leftPx + 1;

        leftPx -= this.columnOffset(frameLeft);

        let topPx = (Math.max(selectionBounds[0][1], frameTop - 10000) - frameTop) * this.cellHeight;
        let heightPx = (Math.min(selectionBounds[1][1] - selectionBounds[0][1], 30000) + 1) * this.cellHeight + 1;

        res.push(
            h('div',
                {
                    class: 'sheet-selection' + (isFocused ? "" : '-unfocused'),
                    style:
                        'left:' + leftPx + 'px;'
                    +   'top:' + topPx + 'px;'
                    +   'height:' + heightPx + 'px;'
                    +   'width:' + widthPx + 'px;'
                },
            )
        )

        if (isFocused) {
            res.push(
                this.renderBoxDiv(
                    this.selection[1][0],
                    this.selection[1][1],
                    frameLeft,
                    frameTop,
                    {'class': 'sheet-selection-active-element'},

                )
            )
        }

        return res;
    }
}

export {
    SheetState,
    charWidthPx,
    SheetState as default
};
