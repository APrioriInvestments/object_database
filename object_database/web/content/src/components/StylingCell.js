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
        this.getClass = this.getClass.bind(this);
        this.getStyle = this.getStyle.bind(this);

        this.innerDiv = null;
    }

    build() {
        this.innerDiv = h('div', {
            id: this.getElementId(),
            class: this.getClass() + " allow-child-to-fill-space",
            style: this.getStyle()
        }, [this.renderChildNamed('content')]);

        let res = null;

        let childFillsSpaceHorizontally = false;
        if (this.namedChildren['content'] && this.namedChildren['content'].getFillSpacePreferences().horizontal) {
            childFillsSpaceHorizontally = true;
        }

        if (childFillsSpaceHorizontally) {
            // if our child fills space horizontally we can just nest
            res = h('div', {'class': 'cell allow-child-to-fill-space'}, [this.innerDiv])
        } else {
            // but if they don't we need to make something to take that space up
            res = h(
                'div',
                {'class': 'cell allow-child-to-fill-space', 'style': 'display:flex;flex-direction:row;align-items:flex-start'},
                [this.innerDiv, h('div', {'display': 'flex:1'}, [])]
            );
        }

        this.applySpacePreferencesToClassList(this.innerDiv);
        this.applySpacePreferencesToClassList(res);

        return res;
    }

    onOwnSpacePrefsChanged() {
        this.applySpacePreferencesToClassList(this.domElement);
        this.applySpacePreferencesToClassList(this.innerDiv);
    }

    _computeFillSpacePreferences() {
        if (this.namedChildren['content']) {
            return this.namedChildren['content'].getFillSpacePreferences();
        }
        return {horizontal: false, vertical: false}
    }

    // override these to use your properties to build the appropriate
    // style
    getStyle() {
        return "";
    }

    getClass() {
        return "";
    }
}

export {
    StylingCell,
    StylingCell as default
};
