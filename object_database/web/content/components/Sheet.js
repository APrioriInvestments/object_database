/*
 *
 * Sheet Cell Component
 * NOTE: This is in part a wrapper
 * for handsontables.
 */
import {h} from 'maquette';
import {Component} from './Component';
import {PropTypes} from './util/PropertyValidator';
import {
    Point,
    Frame,
    CompositeFrame,
    Selector,
    SelectionFrame,
    DataFrame
} from './util/SheetUtils';

/**
 * About Named Children
 * --------------------
 * `error` (single) - An error cell if present
 */

//TODO
//deal with ids properly in SheetRow and SheetCell
//

class Sheet extends Component {
    constructor(props, ...args){
        super(props, ...args);
        // props
        this.totalColumns = this.props.totalColumns;
        this.totalRows = this.props.totalRows;

        this.container = null;
        this.maxNumRows = null;
        this.maxNumColumns = null;
        this.requestIndex = 0;
        // helps keep track of each outgoing and incoming request
        // see useage in this.fetchData and this._updateData below
        this.fetchBlock = [];

        // frames
        this.compositeFrame = null;
        // active_frame defines the user's currently selected cells. It lives exclusively inside the viewFrame
        this.selector = new Selector(this);
        this.selector.onNeedsUpdate = this.handleSelectorUpdate.bind(this);
        // this is our core data frame, containing all table data values
        // NOTE: since we start at row 0 and column 0 we need to subtract 1 from the frame corner coords
        // TODO: we need some cleanup/garbage-collection of dataFrame
        this.dataFrame = new DataFrame([0, 0], [this.totalColumns - 1, this.totalRows - 1]);

        // Whether or not the user is currently 'selecting'
        // a region of the sheet
        this.isSelecting = false;

        // Bind context to methods
        this.initializeSheet  = this.initializeSheet.bind(this);
        this.resize = this.resize.bind(this);
        this.resizeCorner = this.resizeCorner.bind(this);
        this.resizeOrigin = this.resizeOrigin.bind(this);
        this._atDataBottom = this._atDataBottom.bind(this);
        this._atDataRight = this._atDataRight.bind(this);
        this._updatedDisplayValues = this._updatedDisplayValues.bind(this);
        this._updatedDisplayValues = this._updatedDisplayValues.bind(this);
        this.handleKeyDown = this.handleKeyDown.bind(this);
        this.handleMouseWheel = this.handleMouseWheel.bind(this);
        this.handleClick = this.handleClick.bind(this);
        this.handleTableMouseleave = this.handleTableMouseleave.bind(this);
        this.handleCellMousedown = this.handleCellMousedown.bind(this);
        this.handleCellMouseup = this.handleCellMouseup.bind(this);
        this.handleCellMouseover = this.handleCellMouseover.bind(this);
        this.handleSelectorUpdate = this.handleSelectorUpdate.bind(this);
        this.arrowUpDownLeftRight = this.arrowUpDownLeftRight.bind(this);
        this.pageUpDown = this.pageUpDown.bind(this);
        this.copyToClipboad = this.copyToClipboad.bind(this);
        this.onFocus = this.onFocus.bind(this);
        this.onBlur = this.onBlur.bind(this);
        this._updateHeader = this._updateHeader.bind(this);
        this._addLockedElements = this._addLockedElements.bind(this);
        this._removeLockedElements = this._removeLockedElements.bind(this);
        this._idToCoord = this._idToCoord.bind(this);
        this._coordToId = this._coordToId.bind(this);
        this._padFrame = this._padFrame.bind(this);
    }

