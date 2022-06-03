/**
 * RootCell Cell Cell
 */

import {makeDomElt as h} from './Cell';
import {ConcreteCell} from './ConcreteCell';

/**
 * About Named Children
 * --------------------
 * `child` (single) - The child cell this container contains
 */
class RootCell extends ConcreteCell {
    constructor(props, ...args){
        super(props, ...args);

        this.domElement = document.getElementById("page_root");
    }

    _computeFillSpacePreferences() {
        return {horizontal: true, vertical: false};
    }

    build() {
        return (
            h('div', {
                id: this.identity,
                "data-cell-id": this.identity,
                "data-cell-type": "RootCell",
                "class": "root-cell allow-child-to-fill-space"
            }, [
                this.renderChildNamed('child')
            ])
        );
    }
}

export {RootCell, RootCell as default};
