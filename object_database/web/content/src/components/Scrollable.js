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
    }

    build(){
        let style = "";
        if (this.props.height){
            style = "height:" + this.props.height;
        }
        return (
            h('div', {
                id: this.getElementId(),
                class: "cell flex-child overflow",
                style: style,
                "data-cell-id": this.identity,
                "data-cell-type": "Scrollable"
            }, [this.makeChild()])
        );
    }

    makeChild(){
        return this.renderChildNamed('child');
    }
}

export {Scrollable, Scrollable as default};
