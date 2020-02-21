/**
 * ContextualDisplay Cell Component
 */

import {Component} from './Component';
import {h} from 'maquette';

/**
 * About Named Children
 * --------------------
 * `child` (single) - A child cell to display in a context
 */
class ContextualDisplay extends Component {
    constructor(props, ...args){
        super(props, ...args);

        // Bind component methods
        this.makeChild = this.makeChild.bind(this);
    }

    build(){
        return h('div',
            {
                class: "cell contextual-display",
                id: this.getElementId(),
                "data-cell-id": this.props.id,
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
