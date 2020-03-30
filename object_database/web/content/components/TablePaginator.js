/**
 * TablePaginator Cell Component
 */
import {Component} from './Component';
import {PropTypes} from './util/PropertyValidator';
import {h} from 'maquette';

/**
 * About Named Children
 * --------------------
 * `page` (single) - A cell representing either a Text
 * with the current page num, or an input with the
 * current page number
 * `left` (single) - The left button
 * `right` (single) - The right button
 */
class TablePaginator extends Component {
    constructor(props, ...args){
        super(props, ...args);
    }

    build(){
        let text = h('span', {
            class: 'cell-table-pages'
        }, [`of ${this.props.totalPages}`]);
        return(
            h('th', {
                id: this.getElementId(),
                class: 'cell table-paginator',
                'data-cell-id': this.props.id,
                'data-cell-type': "TablePaginator"
            }, [
                this.renderChildNamed('left'),
                this.renderChildNamed('page'),
                text,
                this.renderChildNamed('right')
            ])
        );
    }
}

TablePaginator.propTypes = {
    currentPage: {
        type: PropTypes.number,
        description: "The current page index"
    },
    totalPages: {
        type: PropTypes.number,
        description: "The total number of pages"
    }
};

export {
    TablePaginator as default,
    TablePaginator
};
