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
    }

    build(){
        return (
            h('div', {
                id: this.getElementId(),
                class: "py-md-2",
                "data-cell-id": this.identity,
                "data-cell-type": "Main",
                'class': 'allow-child-to-fill-space'
            }, [
                this.renderChildNamed('child')
            ])
        );
    }

    _computeFillSpacePreferences() {
        return {horizontal: true, vertical: true};
    }
}

export {Main, Main as default};
