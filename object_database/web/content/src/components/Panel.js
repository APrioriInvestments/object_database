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

    _computeFillSpacePreferences() {
        return this.namedChildren['content'].getFillSpacePreferences();
    }

    allotedSpaceIsInfinite(child) {
        return this.parent.allotedSpaceIsInfinite(this);
    }

    getClasses(){
        let res = 'cell allow-child-to-fill-space cell-panel';

        if (this.props.applyBorder) {
            return res + " cell-panel-border";
        } else {
            return res;
        }
    }
}

export {
    Panel,
    Panel as default
};
