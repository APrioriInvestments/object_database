/**
 * Grid Cell Component
 */

import {Component} from './Component';
import {h} from 'maquette';

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
class Grid extends Component {
    constructor(props, ...args){
        super(props, ...args);

        // Bind context to methods
        this.makeHeaders = this.makeHeaders.bind(this);
        this.makeRows = this.makeRows.bind(this);
    }

    build(){
        let topTableHeader = null;
        if(this.props.hasTopHeader){
            topTableHeader = h('th');
        }
        return (
            h('table', {
                id: this.getElementId(),
                "data-cell-id": this.props.id,
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
                h('th', {key: `${this.props.id}-grid-th-${colIdx}`}, [
                    headerEl
                ])
            );
        });
    }

    makeRows(){
        return this.renderChildrenNamed('dataCells').map((dataRow, rowIdx) => {
            let columns = dataRow.map((column, colIdx) => {
                return(
                    h('td', {key: `${this.props.id}-grid-col-${rowIdx}-${colIdx}`}, [
                        column
                    ])
                );
            });
            let rowLabelEl = null;
            if(this.props.namedChildren.rowLabels && this.props.namedChildren.rowLabels.length > 0){
                rowLabelEl = h('th', {key: `${this.props.id}-grid-col-${rowIdx}`}, [
                    this.props.namedChildren.rowLabels[rowIdx].render()
                ]);
            }
            return (
                h('tr', {key: `${this.props.id}-grid-row-${rowIdx}`}, [
                    rowLabelEl,
                    ...columns
                ])
            );
        });
    }
}

export
{Grid, Grid as default};
