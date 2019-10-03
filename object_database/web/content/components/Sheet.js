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
        this.offset = 1;
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
        this.generate_rows = this.generate_rows.bind(this);
        this.generate_header = this.generate_header.bind(this);
        this.handleScrolling = this.handleScrolling.bind(this);
        this.handleKeyDown = this.handleKeyDown.bind(this);
        this.paginate = this.paginate.bind(this);
        this.jump_to_cell = this.jump_to_cell.bind(this);
        // this.handleClick = this.handleClick.bind(this);
        // this.initializeHooks = this.initializeHooks.bind(this);
        // this.makeError = this.makeError.bind(this);

        this.initializeTable();
    }

    componentDidLoad(){
        console.log(`#componentDidLoad called for Sheet ${this.props.id}`);
        let container = document.getElementById(this.props.id).parentNode;
        this.max_num_columns = this._calc_max_num_columns(container.offsetWidth);
        this.max_num_rows = this._calc_max_num_rows(container.offsetHeight);
        // console.log("max num of rows: " + this.max_num_rows)
        // console.log("max num of columns: " + this.max_num_columns)
        this.current_start_row_index = 0;
        this.current_start_column_index = 0;
        this.current_end_row_index = this.max_num_rows + this.offset;
        this.current_end_column_index = this.max_num_columns + this.offset;
        if (this.props.dontFetch != true){
            this.fetchData(
                this.current_start_row_index,
                this.current_end_row_index,
                this.current_start_column_index,
                this.current_end_column_index,
                "replace",
                null
            )
        }
        // console.log("max num of rows: " + this.max_num_rows)
        // if(this.props.extraData['handlesDoubleClick']){
        //     this.initializeHooks();
        // }
        // TODO do we need to add this at the document level? (seems so, but why?)
        document.addEventListener("keydown", this.handleKeyDown)
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
        let rows = ["Just a sec..."];
        return (
            h("div", {
                id: this.props.id,
                "data-cell-id": this.props.id,
                "data-cell-type": "Sheet",
                class: "cell sheet-wrapper",
                //onscroll: this.handleScrolling,
                // keydown: (e) => {console.log(e)},
                scrollTop: this.scrollTop,
                scrollLeft: this.scrollLeft
            }, [
                h("table", {class: "sheet", style: "table-layout:fixed"}, [
                    h("thead", {}, [
                        h("tr", {id: `sheet-${this.props.id}-head`}, [
                            // NOTE: we add one more column to account for the row index
                            // TODO potentially make this an input for this.jump_to_cell;
                            h("th", {class: "header-item zero"}, [])
                        ])
                    ]),
                    h("tbody", {id: `sheet-${this.props.id}-body`}, rows)
                ])
            ])
        );
    }

    /* I generate the table header.*/
    generate_header(column_names){
        let header = [];
        if (column_names === null){
            return header;
        }
        header = column_names.map((item) => {
            return h("th", {class: "header-item"}, [item.toString()])
        })
        return header;
    }

    /* I generate the rows, including the passing in row indexes (which are
     * assumed to be element row[0])
     */
    generate_rows(data){
        return data.map((item) => {
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

    /* I listen for arrow keys and call this.paginate when I see one. */

    handleKeyDown(event){
        if (event.key === "ArrowUp"){
            this.paginate("row", "prepend")
        } else if (event.key === "ArrowDown"){
            this.paginate("row", "append")
            this.scrollTop = this.props.rowHeight;
        } else if (event.key === "ArrowLeft"){
            this.paginate("column", "prepend")
        } else if (event.key === "ArrowRight"){
            this.paginate("column", "append")
        }
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
        console.log(element.scrollTop);
        // we make sure that we have the offset as buffer
        // TODO: figure out why scrollLeft can fire as 0 seemingly randomly
        if (element.scollLeft !== 0) {
            if (leftDiff > this.offset * this.props.colWidth) {
                console.log("scrolling right")
                this.paginate("column", "append")
                this.scrollLeft = element.scrollLeft;
            } else if (-1 * leftDiff > this.offset * this.props.colWidth) {
                this.scrollLeft = element.scrollLeft;
                console.log("scrolling left")
                this.paginate("column", "prepend")
            }
        }
        // TODO: figure out why scrollTop can fire as 0 seemingly randomly
        if (element.scollTop !== 0) {
            if (topDiff > this.offset * this.props.rowHeight) {
                this.paginate("row", "append")
                // console.log("element.scrollTop: " + element.scrollTop)
                // console.log(element)
                console.log("scrolling down")
                this.scrollTop = element.scrollTop;
            } else if (-1 * topDiff > this.offset * this.props.rowHeight) {
                this.paginate("row", "prepend")
                // console.log("element.scrollTop: " + element.scrollTop)
                // console.log(element)
                console.log("scrolling up")
                this.scrollTop = element.scrollTop;
            }
        }
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
                        this.current_start_row_index,
                        this.current_start_row_index + this.offset,
                        this.current_start_column_index,
                        this.current_end_column_index,
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
                        this.current_start_row_index,
                        this.current_end_row_index,
                        this.current_start_column_index,
                        this.current_start_column_index + this.offset,
                        "prepend",
                        "column"
                    )
                }
            }
        } else if (action === "append") {
            if (axis === "row") {
                this.fetchData(
                    this.current_end_row_index,
                    this.current_end_row_index + this.offset,
                    this.current_start_column_index,
                    this.current_end_column_index,
                    "append",
                    "row"
                )
                this.current_end_row_index = this.current_end_row_index + this.offset
                this.current_start_row_index = this.current_start_row_index + this.offset
            } else if (axis === "column") {
                this.fetchData(
                    this.current_start_row_index,
                    this.current_end_row_index,
                    this.current_end_column_index,
                    this.current_end_column_index + this.offset,
                    "append",
                    "column"
                )
                this.current_start_column_index = this.current_start_column_index + this.offset
                this.current_end_column_index = this.current_end_column_index + this.offset
            }
        }
    }

    /* I make WS requests to the server */
    fetchData(start_row, end_row, start_column, end_column, action, axis){
        let request = JSON.stringify({
            event: "sheet_needs_data",
            target_cell: this.props.id,
            start_row: start_row,
            end_row: end_row,
            start_column: start_column,
            end_column: end_column,
            action: action,
            axis: axis
        });
        console.log(request);
        cellSocket.sendString(request);
    }

    /* I handle data updating for the Sheet. I need to know whether
     * this is a `replace` or a `row` or `column` type of update.
     * If it is `row` or `column` I need to know the direction `prepend`
     * or `append`.
     */
    _updateData(dataInfo, projector) {
        console.log("updating data for sheet: " + this.props.id)
        console.log(dataInfo.data);
        // make sure the data is not empty
        let body = document.getElementById(`sheet-${this.props.id}-body`)
        let head = document.getElementById(`sheet-${this.props.id}-head`)
        if (dataInfo.data && dataInfo.data.length){
            if (dataInfo.action === "replace") {
                body.firstChild.remove()
                this.generate_rows(dataInfo.data).map((row) => {
                    projector.append(body, () => {return row})
                })
                this.generate_header(dataInfo.column_names).map((col) => {
                    projector.append(head, () => {return col})
                })

            } else if (dataInfo.action === "prepend") {
                if (dataInfo.axis === "row") {
                    // note we pop off from the end the same number of rows as we prepend
                    for (let i = 0; i < this.offset; i++){
                          body.lastChild.remove();
                    }
                    let first_row = body.firstChild;
                    this.generate_rows(dataInfo.data).map((row) => {
                        projector.insertBefore(first_row, () => {return row})
                    })
                } else if (dataInfo.axis === "column") {
                    // make sure that we have the same number of rows coming as before
                    if (body.children.length !== dataInfo.data.length) {
                         throw "Incoming number of rows don't match current sheet"
                    }
                    // NOTE: we remove N columns we remove N elements from the each row; then we add columns by
                    // appending all the new row data with a new SheetData h-element to each row
                    for (let r_index = 0; r_index < body.children.length; r_index++){
                        let row = body.children[r_index];
                        // Don't forget we keep the index element (firstChild)
                        for (let i = 0; i < this.offset ; i++){
                              row.lastChild.remove();
                        }
                        let data_row = dataInfo.data[r_index];
                        if (dataInfo.column_names.length !== data_row.length - 1) { //ingore the row index
                            throw (
                                `Incoming row length does not incoming number of columns.
                                Column Names: ${dataInfo.column_names.length}; Row: ${data_row.length - 1}`
                          )
                        }
                        // check that row indices match up
                        if (row.children[0].textContent != data_row[0]){
                            throw (
                                `Sheet row index ${row.children[0].textContent} does not match incoming
                                row index ${data_row[0]}`
                            )
                        }
                        // recall we skip the first row item which is the index
                        for (let c_index = 1; c_index < data_row.length; c_index++){
                            // TODO check that indeces match up
                            let item = data_row[c_index];
                            let cell = new SheetCell(
                            {
                                id: this.props.id, data: item, width: this.props.colWidth
                            }).build()

                            projector.insertBefore(row.children[1], () => {return cell})
                        }
                    }
                    // now the columns
                    for (let i = 0; i < this.offset; i++){
                          head.lastChild.remove();
                    }
                    let first_column = head.children[1]; // NOTE: this first element is a placehold
                    this.generate_header(dataInfo.column_names).map((col) => {
                        projector.insertBefore(first_column, () => {return col})
                    })
                }
            } else if (dataInfo.action === "append") {
                if (dataInfo.axis === "row") {
                    // note we pop off from the top the same number of rows as we append
                    for (let i = 0; i < this.offset; i++){
                          body.firstChild.remove();
                    }
                    this.generate_rows(dataInfo.data).map((row) => {
                        projector.append(body, () => {return row})
                    })
                } else if (dataInfo.axis === "column") {
                    // make sure that we have the same number of rows coming as before
                    if (body.children.length !== dataInfo.data.length) {
                         throw "Incoming number of rows don't match current sheet"
                    }
                    // NOTE: we remove N columns we remove N elements from the each row; then we add columns by
                    // appending all the new row data with a new SheetData h-element to each row
                    for (let r_index = 0; r_index < body.children.length; r_index++){
                        let row = body.children[r_index];
                        // Don't forget we keep the index element (firstChild)
                        for (let c_index = 1; c_index < this.offset + 1; c_index++){
                              row.children[c_index].remove();
                        }
                        let data_row = dataInfo.data[r_index];
                        if (dataInfo.column_names.length !== data_row.length - 1) {
                             throw (
                                 `Incoming row length does not incoming number of columns.
                                 Column Names: ${dataInfo.column_names.length}; Row: ${data_row.length - 1}`
                             )
                        }
                        // check that row indices match up
                        if (row.children[0].textContent != data_row[0]){
                            throw (
                                `Sheet row index ${row.children[0].textContent} does not match incoming
                                row index ${data_row[0]}`
                            )
                        }
                        // recall we skip the first row item which is the index
                        for (let c_index = 1; c_index < data_row.length; c_index++){
                            // TODO check that indeces match up
                            let item = data_row[c_index];
                            let cell = new SheetCell(
                            {
                                id: this.props.id, data: item, width: this.props.colWidth
                            }).build()

                            projector.append(row, () => {return cell})
                        }
                    }
                    // now update the header
                    for (let c_index = 1; c_index < this.offset + 1; c_index++){
                        head.children[c_index].remove();
                    }
                    this.generate_header(dataInfo.column_names).map((col) => {
                        projector.append(head, () => {return col})
                    })
                }
            }
        }
    }

    /* I allow this user to jump to a specific cell, putting it at the top
     * left, i.e. coordinate (0, 0), on the screen
     */
    jump_to_cell(x, y){
        // TODO this won't exactly get the requested cell in the top left
        this.fetchData(
            Math.min(0, x - this.offset),
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
    _calc_max_num_rows(max_height){
        return Math.ceil(max_height/this.props.rowHeight + this.offset);
    }

    _calc_max_num_columns(max_width){
        return Math.ceil(max_width/this.props.colWidth + this.offset);
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
