import {makeDomElt as h} from './Cell';
import {ConcreteCell} from './ConcreteCell';

/**
 * About Named Children
 * --------------------
 * `content` (single) - The content Cell in the Panel
 */
class Flex extends ConcreteCell {
    constructor(props, ...args){
        super(props, ...args);

        // the sequence object which is our parent
        this.parentSequence = null;
    }

    build(){
        return h('div', {
            id: this.getElementId(),
            "data-cell-id": this.identity,
            "data-cell-type": "Flex",
            "class": "allow-child-to-fill-space"
        }, [this.renderChildNamed('content')]);
    }

    setParent(parent) {
        this.parent = parent;

        let parentSequence = this.parent;

        while (parentSequence && parentSequence.name != "Sequence") {
            parentSequence = parentSequence.parent;
        }

        this.parentSequence = parentSequence;
    }

    _computeFillSpacePreferences() {
        let childPrefs = Object.assign({}, this.namedChildren['content'].getFillSpacePreferences());

        if (!this.parentSequence) {
            return {horizontal: true, vertical: true};
        }

        if (this.parentSequence.props.orientation == 'horizontal') {
            childPrefs.horizontal = true;
        } else {
            childPrefs.vertical = true;
        }

        return childPrefs;
    }

    allotedSpaceIsInfinite(child) {
        return this.parent.allotedSpaceIsInfinite(this);
    }
}

export {
    Flex,
    Flex as default
};