    componentDidLoad(){
        console.log(`#componentDidLoad called for Sheet ${this.props.id}`);
        this.container = document.getElementById(this.props.id).parentNode;
        this.maxNumColumns = this._calcMaxNumColumns(this.container.offsetWidth);
        this.maxNumRows = this._calcMaxNumRows(this.container.offsetHeight);
        // new
        this.compositeFrame = new CompositeFrame(
            new Frame([0, 0], [this.maxNumColumns - 1, this.maxNumRows - 1], name="full"),
            []
        );
        if (this.props.numLockColumns && this.props.numLockRows){
            this.compositeFrame.overlayFrames = [
                {
                    frame: new Frame(
                        [this.props.numLockColumns, 0],
                        [this.maxNumColumns - 1, this.props.numLockRows - 1],
                        name="lockedRows"),
                    origin: new Point([this.props.numLockColumns, 0])
                },
                {
                    frame: new Frame(
                        [0, this.props.numLockRows],
                        [this.props.numLockColumns - 1, this.maxNumRows - 1],
                        name = "lockedColumns"),
                    origin: new Point([0, this.props.numLockRows])
                },
                {
                    frame: new Frame(
                        [0, 0], [this.props.numLockColumns - 1, this.props.numLockRows - 1],
                        name = "lockedIntersection"
                    ),
                    origin: new Point([0, 0])
                },
            ];
        } else if (this.props.numLockColumns){
            this.compositeFrame.overlayFrames = [
                {
                    frame: new Frame([0, 0], [this.props.numLockColumns - 1, this.maxNumRows - 1], name = "lockedColumns"),
                    origin: new Point([0, 0])
                }
            ];
        } else if (this.props.numLockRows){
            this.compositeFrame.overlayFrames = [
                {
                    frame: new Frame([0, 0], [this.maxNumColumns - 1, this.props.numLockRows - 1], name = "lockedRows"),
                    origin: new Point([0, 0])
                }
            ];
        }
        // add the data_view frame which is the main data display of sheet
        this.compositeFrame.overlayFrames.push(
            {
                frame: new Frame(
                    [this.props.numLockColumns, this.props.numLockRows],
                    [this.maxNumColumns - 1, this.maxNumRows - 1], name = "viewFrame"
                ),
                origin: new Point([this.props.numLockColumns, this.props.numLockRows])
            }
        );

        if (this.props.dontFetch != true){
            this.fetchData("replace");
        }
        //
        const ro = new ResizeObserver(entries => {
            this.resize();
            for (let entry of entries) {
                if (entry.target.firstElementChild && entry.target.firstElementChild.id  === this.props.id){
                }
                //entry.target.style.borderRadius = Math.max(0, 250 - entry.contentRect.width) + 'px';
            }
        });
        ro.observe(this.container.parentNode);
    }

    /* I resize the sheet by recalculating the number of columns and rows using the
     * current container size.
     */
    resize(){
        let body = document.getElementById(`sheet-${this.props.id}-body`);
        let maxNumColumns = this._calcMaxNumColumns(this.container.offsetWidth);
        let maxNumRows = this._calcMaxNumRows(this.container.offsetHeight);
        // first figure out how much we changed in size (wrt to rows/columns)
        // we'll use this to shift the appropriate frame corners
        let maxColumnsDiff = maxNumColumns - this.maxNumColumns;
        let maxRowsDiff = maxNumRows - this.maxNumRows;
        if (!maxColumnsDiff && !maxRowsDiff){
            return;
        }
        // now set the max column/row attributes
        this.maxNumColumns = maxNumColumns;
        this.maxNumRows = maxNumRows;
        // check whether we are at the bottom of the sheet and, hence, should grow the
        // origin
        if ((this._atDataBottom() && maxRowsDiff) || (this._atDataRight() && maxColumnsDiff)){
            this.resizeOrigin(maxRowsDiff, maxColumnsDiff);
        } else {
            this.resizeCorner(maxRowsDiff, maxColumnsDiff);
        }
        this.fetchData("replace");
    }

    _atDataBottom(){
        let viewFrame = this.compositeFrame.getOverlayFrame("viewFrame")["frame"];
        return viewFrame.corner.y === this.dataFrame.corner.y;
    }

    _atDataRight(){
        let viewFrame = this.compositeFrame.getOverlayFrame("viewFrame")["frame"];
        return viewFrame.corner.x === this.dataFrame.corner.x;
    }

    resizeCorner(numRows, numColumns){
        this.compositeFrame.baseFrame.corner.x += numColumns;
        this.compositeFrame.baseFrame.corner.y += numRows;
        this.compositeFrame.overlayFrames.forEach(frm => {
            let frame = frm["frame"];
            if (frame.name === "viewFrame"){
                frame.corner.x += numColumns;
                frame.corner.y += numRows;
            } else if (frame.name === "lockedColumns"){
                frame.corner.y += numRows;
            } else if (frame.name === "lockedRows"){
                frame.corner.x += numColumns;
            }
        });
    }

