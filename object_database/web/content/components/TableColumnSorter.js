/**
 * TableColumnSorter Cell Component
 */
import {Component} from './Component';
import {h} from 'maquette';

/**
 * About Named Children
 * --------------------
 * `button` (single) - The child
 * Clickable/Button used for sorting
 */
class TableColumnSorter extends Component {
    constructor(props, ...args){
        super(props, ...args);
    }

    render(){
        return(
            h('div', {
                id: this.getElementId(),
                class: 'cell table-column-sorter',
                'data-cell-id': this.props.id,
                'data-cell-type': "TableColumnSorter"
            }, [this.renderChildNamed('button')])
        );
    }
}

export {
    TableColumnSorter as default,
    TableColumnSorter
};
