/**
 * Sheet Cell Cell
 * ----------------------------------
 * NOTE: This iteration of the Cell
 * makes use of our custom element
 * ap-sheet webCell under the hood.
 * See the `webCells` directory for
 * more information
 */
import {makeDomElt as h} from './Cell';
import {ConcreteCell} from './ConcreteCell';
import {
    KeyListener,
    KeyBinding
} from './util/KeyListener';

/**
 * About Named Children
 * --------------------
 * `error` (single) - An error cell (if present)
 */

class Sheet extends ConcreteCell {
    constructor(props, ...args){
        super(props, ...args);

        // We hardcode the maximum selector.selectionFrame.area to copy
        // to clipboard
        this.maxCellsToClipboard = 1000000;

        // We store the created KeyBindings
        // here for now for debugging
        // purposes
        this.keyBindings = [];

        // Set whether or not the mouse
        // is clicked down. We use this
        // to handle movement selections
        this._mouseIsDown = false;

        // Bind Cell methods
        this.updateHeaderDisplay = this.updateHeaderDisplay.bind(this);
        this.resizeHeaderDisplay = this.resizeHeaderDisplay.bind(this);
        this.setupEvents = this.setupEvents.bind(this);
        this.setupResize = this.setupResize.bind(this);
        this.resize = this.resize.bind(this);
        this._calculateSize = this._calculateSize.bind(this);
        this.tearDownEvents = this.tearDownEvents.bind(this);
        this.onSheetNeedsData = this.onSheetNeedsData.bind(this);
        this.copyToClipboard = this.copyToClipboard.bind(this);
        this.fetchClipboardData = this.fetchClipboardData.bind(this);

        // Bind Cell event handlers
        this.onPageUp = this.onPageUp.bind(this);
        this.onPageDown = this.onPageDown.bind(this);
        this.onPageRight = this.onPageRight.bind(this);
        this.onPageLeft = this.onPageLeft.bind(this);
        this.onSelectPageUp = this.onSelectPageUp.bind(this);
        this.onSelectPageDown = this.onSelectPageDown.bind(this);
        this.onSelectPageRight = this.onSelectPageRight.bind(this);
        this.onSelectPageLeft = this.onSelectPageLeft.bind(this);
        this.onArrowUp = this.onArrowUp.bind(this);
        this.onSelectArrowUp = this.onSelectArrowUp.bind(this);
        this.onUpToTop = this.onUpToTop.bind(this);
        this.onSelectUpToTop = this.onSelectUpToTop.bind(this);
        this.onArrowDown = this.onArrowDown.bind(this);
        this.onSelectArrowDown = this.onSelectArrowDown.bind(this);
        this.onDownToBottom = this.onDownToBottom.bind(this);
        this.onSelectDownToBottom = this.onSelectDownToBottom.bind(this);
        this.onArrowRight = this.onArrowRight.bind(this);
        this.onSelectDownToBottom = this.onSelectDownToBottom.bind(this);
        this.onSelectArrowRight = this.onSelectArrowRight.bind(this);
        this.onOverToRight = this.onOverToRight.bind(this);
        this.onSelectOverToRight = this.onSelectOverToRight.bind(this);
        this.onArrowLeft = this.onArrowLeft.bind(this);
        this.onSelectArrowLeft = this.onSelectArrowLeft.bind(this);
        this.onOverToLeft = this.onOverToLeft.bind(this);
        this.onSelectOverToLeft = this.onSelectOverToRight.bind(this);
        this.onCopyToClipboard = this.onCopyToClipboard.bind(this);

        // Bind mouse event handlers
        this.onMouseDown = this.onMouseDown.bind(this);
        this.onMouseUp = this.onMouseUp.bind(this);
        this.onMouseMove = this.onMouseMove.bind(this);
        this.onMouseLeave = this.onMouseLeave.bind(this);
        this.onMouseEnter = this.onMouseEnter.bind(this);
        this.onMouseWheel = this.onMouseWheel.bind(this);
    }

