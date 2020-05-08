/**
 * Sheet Cell Component
 * ----------------------------------
 * NOTE: This iteration of the Component
 * makes use of our custom element
 * ap-sheet webcomponent under the hood.
 * See the `webcomponents` directory for
 * more information
 */
import {h} from 'maquette';
import {Component} from './Component';
import {PropTypes} from './util/PropertyValidator';
import {
    KeyListener,
    KeyBinding
} from './util/KeyListener';

/**
 * About Named Children
 * --------------------
 * `error` (single) - An error cell (if present)
 */

class NewSheet extends Component {
    constructor(props, ...args){
        super(props, ...args);

        // We hardcode the maximum selector.selectionFrame.area to copy
        // to clipboard
        this.maxCellsToClipboad = 1000000;

        // We cache a reference
        // do the DOM node we will
        // ultimately create.
        this._cachedNode = null;

        // We store the created KeyBindings
        // here for now for debugging
        // purposes
        this.keyBindings = [];

        // Set whether or not the mouse
        // is clicked down. We use this
        // to handle movement selections
        this._mouseIsDown = false;

        // Bind component methods
        this.afterCreate = this.afterCreate.bind(this);
        this.afterCursorMove = this.afterCursorMove.bind(this);
        this.setupEvents = this.setupEvents.bind(this);
        this.setupResize = this.setupResize.bind(this);
        this.resize = this.resize.bind(this);
        this.tearDownEvents = this.tearDownEvents.bind(this);
        this.onSheetNeedsData = this.onSheetNeedsData.bind(this);
        this.copyToClipboard = this.copyToClipboard.bind(this);
        this.fetchClipboardData = this.fetchClipboardData.bind(this);

        // Bind component event handlers
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
    }

    componentDidLoad(){
        this.setupEvents();
        this.setupResize();
    }

    componentWillUnload(){
        this.tearDownEvents();
    }

    setupEvents(){
        let myElement = this.getDOMElement();
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

    /* I watch for size changes of the partent container and resize
     * the sheet accordingly.
     */
    setupResize(){
        this.container = this.getDOMElement().parentNode;
        const ro = new ResizeObserver(entries => {
            this.resize();
        });
        ro.observe(this.container.parentNode);
    }

    tearDownEvents(){
        // Not yet sure what to do here
    }

    build(){
        return h('ap-sheet', {
            id: this.getElementId(),
            class: 'cell sheet-cell',
            'data-cell-id': this.props.id,
            'data-cell-type': 'NewSheet',
            afterCreate: this.afterCreate,
            'locked-rows': this.props.numLockRows,
            'locked-columns': this.props.numLockColumns,
            'total-rows': this.props.totalRows,
            'total-columns': this.props.totalColumns,
            'onmousedown': this.onMouseDown,
            'onmouseup': this.onMouseUp,
            'onmousemove': this.onMouseMove,
            'onmouseleave': this.onMouseLeave,
            'onmouseenter': this.onMouseEnter
        }, []);
    }

    afterCreate(element){
        this._cachedNode = element;
        element.setAttribute('rows', 20);
        element.setAttribute('columns', 20);
        element.setAttribute('total-columns', this.props.totalColumns);
        element.setAttribute('total-rows', this.props.totalRows);
        element.setAttribute('locked-rows', this.props.numLockRows);
        element.setAttribute('locked-columns', this.props.numLockColumns);
        element.setAttribute('row-height', this.props.rowHeight);
        element.setAttribute('col-width', this.props.colWidth);
        element.addEventListener('sheet-needs-data', this.onSheetNeedsData);
    }

    /* I resize the sheet by counting the max number of rows and columns which
     * fit into the sheet parent container. I also account for the extra header
     * row which appears at the top.
     */
    resize(){
        let maxWidth = this.container.offsetWidth;
        let maxHeight = this.container.offsetHeight;
        // NOTE: we account for the header row
        let rowNumber = Math.min(
            this.props.totalRows,
            Math.ceil(maxHeight/(this.props.rowHeight * 1.05)) - 1
        );
        // make sure to return at least one row
        rowNumber = Math.max(1, rowNumber);
        let columnNumber = Math.min(this.props.totalColumns, Math.ceil(maxWidth/this.props.colWidth));
        let element = this.getDOMElement();
        element.setAttribute('rows', rowNumber);
        element.setAttribute('columns', columnNumber);
        element.afterChange();
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
        // I first check to make sure that we are not asking for too much data
        if (selectionFrame.area > this.maxCellsToClipboad){
            alert(`you can copy a maximum ${this.maxCellsToClipboad} cells`);
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
        let sheet = this.getDOMElement();
        let selectionFrame = sheet.selector.selectionFrame;
        let data = sheet.dataFrame.getDataArrayForFrame(selectionFrame)
        // generates a clipboard string from the current points
        // Note: in order to create line breaks we slice along the y-axis
        let clipboard = data.map(item => {return item.join("\t")}).join("\n");
        // console.log(clipboard);
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
        })
    }

    _updateData(dataInfo, projector){
        console.log('_updateData');
        console.log(dataInfo);
        let sheet = this.getDOMElement();

        dataInfo.forEach(data => {
            let frames = data.frames;
            frames.forEach(entry => {
                sheet.dataFrame.loadFromArray(
                    entry.data,
                    entry.origin
                );
            });
            if (data.action === "update"){
                sheet.primaryFrame.updateCellContents();
                this.afterCursorMove();
            } else if (data.action === "copy"){
                this.copyToClipboard();
            }
        });

    }

    /* Local Callbacks */

