/**
 * StylingCell
 *
 * A base class for cells that have one child to which they want to
 * apply some styling.
 */

import {makeDomElt as h} from './Cell';
import {ConcreteCell} from './ConcreteCell';

class StylingCell extends ConcreteCell {
    constructor(props, ...args){
        super(props, ...args);

        // Bind Cell methods
        this.getClasses = this.getClass.bind(this);
        this.getStyle = this.getStyle.bind(this);

        this.innerDiv = null;
    }

    build() {
        this.innerDiv = h('div', {
            id: this.getElementId(),
            class: this.getClass() + " allow-child-to-fill-space",
            style: 'display:inline-block;' + this.getStyle()
        }, [this.renderChildNamed('content')]);

        let res = h(
            'div',
            {'class': 'cell allow-child-to-fill-space'},
            [this.innerDiv]
        );

        this.applySpacePreferencesToClassList(this.innerDiv);
        this.applySpacePreferencesToClassList(res);

        return res;
    }

    onOwnSpacePrefsChanged() {
        this.applySpacePreferencesToClassList(this.domElement);
        this.applySpacePreferencesToClassList(this.innerDiv);
    }

    _computeFillSpacePreferences() {
        return this.namedChildren['content'].getFillSpacePreferences();
    }

    // override these to use your properties to build the appropriate
    // style
    getStyle() {
        return "";
    }

    getClasses(){
        return "";
    }
}

export {
    StylingCell,
    StylingCell as default
};
