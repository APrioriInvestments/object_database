/**
 * Main Cell Cell
 */

import {makeDomElt as h} from './Cell';
import {ConcreteCell} from './ConcreteCell';


/**
 * About Named Children
 * --------------------
 * `child` (single) - The child cell that is wrapped
 */
class Main extends ConcreteCell {
    constructor(props, ...args){
        super(props, ...args);

        // Bind Cell methods
        this.makeChild = this.makeChild.bind(this);
    }

    build(){
        return (
            h('main', {
                id: this.getElementId(),
                class: "py-md-2",
                "data-cell-id": this.identity,
                "data-cell-type": "Main"
            }, [
                    this.makeChild()
            ])
        );
    }

    makeChild(){
        return this.renderChildNamed('child');
    }
}

export {Main, Main as default};
