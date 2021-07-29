/**
 * CardTitle Cell
 */

import {makeDomElt as h} from './Cell';
import {ConcreteCell} from './ConcreteCell';

/**
 * About Named Children
 * --------------------
 * `inner` (single) - The inner cell of the title Cell
 */
class CardTitle extends ConcreteCell {
    constructor(props, ...args){
        super(props, ...args);

        // Bind Cell methods
        this.makeInner = this.makeInner.bind(this);
    }

    build(){
        return(
            h('div', {
                id: this.getElementId(),
                class: "cell",
                "data-cell-id": this.identity,
                "data-cell-type": "CardTitle"
            }, [
                this.makeInner()
            ])
        );
    }

    makeInner(){
        return this.renderChildNamed('inner');
    }
}

export {CardTitle, CardTitle as default};