    resizeOrigin(numRows, numColumns){
        this.compositeFrame.baseFrame.corner.x += numColumns;
        this.compositeFrame.baseFrame.corner.y += numRows;
        this.compositeFrame.overlayFrames.forEach(frm => {
            let frame = frm["frame"];
            if (frame.name === "viewFrame"){
                frame.origin.x -= numColumns;
                frame.origin.y -= numRows;
            } else if (frame.name === "lockedColumns"){
                frame.origin.y -= numRows;
            } else if (frame.name === "lockedRows"){
                frame.origin.x -= numColumns;
            }
        });
    }

    /* I initialize the sheet from coordintate [0, 0] to [corner.x, corner.y] (corner isinstanceof Point)
     * generating 'td' elements with id = this.props.id_x_y
     */
    initializeSheet(projector, body, head){
        // make sure the header spans the entire width
        let headerCurrent = head.querySelector(`#sheet-${this.props.id}-head-current`);
        headerCurrent.colSpan = this.maxNumColumns - 1;
        let headerInfo = head.querySelector(`#sheet-${this.props.id}-head-info`);
        headerInfo.colSpan = 1;
        headerInfo.textContent = `${this.totalColumns}x${this.totalRows}`;

        let rows = [];
        let origin = this.compositeFrame.baseFrame.origin;
        let corner = this.compositeFrame.baseFrame.corner;
        for (let y = origin.y; y <= corner.y; y++){
            var rowData = [];
            for (let x = origin.x; x <= corner.x; x++){
                // even if on initialization we get values from the dataFrame; this sets up our general
                // flow but also allows for dataFrame to be populated with default or cached values
                rowData.push({id: this._coordToId("td", [x, y]), value: this.dataFrame.get([x, y])});
            }
            rows.push(
                new SheetRow(
                    {
                        id: `tr_${this.props.id}_${y}`,
                        rowData: rowData,
                        colWidth: this.props.colWidth,
                        height: this.props.rowHeight
                    }
                ).build()
            );
        }
        while(body.firstChild){
            body.firstChild.remove();
        }
        rows.map((r) => {
            projector.append(body, () => {return r;});
        });
        // style the locked column elements
        // Note: even though it is not strictly necessary we project each of the locked frames onto
        // the baseFrame, i.e. the fixed view frame. This setups up the general pattern
        this.compositeFrame.overlayFrames.map(frm => {
            let name = frm["frame"].name;
            if (name.startsWith("locked")){
                let frame = this.compositeFrame.project(name);
                this._addLockedElements(body, frame);
            }
        });
    }

    build(){
        console.log(`Rendering custom sheet ${this.props.id}`);
        let rows = ["Just a sec..."];
        let header = [
            h("tr", {style: `height: ${this.props.rowHeight}px`}, [
                h("th", {id: `sheet-${this.props.id}-head-current`}, []),
                h("th", {id: `sheet-${this.props.id}-head-info`, class: "header-info"}, [])
            ])
        ];
        return (
            h("div", {
                id: this.props.id,
                "data-cell-id": this.props.id,
                "data-cell-type": "Sheet",
                class: "cell sheet-wrapper",
                afterCreate: this.afterCreate
            }, [
                h("table", {
                    class: "sheet",
                    style: "table-layout:fixed",
                    tabindex: "-1",
                    onfocus: this.onFocus,
                    onblur: this.onBlur,
                    onkeydown: this.handleKeyDown,
                    onclick: this.handleClick,
                    onmouseover: this.handleCellMouseover,
                    onmousedown: this.handleCellMousedown,
                    onmouseup: this.handleCellMouseup,
                    onmouseleave: this.handleTableMouseleave
                }, [
                    h("thead", {id: `sheet-${this.props.id}-head`}, header),
                    h("tbody", {id: `sheet-${this.props.id}-body`}, rows)
                ])
            ])
        );
    }

    /* I listen for arrow keys and paginate if necessary. */
    handleKeyDown(event){
        let body = document.getElementById(`sheet-${this.props.id}-body`);
        let head = document.getElementById(`sheet-${this.props.id}-head`);
        // console.log(event.key + event.altKey);
        if (["PageUp", "PageDown"].indexOf(event.key) > -1){
            this.pageUpDown(body, event);
            // display the contents in the top header line
            this._updateHeader(body, head);
        } else if(["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"].indexOf(event.key) > -1) {
            this.arrowUpDownLeftRight(body, event);
            // display the contents in the top header line
            this._updateHeader(body, head);
        } else if(event.key === "c"){
            if(event.ctrlKey){
                this.copyToClipboad();
            }
        }
    }

