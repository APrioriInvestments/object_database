/**
 * Traceback Cell Cell
 */

import {makeDomElt as h} from './Cell';
import {ConcreteCell} from './ConcreteCell';

/**
 * About Named Children
 * `traceback` (single) - The cell containing the traceback text
 */
class Traceback extends ConcreteCell {
    constructor(props, ...args){
        super(props, ...args);
    }

    build(){
        return (
            h('div', {
                id: this.getElementId(),
                "data-cell-id": this.identity,
                "data-cell-type": "Traceback",
                class: "alert alert-primary traceback cell-focus-no-outline",
                tabindex: 0,
                onfocus: this.focusReceived
            }, [this.renderChildNamed('traceback')])
        );
    }

    serverKnowsAsFocusedCell() {
        this.domElement.focus();
    }

}


export {Traceback, Traceback as default};
