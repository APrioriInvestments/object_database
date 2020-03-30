/**
 * TablePage Cell Component
 */
import {Component} from './Component';
import {PropTypes} from './util/PropertyValidator';
import {h} from 'maquette';

/**
 * About Named Children
 * --------------------
 * `rows` (array) - A list of TableRow
 * Components.
 */
class TablePage extends Component {
    constructor(props, ...args){
        super(props, ...args);
    }

    build(){
        return(
            h('tbody', {
                id: this.getElementId(),
                class: 'cell table-page',
                'data-cell-id': this.props.id,
                'data-cell-type': "TablePage",
                'data-page-num': this.props.pageNum.toString()
            }, this.renderChildrenNamed('rows'))
        );
    }
}

TablePage.propTypes = {
    maxRows: {
        type: PropTypes.number,
        description: "The maximum number of rows that the table should display"
    },
    rowSize: {
        type: PropTypes.number,
        description: "The actual number of rows that will be displayed"
    },
    pageNum: {
        type: PropTypes.number,
        description: "The current page number this page corresponds to in its parent"
    }
};

export {
    TablePage as default,
    TablePage
};
