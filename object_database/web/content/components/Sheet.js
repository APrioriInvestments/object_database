''/*
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

        // offset is used as a buffer for lazy loading, i.e. we have this many extra
        // columns/rows
        this.max_num_rows = null;
        this.max_num_columns = null;
        this.requestIndex = 0;

        // frames
        this.composite_frame = null;
        // active_frame defines the user's currently selected cells. It lives exclusively inside the view_frame
        this.selector = new Selector(this);
        this.selector.onNeedsUpdate = this.handleSelectorUpdate.bind(this);
        // this is our core data frame, containing all table data values
        // NOTE: since we start at row 0 and column 0 we need to subtract 1 from the frame corner coords
        // TODO: we need some cleanup/garbage-collection of data_frame
        this.data_frame = new DataFrame([0, 0], [this.totalColumns - 1, this.totalRows - 1]);

        // Whether or not the user is currently 'selecting'
        // a region of the sheet
        this.is_selecting = false;

        // Bind context to methods
        this.initializeSheet  = this.initializeSheet.bind(this);
        this.resize = this.resize.bind(this);
        this._updatedDisplayValues = this._updatedDisplayValues.bind(this);
        this._updatedDisplayValues = this._updatedDisplayValues.bind(this);
        this.handleKeyDown = this.handleKeyDown.bind(this);
        this.handleClick = this.handleClick.bind(this);
        this.handleTableMouseleave = this.handleTableMouseleave.bind(this);
        this.handleCellMousedown = this.handleCellMousedown.bind(this);
        this.handleCellMouseup = this.handleCellMouseup.bind(this);
        this.handleCellMouseover = this.handleCellMouseover.bind(this);
        this.handleSelectorUpdate = this.handleSelectorUpdate.bind(this);
        this.arrowUpDownLeftRight = this.arrowUpDownLeftRight.bind(this);
        this.pageUpDown = this.pageUpDown.bind(this);
        this.copyToClipboad = this.copyToClipboad.bind(this);
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
        this.max_num_columns = this._calc_max_num_columns(this.container.offsetWidth);
        this.max_num_rows = this._calc_max_num_rows(this.container.offsetHeight);
        // new
        this.composite_frame = new CompositeFrame(
            new Frame([0, 0], [this.max_num_columns - 1, this.max_num_rows - 1], name="full"),
            []
        )
        if (this.props.numLockColumns && this.props.numLockRows){
            this.composite_frame.overlayFrames = [
                {
                    frame: new Frame(
                        [this.props.numLockColumns, 0],
                        [this.max_num_columns - 1, this.props.numLockRows - 1],
                        name="locked_rows"),
                    origin: new Point([this.props.numLockColumns, 0])
                },
                {
                    frame: new Frame(
                        [0, this.props.numLockRows],
                        [this.props.numLockColumns - 1, this.max_num_rows - 1],
                        name = "locked_columns"),
                    origin: new Point([0, this.props.numLockRows])
                },
                {
                    frame: new Frame(
                        [0, 0], [this.props.numLockColumns - 1, this.props.numLockRows - 1],
                        name = "locked_intersection"
                    ),
                    origin: new Point([0, 0])
                },
            ];
        } else if (this.props.numLockColumns){
            this.composite_frame.overlayFrames = [
                {
                    frame: new Frame([0, 0], [this.props.numLockColumns - 1, this.max_num_rows - 1], name = "locked_columns"),
                    origin: new Point([0, 0])
                }
            ];
        } else if (this.props.numLockRows){
            this.composite_frame.overlayFrames = [
                {
                    frame: new Frame([0, 0], [this.max_num_columns - 1, this.props.numLockRows - 1], name = "locked_rows"),
                    origin: new Point([0, 0])
                }
            ];
        }
        // add the data_view frame which is the main data display of sheet
        this.composite_frame.overlayFrames.push(
            {
                frame: new Frame(
                    [this.props.numLockColumns, this.props.numLockRows],
                    [this.max_num_columns - 1, this.max_num_rows - 1], name = "view_frame"
                ),
                origin: new Point([this.props.numLockColumns, this.props.numLockRows])
            }
        );

        if (this.props.dontFetch != true){
            this.fetchData("replace",);
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
        // window.addEventListener('resize', this.componentDidLoad);
        document.addEventListener('copy', event => this.copyToClipboad(event));
    }

    /* I resize the sheet by recalculating the number of columns and rows using the
     * current container size.
     */
    resize(){
        // TODO eventually pass this as an argument or set as an attrubute on the class
        let body = document.getElementById(`sheet-${this.props.id}-body`);
        let max_num_columns = this._calc_max_num_columns(this.container.offsetWidth);
        let max_num_rows = this._calc_max_num_rows(this.container.offsetHeight);
        // first figure out how much we changed in size (wrt to rows/columns)
        // we'll use this to shift the appropriate frame corners
        let max_columns_diff = max_num_columns - this.max_num_columns;
        let max_rows_diff = max_num_rows - this.max_num_rows;
        if (!max_columns_diff && !max_rows_diff){
            return;
        }
        // now set the max column/row attributes
        /*
        this.max_num_columns = max_num_columns;
        this.max_num_rows = max_num_rows;
        this.fixed_view_frame.setCorner = [this.max_num_columns - 1, this.max_num_rows - 1];
        this.view_frame.corner.x += max_columns_diff;
        this.view_frame.corner.y += max_rows_diff;
        this.fetchData(
            this.view_frame,
            "replace",
        );
        */
    }

    /* I initialize the sheet from coordintate [0, 0] to [corner.x, corner.y] (corner isinstanceof Point)
     * generating 'td' elements with id = this.props.id_x_y
     */
    initializeSheet(projector, body, head){
        // make sure the header spans the entire width
        let header_current = head.querySelector(`#sheet-${this.props.id}-head-current`);
        header_current.colSpan = this.max_num_columns - 1;
        let header_info = head.querySelector(`#sheet-${this.props.id}-head-info`);
        header_info.colSpan = 1;
        header_info.textContent = `${this.totalColumns}x${this.totalRows}`;

        let rows = [];
        let origin = this.composite_frame.baseFrame.origin;
        let corner = this.composite_frame.baseFrame.corner;
        for (let y = origin.y; y <= corner.y; y++){
            var row_data = [];
            for (let x = origin.x; x <= corner.x; x++){
                // even if on initialization we get values from the data_frame; this sets up our general
                // flow but also allows for data_frame to be populated with default or cached values
                row_data.push({id: this._coordToId("td", [x, y]), value: this.data_frame.get([x, y])});
            }
            rows.push(
                new SheetRow(
                    {
                        id: `tr_${this.props.id}_${y}`,
                        row_data: row_data,
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
        this.composite_frame.overlayFrames.map(frm => {
            let name = frm["frame"].name;
            if (name.startsWith("locked")){
                let frame = this.composite_frame.project(name);
                this._addLockedElements(body, frame);
            }
        });
        console.log(this.composite_frame);
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
        // TODO eventually pass this as an argument or set as an attrubute on the class
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
        }
    }

    /* I copy the current this.selector cell values to the clipboard. */
    copyToClipboad(){
        let txt = this.selector.getSelectionClipboard();
        event.clipboardData.setData('text/plain', txt);
        event.preventDefault();
        event.stopPropagation();
    }

    /* I handle page Up/Down of the view */
    pageUpDown(body, event){
        event.preventDefault();
        let translation = new Point([0, 0]);
        let view_overlay = this.composite_frame.getOverlayFrame("view_frame");
        let view_frame = view_overlay["frame"];
        let view_origin = view_overlay["origin"];
        if (event.altKey){
            // offset by fixed rows/columns
            if (event.key === "PageDown"){
                // make sure we don't run out of data at the right of the page
                translation.x = Math.min(this.data_frame.corner.x - view_frame.corner.x, view_frame.size.x);
            } else if (event.key === "PageUp") {
                // make sure we don't run out of data at the left
                translation.x = -1 * Math.min(view_frame.origin.x - view_origin.x, view_frame.size.x);
            }
            this.composite_frame.translate(translation, "locked_rows");
        } else {
            // offset by fixed rows/columns
            if (event.key === "PageDown"){
                // make sure we don't run out of data at the bottom of the page
                translation.y = Math.min(this.data_frame.corner.y - view_frame.corner.y, view_frame.size.y);
            } else if (event.key === "PageUp"){
                // make sure we don't run out of data at the top
                translation.y = -1 * Math.min(view_frame.origin.y - view_origin.y, view_frame.size.y);
            }
            this.composite_frame.translate(translation, "locked_columns");
        }

        // If there is a current selection,
        // shrink it to the cursor.
        this.selector.clearStyling();
        this.selector.shrinkToCursor();

        this.composite_frame.translate(translation, "view_frame");
        this.fetchData("update");
    }

    /* I handle arrow triggered navigation of the active_frame and related views */
    arrowUpDownLeftRight(body, event){
        event.preventDefault();
        let translation = new Point([0, 0]);
        let view_overlay = this.composite_frame.getOverlayFrame("view_frame");
        let view_frame = view_overlay["frame"];
        let view_origin = view_overlay["origin"];
        if (event.ctrlKey){
            // This is sheet level navigation
            // Go to top of the sheet
            if (event.key === "ArrowUp"){
                translation.y = view_origin.y - view_frame.origin.y;
                this.composite_frame.translate(translation, "locked_columns");
                // Ensure that cursor moves to the
                // top of the current view frame
                this.selector.cursorTo(new Point([
                    this.selector.selectionFrame.cursor.x,
                    view_origin.y
                ]));
            // Go to bottom of the sheet
            } else if (event.key === "ArrowDown"){
                translation.y = this.data_frame.corner.y - view_frame.corner.y;
                this.composite_frame.translate(translation, "locked_columns");
                // Ensure that the cursor moves to the
                // bottom of the current view frame
                this.selector.cursorTo(new Point([
                    this.selector.selectionFrame.cursor.x,
                    this.composite_frame.baseFrame.bottom,
                ]));
            // Go to the right of the sheet
            } else if (event.key === "ArrowRight"){
                translation.x = this.data_frame.corner.x - view_frame.corner.x;
                this.composite_frame.translate(translation, "locked_rows");
                // Ensure that the cursor moves to the
                // right side of the current view frame
                this.selector.cursorTo(new Point([
                    this.composite_frame.baseFrame.right,
                    this.selector.selectionFrame.cursor.y
                ]));
            // Go to the left of the sheet
            } else if (event.key === "ArrowLeft"){
                translation.x = view_origin.x - view_frame.origin.x;
                this.composite_frame.translate(translation, "locked_rows");
                // Ensure that the cursor moves to the
                // left side of the current view frame
                this.selector.cursorTo(new Point([
                    view_origin.x,
                    this.selector.selectionFrame.cursor.y
                ]));
            }
            this.composite_frame.translate(translation, "view_frame");
            this.fetchData("update");
        } else if (this.selector){
            if (event.key === "ArrowUp"){
                event.preventDefault();
                if(event.shiftKey){
                    this.selector.growUp();
                } else {
                    this.selector.cursorUp();
                }
            } else if (event.key === "ArrowDown"){
                event.preventDefault();
                if(event.shiftKey){
                    this.selector.growDown();
                } else {
                    this.selector.cursorDown();
                }
            } else if (event.key === "ArrowLeft"){
                event.preventDefault();
                if(event.shiftKey){
                    this.selector.growLeft();
                } else {
                    this.selector.cursorLeft();
                }
            } else if (event.key === "ArrowRight"){
                event.preventDefault();
                if(event.shiftKey){
                    this.selector.growRight();
                } else {
                    this.selector.cursorRight();
                }
            }
        }
    }

    handleSelectorUpdate(direction, translation){
        console.log('onNeedsUpdate:');
        console.log(direction);
        console.log(translation);
        let view_overlay = this.composite_frame.getOverlayFrame("view_frame");
        let view_frame = view_overlay["frame"];
        let view_origin = view_overlay["origin"];
        switch(direction){
            case 'up':
                translation.y = view_frame.origin.y - view_origin.y;
                this.composite_frame.translate(translation, "locked_columns");
                this.composite_frame.translate(translation, "view_frame");
                this.fetchData("update");
            case 'down':
                translation.y = this.data_frame.corner.y - view_frame.corner.y;
                this.composite_frame.translate(translation, "locked_columns");
                this.composite_frame.translate(translation, "view_frame");
                this.fetchData("update");
            case 'left':
                translation.x = view_frame.origin.x - view_origin.x;
                this.composite_frame.translate(translation, "locked_rows");
                this.composite_frame.translate(translation, "view_frame");
                this.fetchData("update");
            case 'right':
                translation.x = this.data_frame.corner.x - view_frame.corner.x;
                this.composite_frame.translate(translation, "locked_rows");
                this.composite_frame.translate(translation, "view_frame");
                this.fetchData("update");
        }
    }

    handleCellMouseup(event){
        this.is_selecting = false;
    }

    handleCellMousedown(event){
        if(event.target.nodeName !== "TD"){
            return;
        }
        this.is_selecting = true;
        let target_coord = this._idToCoord(event.target.id);
        this.selector.cursorTo(target_coord);
    }

    handleCellMouseover(event){
        if(event.target.nodeName !== "TD"){
            return;
        }
        // Here is where we update the selection
        // information.
        if(this.is_selecting){
            let target_coord = this._idToCoord(event.target.id);
            // TODO this can be made cleaner
            let in_locked_column = this.composite_frame.getOverlayFrame("locked_columns")["frame"].contains(target_coord);
            let in_locked_row = this.composite_frame.getOverlayFrame("locked_rows")["frame"].contains(target_coord);
            if(!in_locked_column && !in_locked_row){
                this.selector.fromPointToPoint(
                    this.selector.selectionFrame.cursor,
                    target_coord
                );
            }
        }
    }

    /* I listen for clicks and and set up this.active_frame as necessary.*/
    handleClick(event){
        // TODO eventually pass this as an argument or set as an attrubute on the class
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
        let origin = this.selector.selectionFrame.corner;
        let td = body.querySelector(`#${this._coordToId("td", [origin.x, origin.y])}`);
        let th = head.querySelector(`#sheet-${this.props.id}-head-current`);
        th.textContent = `(${td.dataset.x}x${td.dataset.y}): ${td.textContent}`;
    }

    /* I listen for a mouseover event on a table element and and display the element
    * textContent in the header row.
    **/
    /* No longer used but leaving for later as useful pattern
    handleMouseover(event){
        let head = document.getElementById(`sheet-${this.props.id}-head`);
        let target = event.target;
        if (target.nodeName !== "TD"){
            return;
        }
        let th = head.firstChild.firstChild;
        th.textContent = target.textContent;
        this.handleCellMouseover(event);
    }

    /* Simply resets the `is_selecting` to false, in the
     * event that the user clicked and dragged out of the
     * element
     */
    handleTableMouseleave(event){
        this.is_selecting = false;
    }

    /* I covert a string of the form `nodeName_id_x_y` to [x, y] */
    _idToCoord(s){
        let s_list = s.split("_");
        try {
            return [parseInt(s_list[2]), parseInt(s_list[3])];
        } catch(e) {
            throw "unable to covert id " + s + " to coordinate, with error: " + e;
        }
    }

    /* I take all coordinates in provided frame and style the corresponding 'td' DOM
     * elements with a "locked" css class.
     */
    _addLockedElements(body, frame){
        frame.coords.map((p) => {
            // let x = p.x + offset.x;
            // let y = p.y + offset.y;
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
        // TODO: this place_counter needs to go!
        let replace_counter = 0;
        this.composite_frame.overlayFrames.forEach(frm  => {
            if (replace_counter){
                action = "update";
            }
            let frame = frm["frame"];
            this.requestIndex += 1;
            let request = JSON.stringify({
                event: "sheet_needs_data",
                request_index: this.requestIndex,
                target_cell: this.props.id,
                frame: {
                    origin: {x: frame.origin.x, y: frame.origin.y},
                    corner: {x: frame.corner.x, y: frame.corner.y},
                },
                action: action,
            });
            cellSocket.sendString(request);
            if (action === "replace"){
                replace_counter += 1;
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
                if (dataInfo.action === "replace") {
                    // we update the Sheet with (potentially empty) values
                    // creating 'td' elements with ids corresponding to the frame coordinates (and the sheet id);
                    // this will set up our updateData flow which continually retrieves values from data_frame regadless
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
                this.data_frame.load(dataInfo.data, [origin.x, origin.y]);
                // clean the sheet to make sure no residual data values left
                this._updatedDisplayValues(body);
            }
        });
    }

    /* Update data helpers */
    /* I update the values displayed in the sheet */
    _updatedDisplayValues(body, clean=false){
        if (clean){
            this.composite_frame.baseFrame.coords.forEach(c => {
            let td = body.querySelector(`#${this._coordToId("td", [c.x, c.y])}`);
            td.textContent = undefined;
            td.dataset.x = c.x;
            td.dataset.y = c.y;
            });
        } else {
            this.composite_frame.overlayFrames.forEach(frm => {
                let frame = frm["frame"];
                let projected_frame = this.composite_frame.project(frame.name);
                let frame_coords = frame.coords;
                let projected_frame_coords = projected_frame.coords;
                for (let i = 0; i < frame_coords.length; i++){
                    let data_coord = frame_coords[i];
                    let display_coord = projected_frame_coords[i];
                    let td = body.querySelector(`#${this._coordToId("td", [display_coord.x, display_coord.y])}`);
                    td.textContent = this.data_frame.get(data_coord);
                    td.dataset.x = data_coord.x;
                    td.dataset.y = data_coord.y;
                }
            });
        }
        /*
        frame.coords.map((p) => {
            let x = p.x - frame.origin.x;
            let y = p.y - frame.origin.y;
            let td = body.querySelector(`#${this._coordToId("td", [x, y])}`);
            let d = "";
            if (!clean){
                d = this.data_frame.get(p);
            }
            td.textContent = d;
            td.dataset.x = p.x;
            td.dataset.y = p.y;
        });
        */
    }

    /* Helper functions to determine a 'reasonable' number of columns and rows
     * for the current view. For the moment we use window.innerHeight and
     * window.innerWidth divided by the number provided height and width of the
     * rows, columns, respecitively and then add a bit more for lazy loading.
     */
    _calc_max_num_rows(max_height){
        // NOTE: we account for the header row
        return Math.min(this.totalRows, Math.ceil(max_height/this.props.rowHeight)) - 1;
    }

    _calc_max_num_columns(max_width){
        return Math.min(this.totalColumns, Math.ceil(max_width/this.props.colWidth));
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
        var row_data = this.props.row_data.map((item) => {
            return new SheetCell({
                id: item.id,
                value: item.value,
                width: this.props.colWidth,
                /*
                onMousedown: this.props.onMousedown,
                onMouseup: this.props.onMouseup,
                onMouseenter: this.props.onMouseenter*/
            }).build();
        });
        return (
            h("tr",
                {id: this.props.id, class: "sheet-row", style: this.style},
                row_data
            )
        );
    }
}

SheetRow.propTypes = {
    height: {
        description: "Height of the row in pixels.",
        type: PropTypes.oneOf([PropTypes.number])
    },
    row_data: {
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

        // Bind component methods
        this.handleMouseenter = this.handleMouseenter.bind(this);
        this.handleMouseleave = this.handleMouseleave.bind(this);
        this.handleMousedown = this.handleMousedown.bind(this);
        this.handleMouseup = this.handleMouseup.bind(this);
    }

    componentDidLoad(){
        //TODO: check if cell is active and add proper styling
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
                    style: this.style,
                    /*
                    onmousedown: this.handleMousedown,
                    onmouseup: this.handleMouseup,
                    onmouseenter: this.handleMouseenter,
                    onmouseleave: this.handleMouseleave
                    */
                },
                // child
                [this.value]
            )
        );
    }

    handleMouseup(event){
        if(this.props.onMouseup){
            this.props.onMouseup(event);
        }
    }

    handleMousedown(event){
        if(this.props.onMousedown){
            this.props.onMousedown(event);
        }
    }

    handleMouseenter(event){
        console.log('Cell received MouseEnter!');
        console.log(this);
        console.log(this.props.onMouseenter);
        if(this.props.onMouseenter){
            this.props.onMouseenter(event);
        }
    }

    handleMouseleave(event){
        if(this.props.onMouseleave){
            this.props.onMouseleave(event);
        }
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
