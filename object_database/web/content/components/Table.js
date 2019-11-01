/**
 * Table Cell Component
 */

import {Component} from './Component';
import {PropTypes} from './util/PropertyValidator';
import {h} from 'maquette';

/**
 * About Named Children
 * --------------------
 * `headers` (array) - An array of table header cells
 * `dataCells` (array-of-array) - A 2-dimensional array
 *    structures as rows by columns that contains the
 *    table data cells
 * `page` (single) - A cell that tells which page of the
 *     table we are looking at
 * `left` (single) - A cell that shows the number on the left
 * `right` (single) - A cell that show the number on the right
 */
class Table extends Component {
    constructor(props, ...args){
        super(props, ...args);

        // Bind context to methods
        this.makeRows = this.makeRows.bind(this);
        this.makeFirstRow = this.makeFirstRow.bind(this);
        this._makeRowElements = this._makeRowElements.bind(this);
        this._getRowDisplayElements = this._getRowDisplayElements.bind(this);
        this._getPageInfo = this._getPageInfo.bind(this);
    }

    build(){
        console.dir(this.props.children);
        console.dir(this.props);
        return(
            h('table', {
                id: this.props.id,
                "data-cell-id": this.props.id,
                "data-cell-type": "Table",
                class: "cell cell-table table-hscroll table-sm table-striped"
            }, [
                h('thead', {},[
                    this.makeFirstRow()
                ]),
                h('tbody', {}, this.makeRows())
            ])
        );
    }

    makeHeaderElements(){
        return this.renderChildrenNamed('headers').map((replacement, idx) => {
            return h('th', {
                style: "vertical-align:top;",
                key: `${this.props.id}-table-header-${idx}`
            }, [replacement]);
        });
    }

    makeRows(){
        return this._makeRowElements(this.renderChildrenNamed('dataCells'));
    }

    _makeRowElements(elements){
        // Note: rows are the *first* dimension
        // in the 2-dimensional array returned
        // by getting the `child` replacement elements.
        return elements.map((row, rowIdx) => {
            let columns = row.map((childElement, colIdx) => {
                return (
                    h('td', {
                        key: `${this.props.id}-td-${rowIdx}-${colIdx}`
                    }, [childElement])
                );
            });
            let pageRows = (this.props.currentPage - 1) * this.props.rowsPerPage;
            let relativeIndex = rowIdx + 1 + pageRows;
            let indexElement = h('td', {}, [`${relativeIndex}`]);
            return (
                h('tr', {key: `${this.props.id}-tr-${rowIdx}`}, [indexElement, ...columns])
            );
        });
    }

    makeFirstRow(){
        let headerElements = this.makeHeaderElements();
        return(
            h('tr', {}, [
                h('th', {}, [...this._getRowDisplayElements()]),
                ...headerElements
            ])
        );
    }

    _getRowDisplayElements(){
        return [
            this.renderChildNamed('left'),
            this._getPageInfo(),
            this.renderChildNamed('right')
        ];
    }

    _getPageInfo(){
        let count = `${this.props.currentPage} of ${this.props.totalPages}`;
        return h('div', {class: 'cell-table-page-info'}, [count]);
    }
}

Table.propTypes = {
    totalPages: {
        type: PropTypes.number,
        description: "Total number of pages the Table can display"
    },
    currentPage: {
        type: PropTypes.number,
        description: "The current page number being displayed"
    },
    numColumns: {
        type: PropTypes.number,
        description: "The total number of columns the table has"
    },
    numRows: {
        type: PropTypes.number,
        description: "The total number of rows the table has"
    },
    rowsPerPage: {
        type: PropTypes.number,
        description: "The maximum number of rows to display on teach page"
    }
}

export {Table, Table as default};