    /* I listen for the mousewheel and scroll up/down. */
    handleMouseWheel(event){
        let body = document.getElementById(`sheet-${this.props.id}-body`);
        if (this.selector){
            let shrinkToCursor = !event.altKey;
            if (event.deltaY < 0){
                if(event.shiftKey){
                    this.selector.clearStyling();
                    this.selector.growUp();
                    this.selector.addStyling();
                } else {
                    this.selector.cursorUp(shrinkToCursor);
                }
            } else if (event.deltaY > 0){
                if(event.shiftKey){
                    this.selector.clearStyling();
                    this.selector.growDown();
                    this.selector.addStyling();
                } else {
                    this.selector.cursorDown(shrinkToCursor);
                }
            }
        }
    }

    /* I copy the current this.selector cell values to the clipboard. */
    copyToClipboad(){
        let size = this.selector.selectionFrame.size;
        if ((size.x + 1) * (size.y + 1) > 1000000){
            alert("copy is limited to 1,000,000 cells");
        } else {
            // NOTE: we need to first fetch the data which means send a
            // WS data request with action==="clipboardData" so that the data
            // arrives before we copy the elements to the clipboard.
            // event.preventDefault();
            // event.stopPropagation();
            // event.clipboardData.clearData();
            // let txt = this.selector.getSelectionClipboard();
            // event.clipboardData.setData('text/plain', txt);
            // console.log("fetching clipboard data");
            this.selector.fetchData();
        }
    }

    /* I add the copy event listener, when the current sheet is in focus. */
    onFocus(event){
        // document.addEventListener('copy', this.copyToClipboad)
        document.addEventListener('mousewheel', this.handleMouseWheel)
    };


    /* I remove the copy event listener, when the current sheet is out of focus. */
    onBlur(event){
        // document.removeEventListener('copy', this.copyToClipboad);
        document.removeEventListener('mousewheel', this.handleMouseWheel)
    }

    /* I handle page Up/Down of the view */
    pageUpDown(body, event){
        event.preventDefault();
        let translation = new Point([0, 0]);
        let viewOverlay = this.compositeFrame.getOverlayFrame("viewFrame");
        let viewFrame = viewOverlay["frame"];
        let viewOrigin = viewOverlay["origin"];
        if (event.altKey){
            // offset by fixed rows/columns
            if (event.key === "PageDown"){
                // make sure we don't run out of data at the right of the page
                translation.x = Math.min(this.dataFrame.corner.x - viewFrame.corner.x, viewFrame.size.x);
                if(event.shiftKey){
                    this.selector.pageRight(translation.x);
                }
            } else if (event.key === "PageUp") {
                // make sure we don't run out of data at the left
                translation.x = -1 * Math.min(viewFrame.origin.x - viewOrigin.x, viewFrame.size.x);
                if(event.shiftKey){
                    this.selector.pageLeft(-1 * translation.x);
                }
            }
        } else {
            // offset by fixed rows/columns
            if (event.key === "PageDown"){
                // make sure we don't run out of data at the bottom of the page
                translation.y = Math.min(this.dataFrame.corner.y - viewFrame.corner.y, viewFrame.size.y);
                if(event.shiftKey){
                    this.selector.pageDown(translation.y);
                }
            } else if (event.key === "PageUp"){
                // make sure we don't run out of data at the top
                translation.y = -1 * Math.min(viewFrame.origin.y - viewOrigin.y, viewFrame.size.y);
                if(event.shiftKey){
                    this.selector.pageUp(-1 * translation.y);
                }
            }
        }

        // If there is a current selection, translate it and
        // shrink it to the cursor unless the navigation is
        // combined with selector expansion.
        if (!event.shiftKey){
            // if the cursor is out of view we translate the view to the cursor
            // and do nothing else!
            if (this.fetchBlock.length === 0 && !this.selector.cursorInView() && !this.selector.cursorInLockedArea()){
                this.selector.shiftViewToCursor();
                return;
            }
            this.selector.selectionFrame.translate(translation);
            this.selector.shrinkToCursor();
        }
        this.selector.clearStyling();
        this.compositeFrame.translate(translation, "viewFrame");
        this.compositeFrame.translate([translation.x, 0], "lockedRows");
        this.compositeFrame.translate([0, translation.y], "lockedColumns");
        this.fetchData("update");

        console.log("selector frame");
        console.log(`origin: (${this.selector.selectionFrame.origin.x}, ${this.selector.selectionFrame.origin.y})`);
        console.log(`corner: (${this.selector.selectionFrame.corner.x}, ${this.selector.selectionFrame.corner.y})`);
        console.log(`cursor: (${this.selector.selectionFrame.cursor.x}, ${this.selector.selectionFrame.cursor.y})`);
    }

