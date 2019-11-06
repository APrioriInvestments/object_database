/**
 * Sheet Cell Component
 * NOTE: This is in part a wrapper
 * for handsontables.
 */
import {h} from 'maquette';
import {Component} from './Component';
import {PropTypes} from './util/PropertyValidator';
import {Frame, DataFrame} from './util/SheetUtils';

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

        // offset is used as a buffer for lazy loading, i.e. we have this many extra
        // columns/rows
        this.max_num_rows = null;
        this.max_num_columns = null;
        this.offset = 1;

        // frames
        // these frames are fixed on scrolling
        this.fixed_column_frame = null;
        this.fixed_row_frame = null;
        // action_frame defines the user's currently selected cells
        this.action_frame = null;
        // full_view_frame defines the coordinates of the current data including the fixed
        // rows/columns view frame
        this.full_view_frame = null;
        // view_frame defines the coordinates of the current data **not** including the fixed
        // rows/columns view frame
        this.view_frame = null;
        // this is our core data frame, containing all table data values
        // NOTE: since we start at row 0 and column 0 we need to subtract 1 from the frame corner coords
        this.data_frame = new DataFrame([0, 0], [this.props.totalColumns - 1, this.props.totalRows - 1]);

        // Bind context to methods
        this.initializeSheet  = this.initializeSheet.bind(this);
        this._updatedDisplayValues = this._updatedDisplayValues.bind(this);
        this._updatedDisplayValues = this._updatedDisplayValues.bind(this);
        // this.generate_rows = this.generate_rows.bind(this);
        this.handleKeyDown = this.handleKeyDown.bind(this);
        this.handleClick = this.handleClick.bind(this);
        this.paginate = this.paginate.bind(this);
        this._updateActiveElement = this._updateActiveElement.bind(this);
        this._createActiveElement = this._createActiveElement.bind(this);
        this._idToCoord = this._idToCoord.bind(this);
        this._coordToId = this._coordToId.bind(this);
    }

    componentDidLoad(){
        console.log(`#componentDidLoad called for Sheet ${this.props.id}`);
        this.container = document.getElementById(this.props.id).parentNode;
        this.max_num_columns = this._calc_max_num_columns(this.container.offsetWidth);
        this.max_num_rows = this._calc_max_num_rows(this.container.offsetHeight);
        // recall columns are on the x-axis and rows on the y-axis
        // We instantiate all frames, even if they are of dim = [0, 0]; this allows us to update
        // the coordinates later as needed (recall a Frame where either origin or corner are null
        // or undefined is of dim [0, 0]).
        if (this.props.numLockColumns > 0){
            this.fixed_column_frame = new Frame([0, 0], [this.props.numLockColumns, this.max_num_rows - 1]);
        } else {
            this.fixed_column_frame = new Frame([0, 0], undefined);
        }
        if (this.props.numLockRows > 0){
            this.fixed_row_frame = new Frame([0, 0], [this.max_num_columns - 1, this.props.numLockRows]);
        } else {
            this.fixed_row_frame = new Frame([0, 0], undefined);
        }
        // TODO update to account for fixed frames
        this.view_frame = new Frame([0, 0], [this.max_num_columns - 1, this.max_num_rows - 1]);
        this.full_view_frame = new Frame([0, 0], [this.max_num_columns - 1, this.max_num_rows - 1]);
        if (this.props.dontFetch != true){
            this.fetchData(
                this.full_view_frame,
                "replace",
                null
            );
        }
    }

    /* I initialize the sheet from coordintate [0, 0] to [corner.x, corner.y] (corner isinstanceof Point)
     * generating 'td' elements with id = this.props.id_x_y
     */
    initializeSheet(projector, body){
        let rows = [];
        let origin = this.full_view_frame.origin;
        let corner = this.full_view_frame.corner;
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
                    // h("thead", {}, [
                    //     h("tr", {id: `sheet-${this.props.id}-head`}, [
                    //     ])
                    // ]),
                    h("tbody", {id: `sheet-${this.props.id}-body`}, rows)
                ])
            ])
        );
    }


    /* I generate the rows, including the passing in row indexes (which are
     * assumed to be element row[0])
     */
    generate_rows(data){
        // TODO figure out how to deal with fixed rows/columns
        return data.map((item, counter) => {
            return (
                new SheetRow(
                    {
                        id: this.props.id,
                        row_data: item,
                        colWidth: this.props.colWidth,
                        height: this.props.rowHeight,
                    }
                ).build()
            )
        })
    }

    /* I listen for arrow keys and call this.paginate when I see one. */
    handleKeyDown(event){
        // TODO eventually pass this as an argument or set as an attrubute on the class
        let body = document.getElementById(`sheet-${this.props.id}-body`);
        // make sure that we have an active cursor target
        // otherwise there is no root for naviation
        if (this.cursor_target_data !== null){
            if (event.key === "ArrowUp"){
                event.preventDefault();
                this._updateActiveElement(body, [0, -1]);
                // this.paginate("row", "prepend")
            } else if (event.key === "ArrowDown"){
                event.preventDefault();
                this._updateActiveElement(body, [0, 1]);
                // this.paginate("row", "append")
            } else if (event.key === "ArrowLeft"){
                event.preventDefault();
                this._updateActiveElement(body, [-1, 0]);
                // this.paginate("column", "prepend")
            } else if (event.key === "ArrowRight"){
                event.preventDefault();
                this._updateActiveElement(body, [1, 0]);
                // this.paginate("column", "append")
            }
        }
    }

    /* I listen for clicks and trigger relevant pagination events.*/
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
        let target_coord = this._idToCoord(target.id);
        target.className += " active";
        if (!this.action_frame){
            // NOTE: this is a [1, 1] dim frame, we'll expand this for more flexible selection UX later
            this.action_frame = new Frame(target_coord, target_coord);
        } else {
            // we need to unset previsously selected classes
            this.action_frame.coords.map((p) => {
                let td = body.querySelector(`#${this._coordToId("td", [p.x, p.y])}`);
                td.className = td.className.replace(" active", "");
            })
            // NOTE: this is a [1, 1] dim frame, we'll expand this for more flexible selection UX later
            this.action_frame.setOrigin = target_coord;
            this.action_frame.setCorner = target_coord;
        }
    }

    /* I update the active element css classes, shifting the frame, removing the old adding the new.
     * I interact with this.active_frame directly
     */
    _updateActiveElement(body, shift){
        // we need to unset previsously selected classes
        this.action_frame.coords.map((p) => {
            let td = body.querySelector(`#${this._coordToId("td", [p.x, p.y])}`);
            td.className = td.className.replace(" active", "");
        })
        // now translate the frame by shift and update the classes
        this.action_frame.translate(shift);
        this.action_frame.coords.map((p) => {
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

    /* I covert a coord [x, y] array to a string of the form `nodeName_id_x_y`*/
    _coordToId(nodeName, xy){
        return `${nodeName}_${this.props.id}_${xy[0]}_${xy[1]}`;
    }

    /* I handle row/column pagination by adding this.offset and removing
     * rows/columns as needed.
     */
    paginate(axis, action){
        // TODO: this should be handled with http calls to the server
        // let handler = window._cellHandler;
        if (action === "prepend") {
            if (axis === "row") {
                // no need to do anything if we are already at row 0
                if (this.current_start_row_index > 0){
                    this.current_start_row_index = Math.max(this.current_start_row_index - this.offset, 0)
                    this.current_end_row_index = Math.max(this.current_end_row_index - this.offset, 0)
                    this.fetchData(
                        this.frame,
                        "prepend",
                        "row"
                    )
                }
            } else if (axis === "column") {
                // no need to do anything if we are at column 0
                if (this.current_start_column_index > 0){
                    this.current_start_column_index = Math.max(this.current_start_column_index - this.offset, 0)
                    this.current_end_column_index = Math.max(this.current_end_column_index - this.offset, 0)
                    this.fetchData(
                        this.frame,
                        "prepend",
                        "column"
                    )
                }
            }
        } else if (action === "append") {
            if (axis === "row") {
                this.fetchData(
                    this.frame,
                    "append",
                    "row"
                )
                this.current_end_row_index = this.current_end_row_index + this.offset
                this.current_start_row_index = this.current_start_row_index + this.offset
            } else if (axis === "column") {
                this.fetchData(
                    this.frame,
                    "append",
                    "column"
                )
                this.current_start_column_index = this.current_start_column_index + this.offset
                this.current_end_column_index = this.current_end_column_index + this.offset
            }
        }
    }

    /* I make WS requests to the server */
    fetchData(frame, action, axis){
        let request = JSON.stringify({
            event: "sheet_needs_data",
            target_cell: this.props.id,
            frame: {
                origin: {x: frame.origin.x, y: frame.origin.y},
                corner: {x: frame.corner.x, y: frame.corner.y},
            },
            action: action,
            axis: axis
        });
        // console.log(request);
        cellSocket.sendString(request);
    }

    /* I handle data updating for the Sheet. I need to know whether
     * this is a `replace` or a `row` or `column` type of update.
     * If it is `row` or `column` I need to know the direction `prepend`
     * or `append`.
     */
    _updateData(dataInfo, projector) {
        console.log("updating data for sheet: " + this.props.id)
        // console.log(dataInfo.data);
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
                this.initializeSheet(projector, body);
                // load the data into the data with origin [0, 0]
                this.data_frame.load(dataInfo.data, [0, 0]);
                // TODO perhaps we should update fixed rows, fixed columns and the view frame independtly
                this._updatedDisplayValues(body, this.full_view_frame);
            } else if (dataInfo.action === "prepend") {
                this.__updateDataPrepend(body, head, dataInfo, projector)
            } else if (dataInfo.action === "append") {
                this.__updateDataAppend(body, head, dataInfo, projector)
            }
        }
    }

    /* Update data helpers */
    /* I update the values displayed in the sheet for the provided frame */
    _updatedDisplayValues(body, frame){
        frame.coords.map((p) => {
            let td = body.querySelector(`#${this._coordToId("td", [p.x, p.y])}`);
            td.textContent = this.data_frame.get(p);
        })
    }

    /* Helper functions to determine a 'reasonable' number of columns and rows
     * for the current view. For the moment we use window.innerHeight and
     * window.innerWidth divided by the number provided height and width of the
     * rows, columns, respecitively and then add a bit more for lazy loading.
     */
    _calc_max_num_rows(max_height){
        return Math.min(this.props.totalRows, Math.ceil(max_height/this.props.rowHeight));
    }

    _calc_max_num_columns(max_width){
        return Math.min(this.props.totalColumns, Math.ceil(max_width/this.props.colWidth));
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
        let child = [this.value];
        if (this.value){
            child.push(h("span", {class: "tooltiptext"}, [this.value]));
        }
        return (
            h("td",
                {
                    id: this.props.id,
                    class: this.class,
                    style: this.style,
                    // "data-x": this.props.x.toString(),
                    // "data-y": this.props.y.toString()
                },
                child
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
