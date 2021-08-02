/**
 * Grid Cell Cell
 */

import {makeDomElt as h} from './Cell';
import {ConcreteCell} from './ConcreteCell';

/**
 * About Named Children
 * --------------------
 * `headers` (array) - An array of table header cells
 * `rowLabels` (array) - An array of row label cells
 * `dataCells` (array-of-array) - A 2-dimensional array
 *     of cells that serve as table data, where rows
 *     are the outer array and columns are the inner
 *     array.
 */
class Grid extends ConcreteCell {
    constructor(props, ...args){
        super(props, ...args);

        // Bind context to methods
        this.makeHeaders = this.makeHeaders.bind(this);
        this.makeRows = this.makeRows.bind(this);
    }

    _computeFillSpacePreferences() {
        return {horizontal: true, vertical: true};
    }

    build(){
        let topTableHeader = null;
        if(this.props.hasTopHeader){
            topTableHeader = h('th');
        }
        return (
            h('table', {
                id: this.getElementId(),
                "data-cell-id": this.identity,
                "data-cell-type": "Grid",
                class: "cell table-sm table-striped cell-grid"
            }, [
                h('thead', {}, [
                    h('tr', {}, [topTableHeader, ...this.makeHeaders()])
                ]),
                h('tbody', {}, this.makeRows())
            ])
        );
    }

    makeHeaders(){
        return this.renderChildrenNamed('headers').map((headerEl, colIdx) => {
            return (
                h('th', {key: `${this.identity}-grid-th-${colIdx}`}, [
                    headerEl
                ])
            );
        });
    }

    makeRows(){
        let rowLabels = this.renderChildrenNamed('rowLabels');

        return this.renderChildrenNamed('dataCells').map((dataRow, rowIdx) => {
            let columns = dataRow.map((column, colIdx) => {
                return(
                    h('td', {key: `${this.identity}-grid-col-${rowIdx}-${colIdx}`}, [
                        column
                    ])
                );
            });
            let rowLabelEl = null;
            if(this.namedChildren.rowLabels && this.namedChildren.rowLabels.length > 0){
                rowLabelEl = h('th', {key: `${this.identity}-grid-col-${rowIdx}`}, [
                    rowLabels[rowIdx]
                ]);
            }

            return (
                h('tr', {key: `${this.identity}-grid-row-${rowIdx}`}, [
                    rowLabelEl,
                    ...columns
                ])
            );
        });
    }
}

export
{Grid, Grid as default};
