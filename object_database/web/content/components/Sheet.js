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

        // TODO: make sure these make sense
        this.max_num_columns = this._calc_max_num_columns();
        console.log("max num of columns: " + this.max_num_columns)
        this.max_num_rows = this._calc_max_num_rows();
        console.log("max num of rows: " + this.max_num_rows)
        this.currentTable = null;
        this.current_data = null;

        // Bind context to methods
        this.initializeTable = this.initializeTable.bind(this);
        this.generate_current_rows = this.generate_current_rows.bind(this);
        this.generate_header = this.generate_header.bind(this);
        // this.initializeHooks = this.initializeHooks.bind(this);
        // this.makeError = this.makeError.bind(this);

        this.initializeTable();
    }

    componentDidLoad(){
        console.log(`#componentDidLoad called for Sheet ${this.props.id}`);
        // if(this.props.extraData['handlesDoubleClick']){
        //     this.initializeHooks();
        // }
        // Request initial data?
        // cellSocket.sendString(JSON.stringify({
        //    event: "sheet_needs_data",
        //    target_cell: this.props.id,
        //    data: 0
        //}));
    }

    initializeTable(){
        console.log(`#initializeTable called for Sheet ${this.props.id}`);
        // TODO: here we make some fake initial data but this really be an http
        // request to the server
        let data = [];
        for(var i=0; i < Math.min(this.props.rowCount, this.max_num_rows); i++){
            let row = [];
            for (var j=0; j < Math.min(this.props.columnNames.length, this.max_num_columns); j++){
                row.push(Math.random().toString())
            }
            data.push(row)
        }
        this.current_data = data;
        console.log(data);
    }


    build(){
        console.log(`Rendering custom sheet ${this.props.id}`);
        return (
            h("div", {
                id: this.props.id,
                "data-cell-id": this.props.id,
                "data-cell-type": "Sheet",
                class: "cell sheet-wrapper",
            }, [
                h("table", {class: "sheet"}, [
                    h("thead", {}, this.generate_header(0, this.max_num_columns)), //TODO: this should be dynamic and paginated
                    h("tbody", {}, this.generate_current_rows())
                ])
            ])
        );
    }

    generate_header(start, end){
        let header = this.props.columnNames.slice(start, end).map((item) => {
            return h("th", {class: "header-item"}, [item])
        })
        // NOTE: we add one more column to account for the row index
        header.unshift(h("th", {class: "header-item"}, []))
        return (
            h("tr"), {}, [
                header
            ]
        )
    }

    generate_current_rows(){
        let rows = this.current_data.map((item, index) => {
            return (
                new SheetRow(
                    {
                        id: this.props.id,
                        row_data: item,
                        colWidth: this.props.colWidth,
                        height: this.props.rowHeight,
                        numColumns: this.props.columnNames.length,
                        rowIndexName: index  //TODO: note currently the row name is simply index
                    }
                ).build()
            )
        })
        return rows;
    }

    /* Helper functions to determine a 'reasonable' number of columns and rows
     * for the current view. For the moment we use window.innerHeight and
     * window.innerWidth divided by the number provided height and width of the
     * rows, columns, respecitively and then add a bit more for lazy loading.
     * TODO: this uses the entire window which a table will almost never take up
     */
    _calc_max_num_rows(){
        return Math.ceil(window.innerHeight/this.props.rowHeight + 10);
    }

    _calc_max_num_columns(){
        return Math.ceil(window.innerWidth/this.props.colWidth + 10);
    }
    /// OLD HORROR - TODO: remove when ready!
    //----------------------------------------
    old_build(){
        console.log(`Rendering sheet ${this.props.id}`);
        return (
            h('div', {
                id: this.props.id,
                "data-cell-id": this.props.id,
                "data-cell-type": "Sheet",
                class: "cell"
            }, [
                h('div', {
                    id: `sheet${this.props.id}`,
                    class: "handsontable"
                }, [this.makeError()])
            ])
        );
    }

    old_initializeTable(){
        console.log(`#initializeTable called for Sheet ${this.props.id}`);
        let getProperty = function(index){
            return function(row){
                return row[index];
            };
        };
        let emptyRow = [];
        let dataNeededCallback = function(eventObject){
            eventObject.target_cell = this.props.id;
            cellSocket.sendString(JSON.stringify(eventObject));
        }.bind(this);
        let data = new SyntheticIntegerArray(this.props.extraData.rowCount, emptyRow, dataNeededCallback);
        let container = document.getElementById(`sheet${this.props.id}`);
        let columnNames = this.props.extraData.columnNames;
        let columns = columnNames.map((name, idx) => {
            emptyRow.push("");
            return {data: getProperty(idx)};
        });

        this.currentTable = new Handsontable(container, {
            data,
            dataSchema: function(opts){return {};},
            colHeaders: columnNames,
            columns,
            rowHeaders:true,
            rowHeaderWidth: 100,
            viewportRowRenderingOffset: 100,
            autoColumnSize: false,
            autoRowHeight: false,
            manualColumnResize: true,
            colWidths: this.props.extraData.columnWidth,
            rowHeights: 23,
            readOnly: true,
            ManualRowMove: false
        });
        handsOnTables[this.props.id] = {
            table: this.currentTable,
            lastCellClicked: {row: -100, col: -100},
            dblClicked: true
        };
    }

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
    colWidth: {
        description: "Width of the column (and cell) in pixels.",
        type: PropTypes.oneOf([PropTypes.number])
    },
    rowIndexName: {
        description: "Width of the column (and cell) in pixels.",
        type: PropTypes.oneOf([PropTypes.number, PropTypes.string])
    }
};

class SheetCell extends Component {
    constructor(props, ...args){
        super(props, ...args);
        this.style = `max-width: ${this.props.width}px; width: ${this.props.width}px`
    }

    componentDidLoad(){
    }

    build(){
        return (
            h("td",
                {class: "sheet-cell", style: this.style},
                [this.props.data]
            )
        );
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

/// OLD HORROR - TODO: remove when ready!
//----------------------------------------
/** Copied over from Cells implementation **/
const SyntheticIntegerArray = function(size, emptyRow = [], callback){
    this.length = size;
    this.cache = {};
    this.push = function(){};
    this.splice = function(){};

    this.slice = function(low, high){
        if(high === undefined){
            high = this.length;
        }

        let res = Array(high - low);
        let initLow = low;
        while(low < high){
            let out = this.cache[low];
            if(out === undefined){
                if(callback){
                    callback({
                        event: 'sheet_needs_data',
                        data: low
                    });
                }
                out = emptyRow;
            }
            res[low - initLow] = out;
            low += 1;
        }
        return res;
    };
};
//----------------------------------------

export {Sheet, Sheet as default};