    onFirstInstalled(){
        this.setupEvents();
        this.setupResize();
    }

    cellWillUnload(){
        this.tearDownEvents();
    }

    setupEvents(){
        let myElement = this.domElement;
        this.keyBindings = [
            new KeyBinding(
                'PageUp',
                this.onPageUp,
                true,
                true,
                true
            ),
            new KeyBinding(
                'PageDown',
                this.onPageDown,
                true,
                true,
                true
            ),
            new KeyBinding(
                'altKey+PageUp',
                this.onPageLeft,
                true,
                true,
                true
            ),
            new KeyBinding(
                'altKey+PageDown',
                this.onPageRight,
                true,
                true,
                true
            ),
            new KeyBinding(
                'shiftKey+PageUp',
                this.onSelectPageUp,
                true,
                true,
                true
            ),
            new KeyBinding(
                'shiftKey+PageDown',
                this.onSelectPageDown,
                true,
                true,
                true
            ),
            new KeyBinding(
                'shiftKey+altKey+PageUp',
                this.onSelectPageLeft,
                true,
                true,
                true
            ),
            new KeyBinding(
                'shiftKey+altKey+PageDown',
                this.onSelectPageRight,
                true,
                true,
                true
            ),
            new KeyBinding(
                'ArrowUp',
                this.onArrowUp,
                true,
                true,
                true
            ),
            new KeyBinding(
                'shiftKey+ArrowUp',
                this.onSelectArrowUp,
                true,
                true,
                true
            ),
            new KeyBinding(
                'ctrlKey+ArrowUp',
                this.onUpToTop,
                true,
                true,
                true
            ),
            new KeyBinding(
                'ctrlKey+shiftKey+ArrowUp',
                this.onSelectUpToTop,
                true,
                true,
                true
            ),
            new KeyBinding(
                'ArrowDown',
                this.onArrowDown,
                true,
                true,
                true
            ),
            new KeyBinding(
                'shiftKey+ArrowDown',
                this.onSelectArrowDown,
                true,
                true,
                true
            ),
            new KeyBinding(
                'ctrlKey+ArrowDown',
                this.onDownToBottom,
                true,
                true,
                true
            ),
            new KeyBinding(
                'ctrlKey+shiftKey+ArrowDown',
                this.onSelectDownToBottom,
                true,
                true,
                true
            ),
            new KeyBinding(
                'ArrowRight',
                this.onArrowRight,
                true,
                true,
                true
            ),
            new KeyBinding(
                'shiftKey+ArrowRight',
                this.onSelectArrowRight,
                true,
                true,
                true
            ),
            new KeyBinding(
                'ctrlKey+ArrowRight',
                this.onOverToRight,
                true,
                true,
                true
            ),
            new KeyBinding(
                'ctrlKey+shiftKey+ArrowRight',
                this.onSelectOverToRight,
                true,
                true,
                true
            ),
            new KeyBinding(
                'ArrowLeft',
                this.onArrowLeft,
                true,
                true,
                true
            ),
            new KeyBinding(
                'shiftKey+ArrowLeft',
                this.onSelectArrowLeft,
                true,
                true,
                true
            ),
            new KeyBinding(
                'ctrlKey+ArrowLeft',
                this.onOverToLeft,
                true,
                true,
                true
            ),
            new KeyBinding(
                'ctrlKey+shiftKey+ArrowLeft',
                this.onSelectOverToLeft,
                true,
                true,
                true
            ),
            new KeyBinding(
                'ctrlKey+c',
                this.onCopyToClipboard,
                true,
                true,
                true
            )
        ];
        this.keyListener = new KeyListener(myElement, this.keyBindings);
        this.keyListener.start();
    }

    /* I watch for size changes of the parent container and resize
     * the sheet accordingly.
     */
    setupResize() {
        this.container = this.domElement.parentNode;

        const ro = new ResizeObserver(entries => {
            this.resize();
        });

        ro.observe(this.container);
        ro.observe(this.container.parentNode);
    }

