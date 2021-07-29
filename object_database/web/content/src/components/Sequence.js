/**
 * Sequence Cell Cell
 */

import {Cell, replaceChildren, makeDomElt} from './Cell';

class Sequence extends Cell {
    constructor(props, ...args) {
        super(props, ...args);

        // Bind context to methods
        this.makeClasses = this.makeClass.bind(this);
        this.makeElements = this.makeElements.bind(this);

        this.updateDomElementFlexParentTag = this.updateDomElementFlexParentTag.bind(this);
        this.anyDomChildrenAreFlex = this.anyDomChildrenAreFlex.bind(this);

        // populated if we are the root of this sequence and have been built
        this.domElement = null;

        // an array of dom children if we have a parent who has been calculated
        this.domChildren = null;
    }

    rebuildDomElement() {
        if (this.domElement) {
            replaceChildren(this.domElement, this.makeElements());
            this.updateDomElementFlexParentTag();
        } else {
            this.domChildren = this.makeElements();
            this.parent.childChanged(this);
        }
    }

    anyDomChildrenAreFlex() {
        var children = this.domElement.children;

        for (var i = 0; i < children.length; i++) {
            if (children[i].classList.contains('flex-child')) {
                return true;
            }
        }

        return false;
    }

    updateDomElementFlexParentTag() {
        if (this.anyDomChildrenAreFlex()) {
            this.domElement.classList.add('flex-parent')
        } else {
            if (this.domElement.classList.contains('flex-parent')) {
                this.domElement.classList.remove('flex-parent');
            }
        }
    }

    childChanged(child) {
        if (this.domElement !== null) {
            // we were explicitly installed

            // get a list of our children
            let children = this.makeElements();

            // if any of our children is a flex-child, then we are a flex-parent
            // update our dom element
            replaceChildren(this.domElement, children);
            this.updateDomElementFlexParentTag();
        } else if (this.domChildren !== null) {
            // we're folded into a parent
            this.domChildren = null;
            this.parent.childChanged(this);
        } else {
            throw new Error(
                "Can't call 'childChanged' on a cell that was not installed"
            );
        }
    }

    buildDomElementInner() {
        // ensure we don't attempt to build dom children
        this.domChildren = null;

        if (this.domElement === null) {
            this.domElement = makeDomElt('div', {
                class: this.makeClass(),
                id: this.getElementId(),
                "data-cell-id": this.identity,
                "data-cell-type": "Sequence"
            }, this.makeElements());

            this.updateDomElementFlexParentTag();
        }

        return this.domElement;
    }

    buildDomSequenceChildren(horizontal) {
        this.domElement = null;

        if (this.domChildren === null) {
            if (horizontal != (this.props.orientation == 'horizontal')) {
                // our parent is the wrong orientation
                this.domChildren = [this.buildDomElement()];
            } else {
                this.domChildren = this.makeElements();
            }
        }

        return this.domChildren;
    }

    makeElements(){
        let result = [];

        this.namedChildren['elements'].forEach(childCell => {
            // we're vertical. Get ask our child cells to unpack themselves.
            let domElts = childCell.buildDomSequenceChildren(this.props.orientation == 'horizontal');

            domElts.forEach(childDom => {
                if (childDom !== null) {
                    result.push(childDom);
                }
            });
        });

        return result;
    }
    makeClass() {
        let classes = [
            "cell",
            "sequence"
        ];

        if (this.props.orientation == 'horizontal') {
            classes.push("sequence-horizontal");
        } else {
            classes.push("sequence-vertical");
        }

        if (this.props.flexChild) {
            classes.push("flex-child");
        }

        if (this.props.margin){
            classes.push(`child-margin-${this.props.margin}`);
        }

        if(this.props.wrap){
            classes.push('seq-flex-wrap');
        }

        return classes.join(" ");
    }
}

export {Sequence, Sequence as default};
