/**
 * RootCell Cell Cell
 */

import {Cell, replaceChildren, makeDomElt} from './Cell';

/**
 * About Named Children
 * --------------------
 * `child` (single) - The child cell this container contains
 */
class RootCell extends Cell {
    constructor(props, ...args){
        super(props, ...args);
    }

    buildDomElementInner() {
        return (
            makeDomElt('div', {
                id: this.identity,
                "data-cell-id": this.identity,
                "data-cell-type": "RootCell",
                "class": "allow-child-to-fill-space"
            }, [this.namedChildren['child'].buildDomElement()])
        );
    }

    rebuildDomElement() {
        // we changed. rebuild ourselves
        var dom = this.getDOMElement();

        var childDom = this.namedChildren['child'].buildDomElement();

        replaceChildren(dom, [childDom]);
    }

    childChanged() {
        this.rebuildDomElement();
    }

    getDOMElement(){
        // Override default behavior, since
        // id is always "root_cell"
        return document.getElementById(this.identity);
    }
}

export {RootCell, RootCell as default};
