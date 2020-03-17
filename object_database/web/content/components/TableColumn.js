/**
 * TableColumn Cell Component
 */
import {Component} from './Component';
import {h} from 'maquette';

/**
 * About Named Children
 * --------------------
 * `display` (single) - The cell structure that
 * is the display content of the TableColumn header
 * area
 */
class TableColumn extends Component {
    constructor(props, ...args){
        super(props, ...args);

        // Bind component methods
        this.makeDisplay = this.makeDisplay.bind(this);
    }

    render(){
        return(
            h('th', {
                id: this.getElementId(),
                class: 'cell table-column',
                'data-cell-id': this.props.id,
                'data-cell-type': "TableColumn"
            }, [this.makeDisplay()])
        );
    }

    makeDisplay(){
        return this.renderChildNamed('display');
    }
}

export {
    TableColumn as default,
    TableColumn
};
