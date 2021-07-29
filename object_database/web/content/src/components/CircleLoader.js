/**
 * CircleLoader Cell Cell
 */

import {makeDomElt as h} from './Cell';
import {ConcreteCell} from './ConcreteCell';


class CircleLoader extends ConcreteCell {
    constructor(props, ...args){
        super(props, ...args);
    }

    build(){
        return (
            h('div', {
                id: this.getElementId(),
                "data-cell-id": this.identity,
                "data-cell-type": "CircleLoader",
                class: "spinner",
                role: "status"
            })
        );
    }
}

export {CircleLoader, CircleLoader as default};
