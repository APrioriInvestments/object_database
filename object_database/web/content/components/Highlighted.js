/**
 * Highlighted Cell Component
 */

import {Component} from './Component';
import {h} from 'maquette';

/**
 * About Replacements
 * ------------------
 * This component has one regular replacement:
 * `content`
 */

/**
 * About Named Children
 * --------------------
 * `content` (single) - The cell inside of the highlight
 */
class Highlighted extends Component {
    constructor(props, ...args){
        super(props, ...args);

        // Bind component methods
        this.getClasses = this.getClasses.bind(this);
    }

    build(){
        return(
            h('div', {
                id: this.getElementId(),
                "data-cell-id": this.props.id,
                "data-cell-type": "Highlighted",
                class: this.getClasses()
            }, [this.renderChildNamed('content')])
        );
    }

    getClasses(){
        let classes = ["cell", "cell-highlighted"];
        return classes.join(" ");
    }
}

export {
    Highlighted,
    Highlighted as default
};
