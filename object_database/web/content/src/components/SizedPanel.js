/**
 * SizedPanel Cell Cell
 */

import {makeDomElt as h} from './Cell';
import {ConcreteCell} from './ConcreteCell';

/**
 * About Named Children
 * --------------------
 * `content` (single) - The content Cell in the SizedPanel
 */
class SizedPanel extends ConcreteCell {
    constructor(props, ...args){
        super(props, ...args);

        // Bind Cell methods
        this.getClasses = this.getClasses.bind(this);
        this.getStyle = this.getStyle.bind(this);
    }

    build(){
        return h('div', {
            id: this.getElementId(),
            "data-cell-id": this.identity,
            "data-cell-type": "SizedPanel",
            class: this.getClasses(),
            style: this.getStyle()
        }, [this.renderChildNamed('content')]);
    }

    allotedSpaceIsInfinite(child) {
        return {horizontal: false, vertical: false};
    }

    getClasses(){
        if (this.props.applyBorder) {
            return "cell cell-panel cell-panel-border";
        } else {
            return "cell cell-panel";
        }
    }

    getStyle(){
        let style = `width:${this.props.width}px;`;
        style += `height:${this.props.height}px;`;
        return style;
    }
}

export {
    SizedPanel,
    SizedPanel as default
};