    tearDownEvents(){
    }

    build(){
        let sheetDom = h('ap-sheet', {
            id: this.getElementId(),
            class: 'cell sheet-cell flex-child',
            'data-cell-id': this.identity,
            'data-cell-type': 'Sheet',
            'locked-rows': this.props.numLockRows,
            'locked-columns': this.props.numLockColumns,
            'total-rows': this.props.totalRows,
            'total-columns': this.props.totalColumns,
            'onmousedown': this.onMouseDown,
            'onmouseup': this.onMouseUp,
            'onmousemove': this.onMouseMove,
            'onmouseleave': this.onMouseLeave,
            'onmouseenter': this.onMouseEnter,
            'onwheel': this.onMouseWheel
        }, []);

        sheetDom.setAttribute('rows', 1);
        sheetDom.setAttribute('columns', 1);
        sheetDom.setAttribute('locked-rows', 0);
        sheetDom.setAttribute('locked-columns', 0);

        sheetDom.setAttribute('total-columns', this.props.totalColumns);
        sheetDom.setAttribute('total-rows', this.props.totalRows);

        // subtract 4 pixels because each cell has 2 pixels of stuff around it
        sheetDom.setAttribute('row-height', this.props.rowHeight - 4);
        sheetDom.setAttribute('col-width', this.props.colWidth - 4);

        sheetDom.addEventListener('sheet-needs-data', this.onSheetNeedsData);

        return sheetDom;
    }

    /* I resize the sheet by counting the max number of rows and columns which
     * fit into the sheet parent container. I also account for the extra header
     * row which appears at the top.
     */
    resize(){
        let element = this.domElement;
        let size = this._calculateSize(element);

        element.setAttribute('rows', size.rows);
        element.setAttribute('columns', size.columns);
        element.setAttribute('locked-rows', size.numLockedRows);
        element.setAttribute('locked-columns', size.numLockedColumns);
        if (element.afterChange) {
            element.afterChange();
        }
        this.resizeHeaderDisplay();
    }

    _calculateSize(element){
        let wrapper = this.container;
        let maxWidth = Math.floor(wrapper.clientWidth);
        let maxHeight = Math.floor(wrapper.clientHeight);

        // If we are using a table header, we need to
        // subtract that from the maxHeight.
        let tableHeader = element.querySelector('thead');
        if(tableHeader){
            let tableHeaderHeight = tableHeader.offsetHeight;
            maxHeight -= tableHeaderHeight * 2;
        }
        // If there are already attached td elements,
        // we use their bounding size for the height and
        // width. These will have more accurate bounding
        // measurements that include padding, borders, etc.
        let colWidth = this.props.colWidth;
        let rowHeight = this.props.rowHeight;
        let foundTDElement = wrapper.querySelector('td');
        if(foundTDElement){
            let tdBounds = foundTDElement.getBoundingClientRect();
            colWidth = foundTDElement.offsetWidth;
            rowHeight = foundTDElement.offsetHeight;
        }

        // Set the row height
        let rowNumber = Math.min(
            this.props.totalRows,
            Math.floor(maxHeight/(rowHeight))
        );

        // Make sure to return at least one row
        rowNumber = Math.max(1, rowNumber);
        let columnNumber = Math.min(this.props.totalColumns, Math.floor(maxWidth/colWidth));

        // Ensure that the number of locked columns
        // does not exceed the number of columns we will
        // show. If it does, limit it to just that number
        let adjustedLockedColumns = this.props.numLockColumns;
        if(adjustedLockedColumns >= columnNumber){
            adjustedLockedColumns = Math.max(0, columnNumber - 1);
        }

        // Ensure that the number of locked rows
        // does not exceed the number of rows we will
        // show. If it does, limit it to just that number
        let adjustedLockedRows = this.props.numLockRows;
        if(adjustedLockedRows >= rowNumber){
            adjustedLockedRows = Math.max(0, rowNumber - 1);
        }
        return {
            "columns": columnNumber,
            "rows": rowNumber,
            "numLockedColumns": adjustedLockedColumns,
            "numLockedRows": adjustedLockedRows
        };
    }

