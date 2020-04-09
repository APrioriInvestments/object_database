/**
 * Table Cell Component
 */
import {Component} from './Component';
import {h} from 'maquette';

/**
 * About Named Children
 * --------------------
 * `header` (single) - The thead area,
 * which should usually be a TableHeader
 * component
 * `page` (single) - The current tbody
 * area, which should usually be a
 * TablePage component
 */
class Table extends Component {
    constructor(props, ...args){
        super(props, ...args);
    }

    build(){
        return(
            h('table', {
                id: this.getElementId(),
                class: 'cell cell-table table-hscroll table-sm table-striped',
                'data-cell-id': this.props.id,
                'data-cell-type': "Table"
            }, [
                this.renderChildNamed('header'),
                this.renderChildNamed('page')
            ])
        );
    }
};

export {
    Table as default,
    Table
};
