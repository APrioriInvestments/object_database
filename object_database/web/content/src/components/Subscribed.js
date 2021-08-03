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

    _computeFillSpacePreferences() {
        if (this.contentIsEmpty) {
            return {horizontal: false, vertical: false};
        }

        return this.namedChildren['content'].getFillSpacePreferences();
    }

    // this is uncached
    getFillSpacePreferences() {
        return this._computeFillSpacePreferences();
    }

    childSpacePreferencesChanged(child) {
        this.parent.childSpacePreferencesChanged(child);
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
