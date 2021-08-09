/**
 * Padding Cell Cell
 */

import {makeDomElt as h} from './Cell';
import {ConcreteCell} from './ConcreteCell';

class Padding extends ConcreteCell {
    constructor(props, ...args){
        super(props, ...args);
    }

    build(){
        return (
            h('span', {
                id: this.getElementId(),
                "data-cell-id": this.identity,
                "data-cell-type": "Padding",
                class: "horizontal-padding"
            }, [" "])
        );
    }
}

export {Padding, Padding as default};
