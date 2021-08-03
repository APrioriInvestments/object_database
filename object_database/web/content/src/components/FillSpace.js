import {makeDomElt as h} from './Cell';
import {ConcreteCell} from './ConcreteCell';

/**
 * About Named Children
 * --------------------
 * `content` (single) - The content Cell in the Panel
 */
class FillSpace extends ConcreteCell {
    constructor(props, ...args){
        super(props, ...args);

        this.computeStyle = this.computeStyle.bind(this);
    }

    build(){
        return h('div', {
            id: this.getElementId(),
            "data-cell-id": this.identity,
            "data-cell-type": "FillSpace",
            "class": "allow-child-to-fill-space",
            "style": this.computeStyle()
        }, [this.renderChildNamed('content')]);
    }

    computeStyle() {
        if (!this.props.horizontal && !this.props.vertical) {
            return "";
        }

        let styles = ['display:flex'];

        if (this.props.horizontal) {
            styles.push('flex-direction:row');

            if (this.props.horizontal == "left") {
                styles.push('justify-content:flex-start');
            }
            if (this.props.horizontal == "right") {
                styles.push('justify-content:flex-end');
            }
            if (this.props.horizontal == "center") {
                styles.push('justify-content:center');
            }

            if (this.props.vertical == "top") {
                styles.push('align-items:flex-start');
            }
            if (this.props.vertical == "bottom") {
                styles.push('align-items:flex-end');
            }
            if (this.props.vertical == "center") {
                styles.push('align-items:center');
            }

        } else {
            styles.push('flex-direction:column');

            if (this.props.vertical == "top") {
                styles.push('justify-content:flex-start');
            }
            if (this.props.vertical == "bottom") {
                styles.push('justify-content:flex-end');
            }
            if (this.props.vertical == "center") {
                styles.push('justify-content:center');
            }
        }

        return styles.join(";");
    }

    _computeFillSpacePreferences() {
        let childPrefs = Object.assign({}, this.namedChildren['content'].getFillSpacePreferences());

        if (this.props.horizontal) {
            childPrefs.horizontal = true;
        }

        if (this.props.vertical) {
            childPrefs.vertical = true;
        }

        return childPrefs;
    }

    allotedSpaceIsInfinite(child) {
        return this.parent.allotedSpaceIsInfinite(this);
    }
}

export {
    FillSpace,
    FillSpace as default
};
