/*
 *
 * Sheet Cell Component
 * NOTE: This is in part a wrapper
 * for handsontables.
 */
import {h} from 'maquette';
import {Component} from './Component';
import {PropTypes} from './util/PropertyValidator';
import {Point, Frame, DataFrame} from './util/SheetUtils';

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
        this.offset = 1;
        this.requestIndex = 0;

        // frames
        // these frames are fixed on scrolling
        this.locked_column_frame = null;
        this.locked_column_offset = new Point([0, 0]);
        this.locked_row_frame = null;
        this.locked_row_offset = new Point([0, 0]);
        // fixed_view_frame defines the coordinates of the Sheet view; it never changes and is defined
        // by the max number of columns and rows which fit into the alloted DOM element
        this.fixed_view_frame = null;
        // view_frame defines the coordinates of the current data **not** including the fixed
        // rows/columns view frame
        this.view_frame = null;
        // with fixed rows/columns we need to offset the view frame
        // instead of continually checking against fixed/column row dims we simply define and update the
        // Point
        this.view_frame_offset = new Point([0, 0]);
        // active_frame defines the user's currently selected cells. It lives exclusively inside the view_frame
        this.active_frame = null;
        // this is our core data frame, containing all table data values
        // NOTE: since we start at row 0 and column 0 we need to subtract 1 from the frame corner coords
        // TODO: we need some cleanup/garbage-collection of data_frame
        this.data_frame = new DataFrame([0, 0], [this.totalColumns - 1, this.totalRows - 1]);

        // Bind context to methods
        this.initializeSheet  = this.initializeSheet.bind(this);
        this.resize = this.resize.bind(this);
        this._updatedDisplayValues = this._updatedDisplayValues.bind(this);
        this._updatedDisplayValues = this._updatedDisplayValues.bind(this);
        this.handleKeyDown = this.handleKeyDown.bind(this);
        this.handleClick = this.handleClick.bind(this);
        this.arrowUpDownLeftRight = this.arrowUpDownLeftRight.bind(this);
        this.pageUpDown = this.pageUpDown.bind(this);
        this._updateActiveElement = this._updateActiveElement.bind(this);
        this._createActiveElement = this._createActiveElement.bind(this);
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
        // recall columns are on the x-axis and rows on the y-axis
        // We instantiate all frames, even if they are of dim = 0; this allows us to update
        // the coordinates later as needed (recall a Frame where either origin or corner are null
        // or undefined is of dim 0).
        this.locked_column_frame = new Frame([0, 0], [0, 0]);
        this.locked_row_frame = new Frame([0, 0], [0, 0]);
        if (this.props.numLockColumns > 0){
            this.locked_column_frame = new Frame([0, 0], [this.props.numLockColumns - 1, this.max_num_rows - 1]);
            // this.locked_row_offset.y = this.;
            this.view_frame_offset.x = this.props.numLockColumns;
            // this.locked_column_offset.x = this.props.numLockColumns;
        }
        if (this.props.numLockRows > 0){
            this.locked_row_frame = new Frame([0, 0], [this.max_num_columns - 1, this.props.numLockRows - 1]);
            this.view_frame_offset.y = this.props.numLockRows;
        }
        // this.locked_row_frame.origin.x = this.locked_column_frame.size.x;
        // this.locked_column_frame.origin.y = this.locked_row_frame.size.y;
        this.fixed_view_frame = new Frame([0, 0], [this.max_num_columns - 1, this.max_num_rows - 1]);
        // view frame accounts for locked column/row frames
        this.view_frame = new Frame(this.view_frame_offset, [this.max_num_columns - 1, this.max_num_rows - 1]);
        if (this.props.dontFetch != true){
            this.fetchData(
                this.fixed_view_frame, // we get all the data we need for now
                "replace",
            );
        }
        const ro = new ResizeObserver(entries => {
            console.log("new resize");
            this.resize();
            for (let entry of entries) {
                if (entry.target.firstElementChild && entry.target.firstElementChild.id  === this.props.id){
                }
                //entry.target.style.borderRadius = Math.max(0, 250 - entry.contentRect.width) + 'px';
                console.log(entry);
            }
        });
        ro.observe(this.container.parentNode);
        // window.addEventListener('resize', this.componentDidLoad);
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
        this.max_num_columns = max_num_columns;
        this.max_num_rows = max_num_rows;
        this.fixed_view_frame.setCorner = [this.max_num_columns - 1, this.max_num_rows - 1];
        this.view_frame.corner.x += max_columns_diff;
        this.view_frame.corner.y += max_rows_diff;
        this.fetchData(
            this.view_frame,
            "replace",
        );
        // now for the locked row frame
        if (this.locked_row_frame.dim){
            this.locked_row_frame.corner.x += max_columns_diff;
            // this.locked_row_frame.corner.y += max_rows_diff;
            this._updatedDisplayValues(body, this.locked_row_frame, this.locked_row_offset);
            this.fetchData(
                this.locked_row_frame,
                "update",
            );
        }
        // now for the locked column frame
        if (this.locked_column_frame.dim){
            // this.locked_column_frame.corner.x += max_columns_diff;
            this.locked_column_frame.corner.y += max_columns_diff;
            this._updatedDisplayValues(body, this.locked_column_frame, this.locked_column_offset);
            this.fetchData(
                this.locked_column_frame,
                "update",
            );
        }
    }

    /* I initialize the sheet from coordintate [0, 0] to [corner.x, corner.y] (corner isinstanceof Point)
     * generating 'td' elements with id = this.props.id_x_y
     */
    initializeSheet(projector, body){
        let rows = [];
        let origin = this.fixed_view_frame.origin;
        let corner = this.fixed_view_frame.corner;
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
                        height: this.props.rowHeight,
                    }
                ).build()
            )
        }
        while(body.firstChild){
            body.firstChild.remove();
        }
        rows.map((r) => {
            projector.append(body, () => {return r});
        })
        if (this.locked_column_frame.dim > 0){
            this._addLockedElements(body, this.locked_column_frame);
        }
        if (this.locked_row_frame.dim > 0){
            this._addLockedElements(body, this.locked_row_frame);
        }
    }

    build(){
        console.log(`Rendering custom sheet ${this.props.id}`);
        let rows = ["Just a sec..."];
        return (
            h("div", {
                id: this.props.id,
                "data-cell-id": this.props.id,
                "data-cell-type": "Sheet",
                class: "cell sheet-wrapper",
            }, [
                h("table", {
                    class: "sheet",
                    style: "table-layout:fixed",
                    tabindex: "-1",
                    onkeydown: this.handleKeyDown,
                    onclick: this.handleClick
                }, [
                    h("tbody", {id: `sheet-${this.props.id}-body`}, rows)
                ])
            ])
        );
    }


    /* I listen for arrow keys and paginate if necessary. */
    handleKeyDown(event){
        // TODO eventually pass this as an argument or set as an attrubute on the class
        let body = document.getElementById(`sheet-${this.props.id}-body`);
        // make sure that we have an active target
        // otherwise there is no root for navigation
        console.log(event.key + event.altKey);
        if (["PageUp", "PageDown"].indexOf(event.key) > -1){
            this.pageUpDown(body, event);
        } else if(["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"].indexOf(event.key) > -1) {
            this.arrowUpDownLeftRight(body, event);
        }
    }

    /* I handle page Up/Down of the view */
    pageUpDown(body, event){
        event.preventDefault();
        // TODO figure out how to deal with checking for alt
        let page = this.view_frame.size;
        let shift = [0, 0];
        if (event.altKey){
            // offset by fixed rows/columns
            if (event.key === "PageDown"){
                // make sure we don't run out of data at the right of the page
                if (this.view_frame.corner.x + page.x > this.totalColumns){
                    page.x = this.totalColumns - this.view_frame.corner.x - 1;
                }
                shift = [page.x, 0];
                // if there is a selected element move it to the rightmost column
                if (this.active_frame){
                    let shift_x = this.fixed_view_frame.corner.x - this.active_frame.corner.x;
                    this._updateActiveElement(body, [shift_x, 0]);
                }
            } else {
                // make sure we don't run out of data at the left
                if (this.view_frame.origin.x - page.x < this.view_frame_offset.x){
                    page.x = this.view_frame.origin.x - this.view_frame_offset.x;
                }
                shift = [-1 * page.x, 0];
                // if there is a selected element move it to the leftmost column
                if (this.active_frame){
                    let shift_x = this.fixed_view_frame.origin.x - this.active_frame.origin.x;
                    this._updateActiveElement(body, [shift_x, 0]);
                }
            }
            // now for the locked row frame
            if (this.locked_row_frame.dim){
                this.locked_row_frame.translate(shift);
                this._updatedDisplayValues(body, this.locked_row_frame, this.locked_row_offset);
                this.fetchData(
                    this.locked_row_frame,
                    "update",
                );
            }
        } else {
            // offset by fixed rows/columns
            if (event.key === "PageDown"){
                // make sure we don't run out of data at the bottom of the page
                if (this.view_frame.corner.y + page.y > this.totalRows){
                    page.y = this.totalRows - this.view_frame.corner.y - 1;
                }
                shift = [0, page.y];
            } else {
                // make sure we don't run out of data at the top
                if (this.view_frame.origin.y - page.y < this.view_frame_offset.y){
                    page.y = this.view_frame.origin.y - this.view_frame_offset.y;
                }
                shift = [0, -1 * page.y];
            }
            // now for the locked column frame
            if (this.locked_column_frame.dim){
                this.locked_column_frame.translate(shift);
                this._updatedDisplayValues(body, this.locked_column_frame, this.locked_column_offset);
                this.fetchData(
                    this.locked_column_frame,
                    "update",
                );
            }
        }
        // we update the values before the make a server and after
        this.view_frame.translate(shift);
        this._updatedDisplayValues(body, this.view_frame, this.view_frame_offset);
        // no need to shift the active_frame, already at the bottom
        this.fetchData(
            this.view_frame, // NOTE: we always fetch against view frames not the fixed frame
            "update",
        );
    }

    /* I handle arrow triggered navigation of the active_frame and related views */
    arrowUpDownLeftRight(body, event){
        event.preventDefault();
        if (event.ctrlKey){
            if (event.key === "ArrowUp"){
                this.view_frame.origin.y = this.view_frame_offset.y;
                this.view_frame.corner.y = this.max_num_rows - 1;
                if (this.locked_column_frame.dim){
                    this.locked_column_frame = new Frame([0, 0], [this.props.numLockColumns - 1, this.max_num_rows - 1]);
                    this._updatedDisplayValues(body, this.locked_column_frame, this.locked_column_offset);
                    this.fetchData(
                        this.locked_column_frame,
                        "update",
                    );
                }
            } else if (event.key === "ArrowDown"){
                this.view_frame.origin.y = this.totalRows - this.view_frame.size.y;
                this.view_frame.corner.y = this.totalRows - 1;
                if (this.locked_column_frame.dim){
                    this.locked_column_frame = new Frame(
                        [0, this.totalRows - this.locked_column_frame.size.y],
                        [this.props.numLockColumns - 1, this.totalRows - 1]);
                    this._updatedDisplayValues(body, this.locked_column_frame, this.locked_column_offset);
                    this.fetchData(
                        this.locked_column_frame,
                        "update",
                    );
                }
            } else if (event.key === "ArrowRight"){
                this.view_frame.origin.x = this.totalColumns - this.view_frame.size.x;
                this.view_frame.corner.x = this.totalColumns - 1;
                if (this.locked_row_frame.dim){
                    this.locked_row_frame = new Frame(
                        [this.totalColumns - this.locked_row_frame.size.x, 0],
                        [this.totalColumns - 1, this.props.numLockRows - 1]);
                    this._updatedDisplayValues(body, this.locked_row_frame, this.locked_row_offset);
                    this.fetchData(
                        this.locked_row_frame,
                        "update",
                    );
                }
            } else if (event.key === "ArrowLeft"){
                this.view_frame.origin.x = this.view_frame_offset.x;
                this.view_frame.corner.x = this.max_num_columns - 1;
                if (this.locked_row_frame.dim){
                    this.locked_row_frame = new Frame([0, 0], [this.max_num_columns - 1, this.props.numLockRows - 1]);
                    this._updatedDisplayValues(body, this.locked_row_frame, this.locked_row_offset);
                    this.fetchData(
                        this.locked_row_frame,
                        "update",
                    );
                }
            }
            this._updatedDisplayValues(body, this.view_frame, this.view_frame_offset);
            this.fetchData(
                this.view_frame,
                "update",
            );
        } else if (this.active_frame){
            if (event.key === "ArrowUp"){
                let shift = [0, -1] // y-axis is rows
                // if the top of this.active_frame is at the top of this.view_frame
                // we need to shift the view frame only and fetch more data
                if (this.active_frame.origin.y === this.view_frame_offset.y){
                    // no reason to do anything if already at the top
                    if (this.view_frame.origin.y > this.view_frame_offset.y){
                        // now for the locked column frame
                        if (this.locked_column_frame.dim){
                            this.locked_column_frame.translate(shift);
                            this._updatedDisplayValues(body, this.locked_column_frame, this.locked_column_offset);
                            this.fetchData(
                                this.locked_column_frame,
                                "update",
                            );
                        }
                        // we update the values before the make a server and after
                        this.view_frame.translate(shift);
                        this._updatedDisplayValues(body, this.view_frame, this.view_frame_offset);
                        // no need to shift the active_frame, already at the top
                        this.fetchData(
                            this.view_frame, // NOTE: we always fetch against view frames not the fixed frame
                            "update",
                        );
                    }
                } else {
                    this._updateActiveElement(body, shift);
                }
            } else if (event.key === "ArrowDown"){
                event.preventDefault();
                let shift = [0, 1] // y-axis is rows
                // if the bottom of this.active_frame is at the bottom of this.fixed_view_frame
                //  and we have not exceeded the number of rows we need to shift the view frame only
                if (this.active_frame.corner.y === this.fixed_view_frame.corner.y){
                    // no reason to do anything if already at the bottom
                    if (this.view_frame.corner.y < this.totalRows - 1){
                        // now for the locked column frame
                        if (this.locked_column_frame.dim){
                            this.locked_column_frame.translate(shift);
                            this._updatedDisplayValues(body, this.locked_column_frame, this.locked_column_offset);
                            this.fetchData(
                                this.locked_column_frame,
                                "update",
                            );
                        }
                        // we update the values before the make a server and after
                        this.view_frame.translate(shift);
                        this._updatedDisplayValues(body, this.view_frame, this.view_frame_offset);
                        // no need to shift the active_frame, already at the bottom
                        this.fetchData(
                            this.view_frame, // NOTE: we always fetch against view frames not the fixed frame
                            "update",
                        );
                    }
                } else {
                    this._updateActiveElement(body, shift);
                }
            } else if (event.key === "ArrowLeft"){
                event.preventDefault();
                let shift = [-1, 0] // x-axis is columns
                // if the left of this.active_frame is at the left of this.view_frame
                // we need to shift the view frame first
                if (this.active_frame.origin.x === this.view_frame_offset.x){
                    // no reason to do anything if already on the left border
                    if (this.view_frame.origin.x > this.view_frame_offset.x){
                        // now for the locked row frame
                        if (this.locked_row_frame.dim){
                            this.locked_row_frame.translate(shift);
                            this._updatedDisplayValues(body, this.locked_row_frame, this.locked_row_offset);
                            this.fetchData(
                                this.locked_row_frame,
                                "update",
                            );
                        }
                        // we update the values before the make a server and after
                        this.view_frame.translate(shift);
                        this._updatedDisplayValues(body, this.view_frame, this.view_frame_offset);
                        // no need to shift the active_frame, already at the top
                        this.fetchData(
                            this.view_frame, // NOTE: we always fetch against view frames not the fixed frame
                            "update",
                        );
                    }
                } else {
                    this._updateActiveElement(body, shift);
                }
            } else if (event.key === "ArrowRight"){
                event.preventDefault();
                let shift = [1, 0] // x-axis is rows
                // if the right of this.active_frame is at the right of this.fixed_view_frame
                //  and we have not exceeded the number of columns we need to shift the view frame only
                if (this.active_frame.corner.x === this.fixed_view_frame.corner.x){
                    // no reason to do anything if already at max number of columns
                    if (this.view_frame.corner.x < this.totalColumns - 1){
                        // now for the locked row frame
                        if (this.locked_row_frame.dim){
                            this.locked_row_frame.translate(shift);
                            this._updatedDisplayValues(body, this.locked_row_frame, this.locked_row_offset);
                            this.fetchData(
                                this.locked_row_frame,
                                "update",
                            );
                        }
                        // we update the values before the make a server and after
                        this.view_frame.translate(shift);
                        this._updatedDisplayValues(body, this.view_frame, this.view_frame_offset);
                        // no need to shift the active_frame, already at the bottom
                        this.fetchData(
                            this.view_frame, // NOTE: we always fetch against view frames not the fixed frame
                            "update",
                        );
                    }
                } else {
                    this._updateActiveElement(body, shift);
                }
            }
        }
    }

    /* I listen for clicks and and set up this.active_frame as necessary.*/
    handleClick(event){
        // TODO eventually pass this as an argument or set as an attrubute on the class
        let body = document.getElementById(`sheet-${this.props.id}-body`);
        let target = event.target;
        // if the user accidentally clicked on the tooltip or something else, don't do anything
        if (target.nodeName !== "TD"){
            return;
        }
        this._createActiveElement(body, target);
    }

    /* I create the active element css classes, removing the old adding the new.
     * I interact with this.active_frame directly
     */
    _createActiveElement(body, target){
        console.log("creating active: " + target);
        let target_coord = this._idToCoord(target.id);
        target.className += " active";
        if (!this.active_frame){
            // NOTE: this is a 0 dim frame, we'll expand this for more flexible selection UX later
            this.active_frame = new Frame(target_coord, target_coord);
        } else {
            // we need to unset previsously selected classes
            this.active_frame.coords.map((p) => {
                let td = body.querySelector(`#${this._coordToId("td", [p.x, p.y])}`);
                td.className = td.className.replace(" active", "");
            })
            // NOTE: this is a 0 dim frame, we'll expand this for more flexible selection UX later
            this.active_frame.setOrigin = target_coord;
            this.active_frame.setCorner = target_coord;
        }
    }

    /* I update the active element css classes, shifting the frame, removing the old adding the new.
     * I interact with this.active_frame directly
     */
    _updateActiveElement(body, shift){
        // we need to unset previsously selected classes
        this.active_frame.coords.map((p) => {
            let td = body.querySelector(`#${this._coordToId("td", [p.x, p.y])}`);
            td.className = td.className.replace(" active", "");
        })
        // now translate the frame by shift and update the classes
        this.active_frame.translate(shift);
        this.active_frame.coords.map((p) => {
            let td = body.querySelector(`#${this._coordToId("td", [p.x, p.y])}`);
            td.className = td.className += " active";
        })
    }

    /* I covert a string of the form `nodeName_id_x_y` to [x, y] */
    _idToCoord(s){
        let s_list = s.split("_");
        try {
            return [parseInt(s_list[2]), parseInt(s_list[3])]
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
        })
    }

    /* I take all coordinates in provided frame and style the corresponding 'td' DOM
     * elements with a "locked" css class.
     */
    _removeLockedElements(body, frame){
        frame.coords.map((p) => {
            let td = body.querySelector(`#${this._coordToId("td", [p.x, p.y])}`);
            td.className += td.className.replace(" locked", "");
        })
    }

    /* I covert a coord [x, y] array to a string of the form `nodeName_id_x_y`*/
    _coordToId(nodeName, xy){
        return `${nodeName}_${this.props.id}_${xy[0]}_${xy[1]}`;
    }

    /* I make WS requests to the server */
    fetchData(frame, action){
        // we ask for a bit more data than we need for the view to prevent flickering
        // frame = this._padFrame(frame, new Point([2, 2]));
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
            console.log("updating data for sheet: " + this.props.id + " with response id " + dataInfo.response_id)
            // make sure the data is not empty
            let body = document.getElementById(`sheet-${this.props.id}-body`);
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
                    this.initializeSheet(projector, body);
                }
                // load the data into the data with the provided origin
                let origin = dataInfo.origin;
                this.data_frame.load(dataInfo.data, [origin.x, origin.y]);
                if (this.locked_column_frame.dim > 0){
                    this._updatedDisplayValues(body, this.locked_column_frame, this.locked_column_offset);
                }
                if (this.locked_row_frame.dim > 0){
                    this._updatedDisplayValues(body, this.locked_row_frame, this.locked_row_offset);
                }
                this._updatedDisplayValues(body, this.view_frame, this.view_frame_offset);
            }
        })
    }

    /* Update data helpers */
    /* I update the values displayed in the sheet for the provided frame */
    _updatedDisplayValues(body, frame, offset){
        // the fixed_view_frame coordinates never change and we use the passed frame.origin
        // as the offset, i.e. we are effectively shifting the passed frame to match the
        // fixed view but keeping the 'true' coordintaes to retrieve the data
        // in addition if the frame needs to be shifted, such as the case when frame is the
        // view frame and we have locked columns or rows, we offset by the provided Point
        frame.coords.map((p) => {
            let x = p.x - frame.origin.x + offset.x;
            let y = p.y - frame.origin.y + offset.y;
            let td = body.querySelector(`#${this._coordToId("td", [x, y])}`);
            let d = this.data_frame.get(p);
            // TODO: this should be more robust
            // td.children[0].textContent = d;
            td.textContent = d;
            // the tooltip
            // td.children[1].textContent = d;
        })
    }

    /* Helper functions to determine a 'reasonable' number of columns and rows
     * for the current view. For the moment we use window.innerHeight and
     * window.innerWidth divided by the number provided height and width of the
     * rows, columns, respecitively and then add a bit more for lazy loading.
     */
    _calc_max_num_rows(max_height){
        return Math.min(this.totalRows, Math.ceil(max_height/this.props.rowHeight));
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
        this.style = `max-height: ${this.props.height}px; height: ${this.props.height}px`

        // Bind component methods
    }

    componentDidLoad(){
    }

    build(){
        var row_data = this.props.row_data.map((item) => {
            return new SheetCell(
                {id: item.id, value: item.value, width: this.props.colWidth}).build()
        })
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
