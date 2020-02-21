/**
 * Columns Cell Component
 */

import {Component} from './Component';
import {h} from 'maquette';

/**
 * About Named Children
 * --------------------
 * `elements` (array) - Cell column elements
 */
class Columns extends Component {
    constructor(props, ...args){
        super(props, ...args);

        // Bind context to methods
        this.makeInnerChildren = this.makeInnerChildren.bind(this);
    }

    build(){
        return (
            h('div', {
                class: "cell container-fluid",
                id: this.getElementId(),
                "data-cell-id": this.props.id,
                "data-cell-type": "Columns",
            }, [
                h('div', {class: "row flex-nowrap"}, this.makeInnerChildren())
            ])
        );
    }

    makeInnerChildren(){
        return this.renderChildrenNamed('elements');
    }
}


export {Columns, Columns as default};