    /* I handle arrow triggered navigation of the active_frame and related views */
    arrowUpDownLeftRight(body, event){
        event.preventDefault();
        let translation = new Point([0, 0]);
        let viewOverlay = this.compositeFrame.getOverlayFrame("viewFrame");
        let viewFrame = viewOverlay["frame"];
        let viewOrigin = viewOverlay["origin"];
        if (event.ctrlKey){
            // This is sheet level navigation
            // Go to top of the sheet
            if (event.key === "ArrowUp"){
                translation.y = viewOrigin.y - viewFrame.origin.y;
                this.compositeFrame.translate(translation, "lockedColumns");
                if(event.shiftKey){

                    this.selector.clearStyling();

                    this.selector.growToTop();
                } else {
                    // Ensure that cursor moves to the
                    // top of the current view frame
                    this.selector.cursorTo(new Point([
                        this.selector.selectionFrame.cursor.x,
                        0
                        // viewOrigin.y
                    ]));
                }
            // Go to bottom of the sheet
            } else if (event.key === "ArrowDown"){
                translation.y = this.dataFrame.corner.y - viewFrame.corner.y;
                this.compositeFrame.translate(translation, "lockedColumns");
                if(event.shiftKey){

                    this.selector.clearStyling();

                    this.selector.growToBottom();
                 } else {
                    // Ensure that the cursor moves to the
                    // bottom of the current view frame
                    this.selector.cursorTo(new Point([
                        this.selector.selectionFrame.cursor.x,
                        this.dataFrame.corner.y,
                    ]));
                 }
            // Go to the right of the sheet
            } else if (event.key === "ArrowRight"){
                translation.x = this.dataFrame.corner.x - viewFrame.corner.x;
                this.compositeFrame.translate(translation, "lockedRows");
                if(event.shiftKey){
                    this.selector.clearStyling();
                    this.selector.growToRight();
                } else {
                    // Ensure that the cursor moves to the
                    // right side of the current view frame
                    this.selector.cursorTo(new Point([
                        this.dataFrame.corner.x,
                        this.selector.selectionFrame.cursor.y
                    ]));
                }
            // Go to the left of the sheet
            } else if (event.key === "ArrowLeft"){
                translation.x = viewOrigin.x - viewFrame.origin.x;
                this.compositeFrame.translate(translation, "lockedRows");
                if(event.shiftKey){
                    this.selector.clearStyling();
                    this.selector.growToLeft();
                } else {
                    // Ensure that the cursor moves to the
                    // left side of the current view frame
                    this.selector.cursorTo(new Point([
                        //viewOrigin.x,
                        0,
                        this.selector.selectionFrame.cursor.y
                    ]));
                }
            }
            this.compositeFrame.translate(translation, "viewFrame");
            this.fetchData("update");
        } else if (this.selector){
            let shrinkToCursor = !event.altKey;
            if (event.key === "ArrowUp"){
                event.preventDefault();
                if(event.shiftKey){
                    this.selector.clearStyling();
                    this.selector.growUp();
                } else {
                    this.selector.cursorUp(shrinkToCursor);
                }
            } else if (event.key === "ArrowDown"){
                event.preventDefault();
                if(event.shiftKey){
                    this.selector.clearStyling();
                    this.selector.growDown();
                } else {
                    this.selector.cursorDown(shrinkToCursor);
                }
            } else if (event.key === "ArrowLeft"){
                event.preventDefault();
                if(event.shiftKey){
                    this.selector.clearStyling();
                    this.selector.growLeft();
                } else {
                    this.selector.cursorLeft(shrinkToCursor);
                }
            } else if (event.key === "ArrowRight"){
                event.preventDefault();
                if(event.shiftKey){
                    this.selector.clearStyling();
                    this.selector.growRight();
                } else {
                    this.selector.cursorRight(shrinkToCursor);
                }
            }
            this.selector.addStyling();
        }
    }

