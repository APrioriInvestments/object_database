/**
 * Main Cell Component
 */

import {Component} from './Component';
import {h} from 'maquette';

/**
 * About Named Children
 * --------------------
 * `child` (single) - The child cell that is wrapped
 */
class Main extends Component {
    constructor(props, ...args){
        super(props, ...args);

        // Bind component methods
        this.makeChild = this.makeChild.bind(this);
    }

    build(){
        return (
            h('main', {
                id: this.getElementId(),
                class: "py-md-2",
                "data-cell-id": this.props.id,
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