    onSheetNeedsData(event){
        let sheet = event.target;
        let frames = event.detail.frames;

        // We want to add some buffering
        // to our requests so we don't
        // keep fetching data when moving
        // by small amounts.
        // Here, we attempt to fetch an extra
        // primaryFrame sized chunk in each
        // direction for each frame.
        frames.forEach(frame => {
            let width = sheet.primaryFrame.size.x;
            let height = sheet.primaryFrame.size.y;
            let limitX = sheet.dataFrame.right;
            let limitY = sheet.dataFrame.bottom;

            frame.origin.x = Math.max(
                0,
                frame.origin.x - width
            );
            frame.origin.y = Math.max(
                0,
                frame.origin.y - height
            );
            frame.corner.x = Math.min(
                limitX,
                frame.corner.x + width
            );
            frame.corner.y = Math.min(
                limitY,
                frame.corner.y + height
            );
        });

        this.sendMessage({
            event: 'sheet_needs_data',
            action: "update",
            frames: frames.map(frame => {
                return {
                    origin: frame.origin,
                    corner: frame.corner
                };
            })
        });
    }

    onCopyToClipboard(event){
        let selectionFrame = event.target.selector.selectionFrame;
        if(selectionFrame.isEmpty){
            return this.copyToClipboard();
        }
        // I first check to make sure that we are not asking for too much data
        if (selectionFrame.area > this.maxCellsToClipboard){
            alert(`you can copy a maximum ${this.maxCellsToClipboard} cells`);
        } else {
            // then I check if the needed data is already loaded into the dataFrame
            // if it is I simply copy it
             if(event.target.dataFrame.hasCompleteDataForFrame(selectionFrame)){
                 this.copyToClipboard(selectionFrame);
             // if not I first fetch the needed data and then copy
             } else {
                 this.fetchClipboardData(selectionFrame);
             }
        }
    }

    /*
     * I generate a tab/newline delimited string from the underlying data in
     * the selectionFrame.
     * This I do somethihng pretty hacky, to get around the browser clipboard API,
     * which is available only for secure apps (which this is not). I create a 'dummy'
     * off-screen 'textarea' element, set its value to the set string, select the value
     * and execute the document level copy command. This writes the selected content to
     * the clipboard. Then I remove our 'dummy' element.
     */
    copyToClipboard(){
        let sheet = this.domElement;
        let clipboard;
        let selectionFrame = sheet.selector.selectionFrame;

        // If the selection frame is empty, this
        // means we are only copying the content at
        // the current cursor location
        if(selectionFrame.isEmpty){
            clipboard = sheet.selector.dataAtCursor.toString();
        } else {
            let data = sheet.dataFrame.getDataArrayForFrame(selectionFrame);
            // generates a clipboard string from the current points
            // Note: in order to create line breaks we slice along the y-axis
            clipboard = data.map(item => {return item.join("\t");}).join("\n");
        }

        // Create the dummy element for clipboard
        // manipulation
        let inputEl = document.createElement("textarea");
        inputEl.style.position = 'absolute';
        inputEl.style.top = '-10000px';
        sheet.appendChild(inputEl);
        inputEl.value = clipboard;
        inputEl.select();
        document.execCommand("copy");
        inputEl.remove();
    }

    fetchClipboardData(frame){
        this.sendMessage({
            event: 'sheet_needs_data',
            action: 'copy',
            frames: [
            {
                origin: frame.origin,
                corner: frame.corner
            }]
        });
    }

    handleMessages(messages) {
        let sheet = this.domElement;

        messages.forEach(data => {
            let frames = data.frames;
            frames.forEach(entry => {
                sheet.dataFrame.loadFromArray(
                    entry.data,
                    entry.origin
                );
            });
            if (data.action === "update"){
                sheet.primaryFrame.updateCellContents();
                this.updateHeaderDisplay();
            } else if (data.action === "copy"){
                this.copyToClipboard();
            }
        });

    }

