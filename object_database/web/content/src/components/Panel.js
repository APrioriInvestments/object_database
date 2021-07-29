/**
 * Panel Cell Cell
 */

import {makeDomElt as h} from './Cell';
import {ConcreteCell} from './ConcreteCell';

/**
 * About Named Children
 * --------------------
 * `content` (single) - The content Cell in the Panel
 */
class Panel extends ConcreteCell {
    constructor(props, ...args){
        super(props, ...args);

        // Bind Cell methods
        this.getClasses = this.getClasses.bind(this);
    }

    build(){
        return h('div', {
            id: this.getElementId(),
            "data-cell-id": this.identity,
            "data-cell-type": "Panel",
            class: this.getClasses()
        }, [this.renderChildNamed('content')]);
    }

    getClasses(){
        if (this.props.applyBorder) {
            return "cell cell-panel cell-panel-border";
        } else {
            return "cell cell-panel";
        }
    }
}

export {
    Panel,
    Panel as default
};