    handleSelectorUpdate(direction, amount){
        console.log('onNeedsUpdate:');
        console.log(direction);
        // we need translation to be an instance of Point
        let translation = new Point([0, 0]);
        let viewOverlay = this.compositeFrame.getOverlayFrame("viewFrame");
        let viewFrame = viewOverlay["frame"];
        let viewOrigin = viewOverlay["origin"];
        if (direction === "up"){
            translation.y = -1 * Math.min(viewFrame.origin.y - viewOrigin.y, amount);
            this.compositeFrame.translate(translation, "lockedColumns");
            this.compositeFrame.translate(translation, "viewFrame");
            this.fetchData("update");
        } else if (direction === "down"){
            translation.y = Math.min(this.dataFrame.corner.y - viewFrame.corner.y, amount);
            this.compositeFrame.translate(translation, "lockedColumns");
            this.compositeFrame.translate(translation, "viewFrame");
            this.fetchData("update");
        } else if (direction === "left"){
            translation.x = -1 * Math.min(viewFrame.origin.x - viewOrigin.x, amount);
            this.compositeFrame.translate(translation, "lockedRows");
            this.compositeFrame.translate(translation, "viewFrame");
            this.fetchData("update");
        } else if (direction === "right") {
            translation.x = Math.min(this.dataFrame.corner.x - viewFrame.corner.x, amount);
            this.compositeFrame.translate(translation, "lockedRows");
            this.compositeFrame.translate(translation, "viewFrame");
            this.fetchData("update");
        }
    }

    handleCellMouseup(event){
        this.isSelecting = false;
    }

    handleCellMousedown(event){
        if(event.target.nodeName !== "TD"){
            return;
        }
        this.isSelecting = true;
        // let targetCoord = this._idToCoord(event.target.id);
        let targetCoord = [parseInt(event.target.dataset.x), parseInt(event.target.dataset.y)];
        this.selector.cursorTo(targetCoord);
    }

    handleCellMouseover(event){
        if(event.target.nodeName !== "TD"){
            return;
        }
        // Here is where we update the selection
        // information.
        if(this.isSelecting){
            let targetCoord = [parseInt(event.target.dataset.x), parseInt(event.target.dataset.y)];
			this.selector.clearStyling();
            this.selector.selectionFrame.fromPointToPoint(
                this.selector.selectionFrame.cursor,
                targetCoord
            );
			this.selector.addStyling();
        }
    }

    /* I listen for clicks and and set up this.active_frame as necessary.*/
    handleClick(event){
        let body = document.getElementById(`sheet-${this.props.id}-body`);
        let head = document.getElementById(`sheet-${this.props.id}-head`);
        let target = event.target;
        // if the user accidentally clicked on the tooltip or something else, don't do anything
        if (target.nodeName !== "TD"){
            return;
        }

        // display the contents in the top header line
        this._updateHeader(body, head);
    }

    /* I handle updates to the display header */
    _updateHeader(body, head){
        let cursor = this.selector.selectionFrame.cursor;
        let th = head.querySelector(`#sheet-${this.props.id}-head-current`);
        let content = this.dataFrame.get(cursor);
        let coordinates = `(${cursor.x}x${cursor.y}): `;
        let fontSize = '.8rem';
        if (th.colSpan < 2){
            if (content === undefined){
                content = "undefined";
            }
            let computedFontSize = parseFloat(window.getComputedStyle(th).getPropertyValue("font-size"));
            let contentLength = content.length + coordinates.length;
            if (computedFontSize * contentLength > (this.props.colWidth - 5)){
                fontSize = `${2 * (this.props.colWidth)/(contentLength)}px`;
            }
        }
        th.style.fontSize = fontSize;
        th.textContent = `${coordinates}${content}`;
    }

    /* Simply resets the `isSelecting` to false, in the
     * event that the user clicked and dragged out of the
     * element
     */
    handleTableMouseleave(event){
        this.isSelecting = false;
    }

    /* I covert a string of the form `nodeName_id_x_y` to [x, y] */
    _idToCoord(s){
        let splitList = s.split("_");
        try {
            return [parseInt(splitList[2]), parseInt(splitList[3])];
        } catch(e) {
            throw "unable to covert id " + s + " to coordinate, with error: " + e;
        }
    }

