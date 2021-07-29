/**
 * Columns Cell Cell
 */

import {makeDomElt as h} from './Cell';
import {ConcreteCell} from './ConcreteCell';

/**
 * About Named Children
 * --------------------
 * `elements` (array) - Cell column elements
 */
class Columns extends ConcreteCell {
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
                "data-cell-id": this.identity,
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
