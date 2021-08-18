/**
 * Sized Cell Cell
 */

import {makeDomElt as h} from './Cell';
import {ConcreteCell} from './ConcreteCell';


/**
 * About Named Children
 * --------------------
 * `content` (single) - The content Cell in the Sized
 */
class Sized extends ConcreteCell {
    constructor(props, ...args){
        super(props, ...args);

        this.getStyle = this.getStyle.bind(this);
    }

    build() {
        let res = h('div', {
            id: this.getElementId(),
            class: "allow-child-to-fill-space overflow-hidden",
            style: this.getStyle()
        }, [this.renderChildNamed('content')]);

        this.applySpacePreferencesToClassList(res);

        return res;
    }

    allotedSpaceIsInfinite(child) {
        let isInfinite = this.parent.allotedSpaceIsInfinite();

        if (this.props.height !== null) {
            isInfinite.vertical = false;
        }

        if (this.props.width !== null) {
            isInfinite.horizontal = false;
        }

        return isInfinite;
    }

    _computeFillSpacePreferences() {
        let res = Object.assign(
            {},
            this.namedChildren['content'].getFillSpacePreferences()
        );

        if (this.props.height !== null) {
            res.vertical = false;
        }

        if (this.props.width !== null) {
            res.horizontal = false;
        }

        return res;
    }

    getStyle() {
        let styles = [];

        if (this.props.height !== null) {
            styles.push(
                `height:${this.props.height}px`
            );
        }

        if (this.props.width !== null) {
            styles.push(
                `width:${this.props.width}px`
            );
        }

        return styles.join(";");
    }
}

export {
    Sized,
    Sized as default
};
