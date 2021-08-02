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
        this.updateSpacePreferenceCalculation = this.updateSpacePreferenceCalculation.bind(this);

        // populated if we are the root of this sequence and have been built
        this.domElement = null;

        // an array of dom children if we have a parent who has been calculated
        this.domChildren = null;
    }

    rebuildDomElement() {
        if (this.domElement) {
            replaceChildren(this.domElement, this.makeElements());
            this.updateSpacePreferenceCalculation();
        } else {
            this.domChildren = this.makeElements();
            this.parent.childChanged(this);
        }
    }

    _computeFillSpacePreferences() {
        var children = this.namedChildren['elements'];

        let horiz = false;
        let vert = false;

        for (var i = 0; i < children.length; i++) {
            let sp = children[i].getFillSpacePreferences();

            horiz |= sp.horizontal;
            vert |= sp.vertical;
        }

        return {horizontal: horiz, vertical: vert};
    }

    makeClass() {
        let classes = [
            "cell",
            "sequence",
            "sequence-" + this.props.orientation
        ];

        let sp = this.getFillSpacePreferences();

        if (sp.horizontal) {
            classes.push('fill-space-horizontal');
        }

        if (sp.vertical) {
            classes.push('fill-space-vertical');
        }

        if (this.props.margin) {
            classes.push(`child-margin-${this.props.margin}`);
        }

        if(this.props.wrap) {
            classes.push('seq-flex-wrap');
        }

        return classes.join(" ");
    }

    onOwnSpacePrefsChanged() {
        let sp = this.getFillSpacePreferences();

        let isFlex = (
            this.orientation == 'horizontal' && sp.horizontal
            || this.orientation == 'vertical' && sp.vertical
        );

        if (isFlex) {
            this.domElement.classList.add('fill-space-' + this.props.orientation);
        } else {
            this.domElement.classList.remove('fill-space-' + this.props.orientation);
        }
    }

    // called by children to indicate that their 'space preference' has changed
    // since we called 'buildDomElement' the first time.
    childSpacePreferencesChanged(child) {
        this.updateSpacePreferenceCalculation();
    }

    updateSpacePreferenceCalculation() {
        let newSpacePreferences = this._computeFillSpacePreferences();

        if (newSpacePreferences.horizontal != this._fillSpacePrefs.horizontal ||
                newSpacePreferences.vertical != this._fillSpacePrefs.vertical) {
            this._fillSpacePrefs = newSpacePreferences;
            this.parent.childSpacePreferencesChanged(this);
            this.onOwnSpacePrefsChanged();
        }
    }

    childChanged(child) {
        if (this.domElement !== null) {
            // we were explicitly installed

            // get a list of our children
            let children = this.makeElements();

            replaceChildren(this.domElement, children);

            this.updateSpacePreferenceCalculation();
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

            this.updateSpacePreferenceCalculation();
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
}

export {Sequence, Sequence as default};
