/**
 * Span Cell Cell
 */

import {makeDomElt as h} from './Cell';
import {ConcreteCell} from './ConcreteCell';

class Span extends ConcreteCell {
    constructor(props, ...args){
        super(props, ...args);
    }

    build(){
        return (
            h('span', {
                id: this.getElementId(),
                "data-cell-id": this.identity,
                "data-cell-type": "Span",
                class: "cell"
            }, [this.props.text])
        );
    }
}

export {Span, Span as default};
