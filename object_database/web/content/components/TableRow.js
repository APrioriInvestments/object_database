/**
 * TableRow Cell Component
 */
import {Component} from './Component';
import {PropTypes} from './util/PropertyValidator';
import {h} from 'maquette';

/**
 * About Named Children
 * --------------------
 * `elements` (array) - A list of data element
 * Cell/Components that will be the cells of
 * the row.
 */
class TableRow extends Component {
    constructor(props, ...args){
        super(props, ...args);

        // Bind component methods
        this.makeElements = this.makeElements.bind(this);
    }

    build(){
        return(
            h('tr', {
                id: this.getElementId(),
                class: 'cell table-row',
                'data-cell-id': this.props.id,
                'data-cell-type': "TableRow",
                'data-row-index': this.props.index.toString()
            }, this.makeElements())
        );
    }

    /**
     * Wraps the child Component elements
     * in a td
     */
    makeElements(){
        let childElements = this.renderChildrenNamed('elements').map(velement => {
            return h('td', {}, [velement]);
        });

        // We add a td at the beginning representing
        // the row index. This occupies the first
        // column.
        let firstElement = h('td', {}, [this.props.index.toString()]);
        childElements.unshift(firstElement);
        return childElements;
    }
}

TableRow.propTypes = {
    index: {
        type: PropTypes.number,
        description: "The index of the row in the current TablePage"
    }
};

export {
    TableRow as default,
    TableRow
};
