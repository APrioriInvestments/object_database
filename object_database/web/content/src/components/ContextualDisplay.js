/**
 * ContextualDisplay Cell Cell
 */

import {makeDomElt as h} from './Cell';
import {ConcreteCell} from './ConcreteCell';

/**
 * About Named Children
 * --------------------
 * `child` (single) - A child cell to display in a context
 */
class ContextualDisplay extends ConcreteCell {
    constructor(props, ...args){
        super(props, ...args);

        // Bind Cell methods
        this.makeChild = this.makeChild.bind(this);
    }

    build(){
        return h('div',
            {
                class: "cell contextual-display",
                id: this.getElementId(),
                "data-cell-id": this.identity,
                "data-cell-type": "ContextualDisplay",
                "data-context-object": this.props.objectType
            }, [this.makeChild()]
        );
    }

    makeChild(){
        return this.renderChildNamed('child');
    }
}

export {ContextualDisplay, ContextualDisplay as default};
