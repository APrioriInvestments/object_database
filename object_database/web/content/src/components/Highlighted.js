/**
 * Highlighted Cell Cell
 */

import {makeDomElt as h} from './Cell';
import {ConcreteCell} from './ConcreteCell';

/**
 * About Replacements
 * ------------------
 * This Cell has one regular replacement:
 * `content`
 */

/**
 * About Named Children
 * --------------------
 * `content` (single) - The cell inside of the highlight
 */
class Highlighted extends ConcreteCell {
    constructor(props, ...args){
        super(props, ...args);

        // Bind Cell methods
        this.getClasses = this.getClasses.bind(this);
    }

    build(){
        return(
            h('div', {
                id: this.getElementId(),
                "data-cell-id": this.identity,
                "data-cell-type": "Highlighted",
                class: this.getClasses()
            }, [this.renderChildNamed('content')])
        );
    }

    _computeFillSpacePreferences() {
        return this.namedChildren['content'].getFillSpacePreferences();
    }

    getClasses(){
        let classes = ["cell", "cell-highlighted", "allow-child-to-fill-space"];
        return classes.join(" ");
    }
}

export {
    Highlighted,
    Highlighted as default
};
