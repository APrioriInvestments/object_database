/**
 * Scrollable  Cell
 */

import {makeDomElt as h} from './Cell';
import {ConcreteCell} from './ConcreteCell';

/**
 * About Named Children
 * --------------------
 * `child` (single) - The cell/Cell this instance contains
 */
class Scrollable extends ConcreteCell {
    constructor(props, ...args){
        super(props, ...args);

        // Bind Cell methods
        this.makeChild = this.makeChild.bind(this);
        this.innerScrollDiv = null;
    }

    _computeFillSpacePreferences() {
        let sp = this.namedChildren['child'].getFillSpacePreferences();

        return {
            vertical: this.props.vertical || sp.vertical,
            horizontal: this.props.horizontal || sp.horizontal
        }
    }

    build(){
        let childClass = "allow-child-to-fill-space";

        if (this.props.vertical && this.props.horizontal) {
            childClass += " cell-scrollable-body-both";
        }
        else if (this.props.vertical) {
            childClass += " cell-scrollable-body-vertical";
        }
        else if (this.props.horizontal) {
            childClass += " cell-scrollable-body-horizontal";
        } else {
            childClass += " cell-scrollable-body"
        }

        let sp = this.getFillSpacePreferences();

        if (sp.vertical) {
            childClass += " fill-space-vertical";
        }

        if (sp.vertical) {
            childClass += " fill-space-horizontal";
        }

        this.innerScrollDiv = (
            h('div', {class: " " + childClass}, [this.makeChild()])
        );

        return h('div', {
                id: this.getElementId(),
                class: "cell cell-scrollable-parent",
                "data-cell-id": this.identity,
                "data-cell-type": "Scrollable"
            }, [this.innerScrollDiv]
        );
    }

    onOwnSpacePrefsChanged() {
        this.applySpacePreferencesToClassList(this.domElement);
        this.applySpacePreferencesToClassList(this.innerScrollDiv);
    }

    allotedSpaceIsInfinite(child) {
        return {
            horizontal: this.props.horizontal,
            vertical: this.props.vertical
        };
    }

    makeChild(){
        return this.renderChildNamed('child');
    }
}

export {Scrollable, Scrollable as default};