    /* I take all coordinates in provided frame and style the corresponding 'td' DOM
     * elements with a "locked" css class.
     */
    _addLockedElements(body, frame){
        frame.coords.map((p) => {
            let td = body.querySelector(`#${this._coordToId("td", [p.x, p.y])}`);
            td.className += " locked";
        });
    }

    /* I take all coordinates in provided frame and style the corresponding 'td' DOM
     * elements with a "locked" css class.
     */
    _removeLockedElements(body, frame){
        frame.coords.map((p) => {
            let td = body.querySelector(`#${this._coordToId("td", [p.x, p.y])}`);
            td.className += td.className.replace(" locked", "");
        });
    }

    /* I covert a coord [x, y] array to a string of the form `nodeName_id_x_y`*/
    _coordToId(nodeName, xy){
        return `${nodeName}_${this.props.id}_${xy[0]}_${xy[1]}`;
    }

    /* I make WS requests to the server */
    fetchData(action){
        // we ask for a bit more data than we need for the view to prevent flickering
        // frame = this._padFrame(frame, new Point([2, 2]));
        // We don't want to replace for every overlayFrame, so in the case that the action
        // = `replace` we keep a counter and flip action to `update` after the first call.
        this.fetchBlock = [];
        let replaceCounter = 0;
        this.compositeFrame.overlayFrames.forEach(frm  => {
            this.requestIndex += 1;
            // add the requestIndex to this.fetchBlock
            this.fetchBlock.push(this.requestIndex);
            if (replaceCounter){
                action = "update";
            }
            let frame = frm["frame"];
            let request = JSON.stringify({
                event: "sheet_needs_data",
                request_index: this.requestIndex,
                target_cell: this.props.id,
                frame: {
                    origin: {x: frame.origin.x, y: frame.origin.y},
                    corner: {x: frame.corner.x, y: frame.corner.y},
                    name: frame.name
                },
                action: action,
            });
            cellSocket.sendString(request);
            if (action === "replace"){
                replaceCounter += 1;
            }
        });
    }

    /* I take a frame and return a new frame with the orign and corner offset by the
     * padding Point. I take into account whether the frame.origin and frame.corner don't
     * exceed alloted data dimensions
     */
    _padFrame(frame, padding){
        let origin = frame.origin;
        let corner = frame.corner;
        if (origin.x > padding.x){
            origin.x -= padding.x;
        }
        if (origin.y > padding.y){
            origin.y -= padding.y;
        }
        if (corner.x < this.totalColumns - padding.x){
            corner.x += padding.x;
        }
        if (corner.y < this.totalRows - padding.y){
            corner.y += padding.y;
        }
        return new Frame(origin, corner);
    }

    /* I handle data updating for the Sheet. I need to know whether
     * this is a `replace` or a `row` or `column` type of update.
     * If it is `row` or `column` I need to know the direction `prepend`
     * or `append`.
     */
    _updateData(dataInfos, projector) {
        dataInfos.map((dataInfo) => {
            console.log("updating data for sheet: " + this.props.id + " with response id " + dataInfo.response_id);
            // make sure the data is not empty
            let body = document.getElementById(`sheet-${this.props.id}-body`);
            let head = document.getElementById(`sheet-${this.props.id}-head`);
            if (dataInfo.data && dataInfo.data.length){
                if (dataInfo.action === "clipboardData"){
                    this.selector.getSelectionClipboard(dataInfo.data);
                } else {
                    if (dataInfo.action === "replace") {
                        // we update the Sheet with (potentially empty) values
                        // creating 'td' elements with ids corresponding to the frame coordinates (and the sheet id);
                        // this will set up our updateData flow which continually retrieves values from dataFrame regadless
                        // if the server has returned the request
                        // NOTE: we use frame origin and corner as much as possible, utilizing properties of Point and avoiding
                        // potential confusion of axes vs columns/rows
                        // TODO: this.initializeSheet should be under componentDidUpdate() but for that the Sheet needs
                        // to have access to the projector
                        // then we can remove the `action` arg to fetch
                        this.initializeSheet(projector, body, head);
                    }
                    // load the data into the data with the provided origin
                    let origin = dataInfo.origin;
                    this.dataFrame.load(dataInfo.data, [origin.x, origin.y]);
                    // clean the sheet to make sure no residual data values left
                    this._updatedDisplayValues(body);
                    this.selector.clearStyling();
                    this.selector.addStyling();

                    // display the contents in the top header line
                    this._updateHeader(body, head);

                    // remove the id from this.fetchBlock
                    let index = this.fetchBlock.indexOf(dataInfo.response_id);
                    if (index > -1){
                        this.fetchBlock.splice(index, 1);
                    }
                }
            }
        });
    }

