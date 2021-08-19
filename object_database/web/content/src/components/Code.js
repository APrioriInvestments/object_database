/**
 * Code Cell Cell
 */

import {makeDomElt as h} from './Cell';
import {ConcreteCell} from './ConcreteCell';

/**
 * About Named Children
 * --------------------
 * `code` (single) - Code that will be rendered inside
 */
class Code extends ConcreteCell {
    constructor(props, ...args){
        super(props, ...args);

        // Bind Cell methods
        this.makeCode = this.makeCode.bind(this);
    }

    build(){
        return h('pre',
                 {
                     class: "cell code cell-focus-no-outline",
                     id: this.getElementId(),
                     "data-cell-type": "Code",
                    tabindex: 0,
                     onfocus: this.focusReceived
                 }, [
                     h("code", {}, [this.makeCode()])
                 ]
                );
    }

    serverKnowsAsFocusedCell() {
        this.domElement.focus();
    }

    makeCode(){
        return this.renderChildNamed('code');
    }
}

export {Code, Code as default};