    afterCursorMove(){
        let sheet = this.getDOMElement();
        let coordinateHeader = sheet.querySelector('thead th:first-child');
        let contentHeader = sheet.querySelector('thead th:last-child');

        // Set the coordinate header element to display
        // the cursor's current data-relative coordinate
        let cursorX = sheet.selector.relativeCursor.x;
        let cursorY = sheet.selector.relativeCursor.y;
        let coordinateText = `(${cursorX},${cursorY})`;

        // Set some information to display in the
        // content header element.
        let contentHeaderText = `No selection`;
        if(!sheet.selector.selectionFrame.isEmpty){
            let frame = sheet.selector.selectionFrame;
            let originText = `(${frame.origin.x},${frame.origin.y})`.replace("Point","");
            let cornerText = `(${frame.corner.x},${frame.corner.y})`.replace("Point","");
            let boundsText = `Selection from ${originText} to ${cornerText}`;
            let sizeText = `(${frame.area} selected cells)`;
            contentHeaderText = `${boundsText} ${sizeText}`;
        }

        coordinateHeader.innerText = coordinateText;
        contentHeader.innerText = contentHeaderText;
    }

    /* Keyboard Event Handlers */

    onPageUp(event){
        event.target.selector.pageUp();
        this.afterCursorMove();
    }

    onSelectPageUp(event){
        event.target.selector.pageUp(true);
        this.afterCursorMove();
    }

    onPageRight(event){
        event.target.selector.pageRight();
        this.afterCursorMove();
    }

    onSelectPageRight(event){
        event.target.selector.pageRight(true);
        this.afterCursorMove();
    }

    onPageLeft(event){
        event.target.selector.pageLeft();
        this.afterCursorMove();
    }

    onSelectPageLeft(event){
        event.target.selector.pageLeft(true);
        this.afterCursorMove();
    }

    onPageDown(event){
        event.target.selector.pageDown();
        this.afterCursorMove();
    }

    onSelectPageDown(event){
        event.target.selector.pageDown(true);
        this.afterCursorMove();
    }

    onArrowUp(event){
        event.target.selector.moveUpBy(1);
        this.afterCursorMove();
    }

    onSelectArrowUp(event){
        event.target.selector.moveUpBy(1, true);
        this.afterCursorMove();
    }

    onArrowDown(event){
        event.target.selector.moveDownBy(1);
        this.afterCursorMove();
    }

    onSelectArrowDown(event){
        event.target.selector.moveDownBy(1, true);
        this.afterCursorMove();
    }

    onArrowLeft(event){
        event.target.selector.moveLeftBy(1);
        this.afterCursorMove();
    }

    onSelectArrowLeft(event){
        event.target.selector.moveLeftBy(1, true);
        this.afterCursorMove();
    }

    onArrowRight(event){
        event.target.selector.moveRightBy(1);
        this.afterCursorMove();
    }

    onSelectArrowRight(event){
        event.target.selector.moveRightBy(1, true);
        this.afterCursorMove();
    }

    onUpToTop(event){
        event.target.selector.moveToTopEnd();
        this.afterCursorMove();
    }

    onSelectUpToTop(event){
        event.target.selector.moveToTopEnd(true);
        this.afterCursorMove();
    }

    onDownToBottom(event){
        event.target.selector.moveToBottomEnd();
        this.afterCursorMove();
    }

    onSelectDownToBottom(event){
        event.target.selector.moveToBottomEnd(true);
        this.afterCursorMove();
    }

    onOverToRight(event){
        event.target.selector.moveToRightEnd();
        this.afterCursorMove();
    }

    onSelectOverToRight(event){
        event.target.selector.moveToRightEnd(true);
        this.afterCursorMove();
    }

    onOverToLeft(event){
        event.target.selector.moveToLeftEnd();
        this.afterCursorMove();
    }

    onSelectOverToLeft(event){
        event.target.selector.moveToLeftEnd(true);
        this.afterCursorMove();
    }

    /* Mouse Event Handlers */
    onMouseDown(event){
        let primaryButtonPushed = event.button == 0;
        if(event.target.tagName == "TD" && primaryButtonPushed){
            this._mouseIsDown = true;
            let sheet = this.getDOMElement();
            sheet.selector.setAnchorToElement(event.target);
            sheet.selector.setCursorToElement(event.target);
            sheet.selector.updateElements();
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

    onMouseMove(event, foo){
        if(this._mouseIsDown && event.target.tagName =="TD"){
            let sheet = this.getDOMElement();
            sheet.selector.setCursorToElement(event.target);
            sheet.selector.selectFromAnchorTo(
                sheet.selector.relativeCursor
            );
            sheet.selector.updateElements();
        }
    }
};

NewSheet.propTypes = {
    rowHeight: {
        description: "Height of the row in pixels.",
        type: PropTypes.oneOf([PropTypes.number])
    },
    colWidth: {
        description: "Width of the column (and cell) in pixels.",
        type: PropTypes.oneOf([PropTypes.number])
    },
    numLockRows: {
        description: "The number of initial (first) rows to lock in place.",
        type: PropTypes.oneOf([PropTypes.number])
    },
    numLockColumns: {
        description: "The number of initial (first) columns to lock in place.",
        type: PropTypes.oneOf([PropTypes.number])
    },
    totalRows: {
        description: "Total number of rows.",
        type: PropTypes.oneOf([PropTypes.number])
    },
    totalColumns: {
        description: "Total number of columns.",
        type: PropTypes.oneOf([PropTypes.number])
    },
    dontFetch: {
        description: "Don't fetch data after load; mostly used for testing.",
        type: PropTypes.oneOf([PropTypes.bool])
    }
};

export {
    NewSheet,
    NewSheet as default
};