    /* Update data helpers */
    /* I update the values displayed in the sheet */
    _updatedDisplayValues(body, clean=false){
        if (clean){
            this.compositeFrame.baseFrame.coords.forEach(c => {
                let td = body.querySelector(`#${this._coordToId("td", [c.x, c.y])}`);
                td.textContent = undefined;
                td.dataset.x = c.x;
                td.dataset.y = c.y;
            });
        } else {
            this.compositeFrame.overlayFrames.forEach(frm => {
                let frame = frm["frame"];
                let projectedFrame = this.compositeFrame.project(frame.name);
                let frameCoords = frame.coords;
                let projectedFrameCoords = projectedFrame.coords;
                for (let i = 0; i < frameCoords.length; i++){
                    let dataCoord = frameCoords[i];
                    let displayCoord = projectedFrameCoords[i];
                    let td = body.querySelector(`#${this._coordToId("td", [displayCoord.x, displayCoord.y])}`);
                    td.textContent = this.dataFrame.get(dataCoord);
                    td.dataset.x = dataCoord.x;
                    td.dataset.y = dataCoord.y;
                }
            });
        }
    }

    /* Helper functions to determine a 'reasonable' number of columns and rows
     * for the current view. For the moment we use window.innerHeight and
     * window.innerWidth divided by the number provided height and width of the
     * rows, columns, respecitively and then add a bit more for lazy loading.
     */
    _calcMaxNumRows(maxHeight){
        // NOTE: we account for the header row
        let rowNum = Math.min(this.totalRows, Math.ceil(maxHeight/(this.props.rowHeight * 1.05)) - 1);
        // make sure to return at least one row
        return Math.max(1, rowNum);
    }

    _calcMaxNumColumns(maxWidth){
        return Math.min(this.totalColumns, Math.ceil(maxWidth/this.props.colWidth));
    }
}

Sheet.propTypes = {
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
    },
};

class SheetRow extends Component {
    constructor(props, ...args){
        super(props, ...args);
        this.style = `max-height: ${this.props.height}px; height: ${this.props.height}px`;

        // Bind component methods
    }

    componentDidLoad(){
    }

    build(){
        var rowData = this.props.rowData.map((item) => {
            return new SheetCell({
                id: item.id,
                value: item.value,
                width: this.props.colWidth,
            }).build();
        });
        return (
            h("tr",
                {id: this.props.id, class: "sheet-row", style: this.style},
                rowData
            )
        );
    }
}

SheetRow.propTypes = {
    height: {
        description: "Height of the row in pixels.",
        type: PropTypes.oneOf([PropTypes.number])
    },
    rowData: {
        description: "Row data array.",
        type: PropTypes.oneOf([PropTypes.object])
    },
    colWidth: {
        description: "Width of the column (and cell) in pixels.",
        type: PropTypes.oneOf([PropTypes.number])
    }
};

class SheetCell extends Component {
    constructor(props, ...args){
        super(props, ...args);
        this.style = `max-width: ${this.props.width}px; width: ${this.props.width}px`;
        this.class = "sheet-cell custom-tooltip";
        if (this.props.value){
            this.value = this.props.value.toString();
        } else {
            this.value = undefined;
        }
    }

    componentDidLoad(){
    }

    build(){
        // we don't show a tooltip span element if there is nothing to show
        let child = [h("span", {}, [this.value])];
        child.push(h("span", {class: "tooltiptext"}, ["TOOLTIP"]));
        return (
            h("td",
                {
                    id: this.props.id,
                    class: this.class,
                    style: this.style
                },
                // child
                [this.value]
            )
        );
    }
}

SheetCell.propTypes = {
    value: {
        description: "Text to display",
        type: PropTypes.oneOf([ PropTypes.string])
    },
    x: {
        description: "X coordinate",
        type: PropTypes.oneOf([ PropTypes.number])
    },
    y: {
        description: "Y coordinate",
        type: PropTypes.oneOf([ PropTypes.number])
    },
    width: {
        description: "Width of the cell in pixels.",
        type: PropTypes.oneOf([PropTypes.number])
    },
};

export {Sheet, Sheet as default};
