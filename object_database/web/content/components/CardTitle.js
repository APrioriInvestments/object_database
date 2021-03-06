/**
 * CardTitle Cell
 */

import {Component} from './Component';
import {h} from 'maquette';

/**
 * About Named Children
 * --------------------
 * `inner` (single) - The inner cell of the title component
 */
class CardTitle extends Component {
    constructor(props, ...args){
        super(props, ...args);

        // Bind component methods
        this.makeInner = this.makeInner.bind(this);
    }

    build(){
        return(
            h('div', {
                id: this.getElementId(),
                class: "cell",
                "data-cell-id": this.props.id,
                "data-cell-type": "CardTitle"
            }, [
                this.makeInner()
            ])
        );
    }

    makeInner(){
        return this.renderChildNamed('inner');
    }
}

export {CardTitle, CardTitle as default};
