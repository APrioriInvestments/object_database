/**
 * Sheet Cell Component
 * NOTE: This is in part a wrapper
 * for handsontables.
 */
import {h} from 'maquette';
import {Component} from './Component';
import {PropTypes} from './util/PropertyValidator';


/**
 * About Replacements
 * This component has one regular
 * replacement:
 * * `error`
 */

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
        this.offset = 10;
        this.current_data = null;
        this.column_names = null;
        this.current_start_row_index = null;
        this.current_end_row_index = null;
        this.current_start_column_index = null;
        this.current_end_column_index = null;

        // scrolling attributes used to guage the direction of scrolling
        // and make appropriate calls to lazy load data
        this.scrollTop = 0;
        this.scrollLeft = 0;

        // Bind context to methods
        this.initializeTable = this.initializeTable.bind(this);
        this.generate_current_rows = this.generate_current_rows.bind(this);
        this.generate_header = this.generate_header.bind(this);
        this.handleScrolling = this.handleScrolling.bind(this);
        this.paginate = this.paginate.bind(this);
        this.jump_to_cell = this.jump_to_cell.bind(this);
        // this.handleClick = this.handleClick.bind(this);
        // this.initializeHooks = this.initializeHooks.bind(this);
        // this.makeError = this.makeError.bind(this);

        this.initializeTable();
    }

    componentDidLoad(){
        console.log(`#componentDidLoad called for Sheet ${this.props.id}`);
        this.max_num_columns = this._calc_max_num_columns();
        // console.log("max num of columns: " + this.max_num_columns)
        this.max_num_rows = this._calc_max_num_rows();
        this.fetchData(
            this.current_start_row_index,
            this.current_end_row_index + this.offset,
            this.current_start_column_index,
            this.current_end_column_index + this.offset,
            "replace",
            null
        )
        // console.log("max num of rows: " + this.max_num_rows)
        // if(this.props.extraData['handlesDoubleClick']){
        //     this.initializeHooks();
        // }
    }

    initializeTable(){
        console.log(`#initializeTable called for Sheet ${this.props.id}`);
        this.current_start_row_index = 0;
        this.current_end_row_index = this.max_num_rows;
        this.current_start_column_index = 0;
        this.current_end_column_index = this.max_num_columns;
    }


    build(){
        console.log(`Rendering custom sheet ${this.props.id}`);
        return (
            h("div", {
                id: this.props.id,
                "data-cell-id": this.props.id,
                "data-cell-type": "Sheet",
                class: "cell sheet-wrapper",
                onscroll: this.handleScrolling,
            }, [
                h("table", {class: "sheet"}, [
                    h("thead", {}, this.generate_header()),
                    h("tbody", {}, this.generate_current_rows())
                ])
            ])
        );
    }

    /* I generate the table header.*/
    generate_header(){
        let header = [];
        let start = this.current_start_column_index;
        let end = this.current_end_column_index;
        if (this.column_names !== null) {
            header = this.column_names.slice(start, end).map((item) => {
                return h("th", {class: "header-item"}, [item])
            })
            // NOTE: we add one more column to account for the row index
        }
        // TODO potentially make this an input for this.jump_to_cell;
        header.unshift(h("th", {class: "header-item zero"}, []))
        return (
            h("tr"), {}, [
                header
            ]
        )
    }

    /* I generate the rows, including the passing in row indexes (which are
     * assumed to be element row[0])
     */
    generate_current_rows(){
        let rows = ["Just a sec..."];
        let start = this.current_start_row_index;
        let end = this.current_end_row_index;
        if (this.current_data !== null) {
            rows = this.current_data.slice(start, end).map((item) => {
                return (
                    new SheetRow(
                        {
                            id: this.props.id,
                            row_data: item.slice(1),
                            colWidth: this.props.colWidth,
                            height: this.props.rowHeight,
                            rowIndexName: item[0]
                        }
                    ).build()
                )
            })
        }
        return rows;
    }

    /* I handle scrolling events and trigger callbacks to get more data as
     * needed. As the user scrolls in a given direction (left, right, up, down)
     * I wait until this.offset number of columns or rows have been scrolled
     * and trigger the callback. This way we always maintain a buffer for lazy loading.
     */
    handleScrolling(event){
        let element = event.target;
        let leftDiff = element.scrollLeft - this.scrollLeft
        let topDiff = element.scrollTop - this.scrollTop
        // we make sure that we have 1/2 of the offset as buffer
        let offset = this.offset/2
        if (leftDiff > offset * this.props.colWidth) {
            this.paginate("column", "append")
            this.scrollLeft = element.scrollLeft;
        } else if (-1 * leftDiff > offset * this.props.colWidth) {
            this.scrollLeft = element.scrollLeft;
            this.paginate("column", "prepend")
        }
        if (topDiff > offset * this.props.rowHeight) {
            this.paginate("row", "append")
            this.scrollTop = element.scrollTop;
        } else if (-1 * topDiff > offset * this.props.rowHeight) {
            this.paginate("row", "prepend")
            this.scrollTop = element.scrollTop;
        }
    }

    /* I handle row/column pagination by adding 1/2*this offset and removing
     * rows/columns as needed.
     */
    paginate(axis, action){
        // TODO: this should be handled with http calls to the server
        // let handler = window._cellHandler;
        // we make sure that we have 1/2 of the offset as buffer
        let offset = this.offset/2
        if (dataInfo.action === "prepend") {
            if (axis === "row") {
                this.fetchData(
                    Math.max(this.current_start_row_index - offset, 0),
                    this.current_end_start_index,
                    this.current_start_column_index,
                    this.current_end_column_index,
                    "prepend",
                    "row"
                )
            } else if (axis === "column") {
                this.fetchData(
                    this.current_start_row_index,
                    this.current_end_start_index,
                    Math.min(this.current_start_column_index - offset, 0),
                    this.current_start_column_index,
                    "prepend",
                    "column"
                )
            }
        } else if (dataInfo.action === "append") {
            if (axis === "row") {
                this.fetchData(
                    this.current_end_row_index,
                    this.current_end_row_index + offset,
                    this.current_start_column_index,
                    this.current_end_column_index,
                    "append",
                    "row"
                )
            } else if (axis === "column") {
                this.fetchData(
                    this.current_start_row_index,
                    this.current_end_start_index,
                    this.current_end_column_index,
                    this.current_end_column_index + offset,
                    "append",
                    "column"
                )
            }
        }
    }

    /* I make WS requests to the server */
    fetchData(start_row, end_row, start_column, end_column, action, axis){
        cellSocket.sendString(JSON.stringify({
            event: "sheet_needs_data",
            target_cell: this.props.id,
            start_row: start_row,
            end_row: end_row,
            start_column: end_column,
            action: action,
            axis: axis
        }));
    }

    /* I handle data updating for the Sheet. I need to know whether
     * this is a `replace` or a `row` or `column` type of update.
     * If it is `row` or `column` I need to know the direction `prepend`
     * or `append`.
     */
    _updateData(dataInfo) {
        if (dataInfo.action === "replace") {
            this.current_data = dataInfo.data;
            this.column_names = dataInfo.column_names;
        } else if (dataInfo.action === "prepend") {
            if (dataInfo.axis === "row") {
                // note we pop off from the end the same number of rows as we prepend
                this.current_data = dataInfo.data.concat(this.current_data.slice(0, -dataInfo.data.length))
            } else if (dataInfo.axis === "column") {
                // make sure that we have the same number of rows coming as before
                if (this.current_data.length !== dataInfo.data.length) {
                    throw "Incoming data does not match row number"
                }
                // put the columns together
                let x_dim = dataInfo.column_names.length - 1;
                this.column_names = dataInfo.column_names.concat(this.column_names.slice(0, x_dim))
                // now the rows
                let new_data = [];
                for (let i = 0; i < this.current_data.length; i++){
                    let old_row = this.current_data[i];
                    let new_row = dataInfo.data[i];
                    if (old_row[0] !== new_row[0]){
                        throw "row index " + old_row[0] + " does not match incoming row index " + new_row[0]
                    }
                    new_data.push(
                        new_row.concat(old_row.slice(1, old_row.length - new_row.length + 1))
                    )
                }
                this.current_data = new_data;
            }
        } else if (dataInfo.action === "append") {
            if (dataInfo.axis === "row") {
                // note we pop off from the top the same number of rows as we append
                this.current_data = this.current_data.slice(dataInfo.data.length).concat(dataInfo.data)
            } else if (dataInfo.axis === "column") {
                // make sure that we have the same number of rows coming as before
                if (this.current_data.length !== dataInfo.data.length) {
                    throw "Incoming data does not match row number"
                }
                // put the columns together
                let x_dim = dataInfo.column_names.length - 1;
                this.column_names = this.column_names.slice(x_dim + 1).concat(dataInfo.column_names);
                // now the rows
                let new_data = [];
                for (let i = 0; i < this.current_data.length; i++){
                    let old_row = this.current_data[i];
                    let new_row = dataInfo.data[i];
                    if (old_row[0] !== new_row[0]){
                        throw "row index " + old_row[0] + " does not match incoming row index " + new_row[0]
                    }
                    new_data.push(
                        old_row.slice(0, 1).concat(old_row.slice(new_row.length)).concat(new_row.slice(1))
                    )
                }
                this.current_data = new_data;
            }
        }
    }

    /* I allow this user to jump to a specific cell, putting it at the top
     * left, i.e. coordinate (0, 0), on the screen
     */
    jump_to_cell(x, y){
        // TODO this won't exactly get the requested cell in the top left
        this.fetchData(
            Math.min(0, x - this.offset)
            x + this.max_num_rows + this.offset,
            Math.min(0, y - this.offset),
            y + this.max_num_columns + this.offset,
            "replace",
            null
        )
    }
    /* Helper functions to determine a 'reasonable' number of columns and rows
     * for the current view. For the moment we use window.innerHeight and
     * window.innerWidth divided by the number provided height and width of the
     * rows, columns, respecitively and then add a bit more for lazy loading.
     * TODO: this uses the entire window which a table will almost never take up
     */
    _calc_max_num_rows(){
        return Math.ceil(window.innerHeight/this.props.rowHeight + this.offset);
    }

    _calc_max_num_columns(){
        return Math.ceil(window.innerWidth/this.props.colWidth + this.offset);
    }
    /// OLD HORROR - TODO: remove when ready!
    //----------------------------------------
    old_initializeHooks(){
        Handsontable.hooks.add("beforeOnCellMouseDown", (event, data) => {
            let handsOnObj = handsOnTables[this.props.id];
            let lastRow = handsOnObj.lastCellClicked.row;
            let lastCol = handsOnObj.lastCellClicked.col;

            if((lastRow == data.row) && (lastCol = data.col)){
                handsOnObj.dblClicked = true;
                setTimeout(() => {
                    if(handsOnObj.dblClicked){
                        cellSocket.sendString(JSON.stringify({
                            event: 'onCellDblClick',
                            target_cell: this.props.id,
                            row: data.row,
                            col: data.col
                        }));
                    }
                    handsOnObj.lastCellClicked = {row: -100, col: -100};
                    handsOnObj.dblClicked = false;
                }, 200);
            } else {
                handsOnObj.lastCellClicked = {row: data.row, col: data.col};
                setTimeout(() => {
                    handsOnObj.lastCellClicked = {row: -100, col: -100};
                    handsOnObj.dblClicked = false;
                }, 600);
            }
        }, this.currentTable);

        Handsontable.hooks.add("beforeOnCellContextMenu", (event, data) => {
            let handsOnObj = handsOnTables[this.props.id];
            handsOnObj.dblClicked = false;
            handsOnObj.lastCellClicked = {row: -100, col: -100};
        }, this.currentTable);

        Handsontable.hooks.add("beforeContextMenuShow", (event, data) => {
            let handsOnObj = handsOnTables[this.props.id];
            handsOnObj.dblClicked = false;
            handsOnObj.lastCellClicked = {row: -100, col: -100};
        }, this.currentTable);
    }

    makeError(){
        if(this.usesReplacements){
            return this.getReplacementElementFor('error');
        } else {
            return this.renderChildNamed('error');
        }
    }
    //----------------------------------------
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
    rowCount: {
        description: "Number of rows.",
        type: PropTypes.oneOf([PropTypes.number])
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
        let row_data = this.props.row_data.map((item) => {
            return new SheetCell(
                {id: this.props.id, data: item, width: this.props.colWidth}).build()
        })
        // NOTE: we handle the row index name td cell seperately here
        row_data.unshift(h("td", {class: "row-index-item"}, [this.props.rowIndexName.toString()]))
        return (
            h("tr",
                {class: "sheet-row", style: this.style},
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
    },
    rowIndexName: {
        description: "String or number representing the row index.",
        type: PropTypes.oneOf([PropTypes.number, PropTypes.string])
    }
};

class SheetCell extends Component {
    constructor(props, ...args){
        super(props, ...args);
        this.style = `max-width: ${this.props.width}px; width: ${this.props.width}px`

        // Bind component methods
        this.onHover = this.onHover.bind(this);
    }

    componentDidLoad(){
    }

    build(){
        return (
            h("td",
                {class: "sheet-cell", style: this.style, onhover: this.onhover},
                [this.props.data.toString()]
            )
        );
    }

    onHover(){
        console.log(this.props.data)
        // TODO: build a nice hover over view
    }
}

SheetCell.propTypes = {
    data: {
        description: "Text to display",
        type: PropTypes.oneOf([ PropTypes.string])
    },
    width: {
        description: "Width of the cell in pixels.",
        type: PropTypes.oneOf([PropTypes.number])
    },
};


export {Sheet, Sheet as default};
