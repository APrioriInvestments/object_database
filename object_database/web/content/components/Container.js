/**
 * Container Cell Component
 */

import {Component} from './Component';
import {h} from 'maquette';

/**
 * About Named Children
 * --------------------
 * `child` (single) - The Cell that this component contains
 */
class Container extends Component {
    constructor(props, ...args){
        super(props, ...args);

        // Bind component methods
        this.makeChild = this.makeChild.bind(this);
    }

    build(){
        let child = this.makeChild();
        let style = "";
        if(!child){
            style = "display:none;";
        }
        return (
            h('div', {
                id: this.getElementId(),
                "data-cell-id": this.props.id,
                "data-cell-type": "Container",
                class: "cell",
                style: style
            }, [child])
        );
    }

    makeChild(){
        return this.renderChildNamed('child');
    }
}

export {Container, Container as default};
