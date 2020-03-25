/**
 * TableHeader Cell Component
 */
import {Component} from './Component';
import {PropTypes} from './util/PropertyValidator';
import {h} from 'maquette';

/**
 * About Named Children
 * --------------------
 * `headerItems` (array) - A list of header item Cells
 * `paginator` (single) - A TablePaginator cell
 */
class TableHeader extends Component {
    constructor(props, ...args){
        super(props, ...args);

        // Bind component methods
        this.makeHeaderRow = this.makeHeaderRow.bind(this);
    }

    render(){
        return(
            h('thead', {
                id: this.getElementId(),
                "data-cell-id": this.props.id,
                "data-cell-type": "TableHeader"
            }, [this.makeHeaderRow()])
        );
    }

    makeHeaderRow(){
        let paginator = h('th', {
            class: 'table-header-item'
        }, [this.renderChildNamed('paginator')]);
        let headerItemElements = this.renderChildrenNamed('headerItems');
        /*let wrapped = headerItemElements.map(velement => {
            return h('th', {
                class: 'table-header-item'
            }, [velement]);
            });*/
        let wrapped = headerItemElements;
        return h('tr', {
            class: 'table-header-row'
        }, [paginator, ...wrapped]);
    }
};

export {
    TableHeader as default,
    TableHeader
};