    /* Local Callbacks */

    updateHeaderDisplay(){
        let sheet = this.domElement;
        let coordinateHeader = sheet.querySelector('table > thead th:first-child');
        let contentDisplay = sheet.querySelector('.sheet-content-display');

        // Set the coordinate header element to display
        // the cursor's current data-relative coordinate
        let cursorX = sheet.selector.relativeCursor.x;
        let cursorY = sheet.selector.relativeCursor.y;
        let coordinateText = `(${cursorX},${cursorY})`;

        // Set some information to display in the
        // content header element.
        let contentHeaderText = `${sheet.selector.dataAtCursor}`;
        if(!sheet.selector.selectionFrame.isEmpty){
            let frame = sheet.selector.selectionFrame;
            let originText = `(${frame.origin.x},${frame.origin.y})`.replace("Point","");
            let cornerText = `(${frame.corner.x},${frame.corner.y})`.replace("Point","");
            let boundsText = `Selection from ${originText} to ${cornerText}`;
            let sizeText = `(${frame.area} selected cells)`;
            contentHeaderText = `${boundsText} ${sizeText}`;
        } else {
            // cleanup content for the header display removing newlines and
            // the like
            //contentHeaderText = contentHeaderText.replace(/(\r\n|\n|\r)/gm, "");
            //contentHeaderText = contentHeaderText.replace(/(\r\n|\n|\r)/gm, "").replace(/\s+/gm," ");
        }
        coordinateHeader.innerText = coordinateText;
        contentDisplay.innerText = contentHeaderText;
    }

    resizeHeaderDisplay(){
        let sheet = this.domElement;
        let coordinateHeader = sheet.querySelector('th:first-child');
        let dummyHeader = sheet.querySelector('th:last-child');
        let contentDisplay = sheet.querySelector('.sheet-content-display');

        if (dummyHeader && coordinateHeader && contentDisplay) {
            let coordinateHeaderWidth = coordinateHeader.offsetWidth;
            let dummyHeaderWidth = dummyHeader.offsetWidth;
            if (contentDisplay.offsetParent) {
                let newWidth = contentDisplay.offsetParent.offsetWidth - coordinateHeaderWidth;
                contentDisplay.style.maxWidth = `${newWidth}px`;
                contentDisplay.style.left = `${coordinateHeaderWidth}px`;
            }
        }
    }

    /* Keyboard Event Handlers */

    onPageUp(event){
        event.target.selector.pageUp();
        this.updateHeaderDisplay();
    }

    onSelectPageUp(event){
        event.target.selector.pageUp(true);
        this.updateHeaderDisplay();
    }

    onPageRight(event){
        event.target.selector.pageRight();
        this.updateHeaderDisplay();
    }

    onSelectPageRight(event){
        event.target.selector.pageRight(true);
        this.updateHeaderDisplay();
    }

    onPageLeft(event){
        event.target.selector.pageLeft();
        this.updateHeaderDisplay();
    }

    onSelectPageLeft(event){
        event.target.selector.pageLeft(true);
        this.updateHeaderDisplay();
    }

    onPageDown(event){
        event.target.selector.pageDown();
        this.updateHeaderDisplay();
    }

    onSelectPageDown(event){
        event.target.selector.pageDown(true);
        this.updateHeaderDisplay();
    }

    onArrowUp(event){
        event.target.selector.moveUpBy(1);
        this.updateHeaderDisplay();
    }

    onSelectArrowUp(event){
        event.target.selector.moveUpBy(1, true);
        this.updateHeaderDisplay();
    }

    onArrowDown(event){
        event.target.selector.moveDownBy(1);
        this.updateHeaderDisplay();
    }

    onSelectArrowDown(event){
        event.target.selector.moveDownBy(1, true);
        this.updateHeaderDisplay();
    }

