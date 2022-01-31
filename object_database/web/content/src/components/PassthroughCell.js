/**
 * PassthroughCell
 *
 * A base class for cells that have one child that they just pass through directly
 */

import {makeDomElt as h} from './Cell';
import {ConcreteCell} from './ConcreteCell';

class PassthroughCell extends ConcreteCell {
    constructor(props, ...args){
        super(props, ...args);
    }

    childChanged(node) {
        this.parent.childChanged(this);
    }

    getScrollableDomElt() {
        return this.namedChildren['content'].getScrollableDomElt();
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
    PassthroughCell,
    PassthroughCell as default
};
