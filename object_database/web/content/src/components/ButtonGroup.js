/**
 * ButtonGroup Cell Cell
 */

import {makeDomElt as h} from './Cell';
import {ConcreteCell} from './ConcreteCell';

/**
 * About Named Children
 * --------------------
 * `buttons` (array) - The constituent button cells
 */
class ButtonGroup extends ConcreteCell {
    constructor(props, ...args){
        super(props, ...args);

        // Bind Cell methods
        this.makeButtons = this.makeButtons.bind(this);
    }

    build(){
        return(
            h('div', {
                id: this.getElementId(),
                "data-cell-id": this.identity,
                "data-cell-type": "ButtonGroup",
                class: "btn-group",
                "role": "group"
                },
                this.makeButtons()
            )
        );
    }

    makeButtons(){
        return this.renderChildrenNamed('buttons');
    }

}

export {ButtonGroup, ButtonGroup as default};
