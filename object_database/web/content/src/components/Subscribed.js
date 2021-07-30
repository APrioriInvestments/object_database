/**
 * Subscribed Cell Cell
 * -------------------------
 */
import {Cell, render, makeDomElt} from './Cell';


class Subscribed extends Cell {
    constructor(props, ...args){
        super(props, ...args);
    }

    childChanged(node) {
        this.parent.childChanged(this);
    }

    buildDomElementInner() {
        if (this.contentIsEmpty) {
            return null;
        } else {
            return this.namedChildren['content'].buildDomElement();
        }
    }

    buildDomSequenceChildren(horizontal) {
        if (this.contentIsEmpty) {
            return []
        }
        return this.namedChildren['content'].buildDomSequenceChildren(horizontal)
    }

    rebuildDomElement() {
        this.parent.childChanged(this);
    }

    get contentIsEmpty(){
        // Return true only if the
        // child content is undefined, null,
        // or otherwise empty.
        if (this.namedChildren.content) {
            return false;
        }
        return true;
    }
}

export {
    Subscribed,
    Subscribed as default
};