    onArrowLeft(event){
        event.target.selector.moveLeftBy(1);
        this.updateHeaderDisplay();
    }

    onSelectArrowLeft(event){
        event.target.selector.moveLeftBy(1, true);
        this.updateHeaderDisplay();
    }

    onArrowRight(event){
        event.target.selector.moveRightBy(1);
        this.updateHeaderDisplay();
    }

    onSelectArrowRight(event){
        event.target.selector.moveRightBy(1, true);
        this.updateHeaderDisplay();
    }

    onUpToTop(event){
        event.target.selector.moveToTopEnd();
        this.updateHeaderDisplay();
    }

    onSelectUpToTop(event){
        event.target.selector.moveToTopEnd(true);
        this.updateHeaderDisplay();
    }

    onDownToBottom(event){
        event.target.selector.moveToBottomEnd();
        this.updateHeaderDisplay();
    }

    onSelectDownToBottom(event){
        event.target.selector.moveToBottomEnd(true);
        this.updateHeaderDisplay();
    }

    onOverToRight(event){
        event.target.selector.moveToRightEnd();
        this.updateHeaderDisplay();
    }

    onSelectOverToRight(event){
        event.target.selector.moveToRightEnd(true);
        this.updateHeaderDisplay();
    }

    onOverToLeft(event){
        event.target.selector.moveToLeftEnd();
        this.updateHeaderDisplay();
    }

    onSelectOverToLeft(event){
        event.target.selector.moveToLeftEnd(true);
        this.updateHeaderDisplay();
    }

    /* Mouse Event Handlers */
    onMouseDown(event){
        let primaryButtonPushed = event.button == 0;
        if(event.target.matches('td') && primaryButtonPushed){
            this._mouseIsDown = true;
            let sheet = this.domElement;
            sheet.selector.setAnchorToElement(event.target);
            sheet.selector.setCursorToElement(event.target);
            sheet.selector.updateElements();

            // Update the header
            this.updateHeaderDisplay();
        }
    }

    onMouseUp(event){
        this._mouseIsDown = false;
    }

    onMouseEnter(event){
        let primaryButtonDown = event.buttons == 1;
        if(primaryButtonDown){
            this._mouseIsDown = true;
        }
    }

    onMouseLeave(event){
        this._mouseIsDown = false;
    }

    onMouseMove(event){
        if(this._mouseIsDown && event.target.matches('td')){
            let sheet = this.domElement;
            let currentCursor = sheet.selector.cursor;
            let isCursor = event.target.classList.contains('selector-cursor');
            let isAnchor = event.target.classList.contains('selector-anchor');
            if(isAnchor){
                // If we have moved back to the original
                // anchor point, this means we want to
                // reset the selection to be the single
                // cursor (ie, empty selection)
                sheet.selector.setAnchorToElement(event.target);
                sheet.selector.setCursorToElement(event.target);
                sheet.selector.updateElements();
                this.updateHeaderDisplay();
            } else if(!isCursor){
                // So long as we aren't moving within
                // the cursor element, we make a new
                // selection to the element in which
                // the mouse has moved
                sheet.selector.setCursorToElement(event.target);
                sheet.selector.selectFromAnchorTo(
                    sheet.selector.relativeCursor
                );
                sheet.selector.updateElements();
                this.updateHeaderDisplay();
            }
        }
    }

    onMouseWheel(event){
        let didWheelUp  = event.deltaY < 0;
        let didWheelDown = event.deltaY > 0;
        let isSelecting = event.shiftKey;
        let sheet = this.domElement;

        if(didWheelUp){
            sheet.selector.moveUpBy(1, isSelecting);
            this.updateHeaderDisplay();
        } else if(didWheelDown){
            sheet.selector.moveDownBy(1, isSelecting);
            this.updateHeaderDisplay();
        }
        event.stopPropagation();
        event.preventDefault();
    }
};

export {
    Sheet,
    Sheet as default
};
