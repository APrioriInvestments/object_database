/**
 * Scrollable  Component
 */

import {Component} from './Component';
import {PropTypes} from './util/PropertyValidator';
import {h} from 'maquette';

/**
 * About Named Children
 * --------------------
 * `child` (single) - The cell/component this instance contains
 */
class Scrollable extends Component {
    constructor(props, ...args){
        super(props, ...args);

        // Bind component methods
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
                class: "cell overflow",
                style: style,
                "data-cell-id": this.props.id,
                "data-cell-type": "Scrollable"
            }, [this.makeChild()])
        );
    }

    makeChild(){
        return this.renderChildNamed('child');
    }
}

export {Scrollable, Scrollable as default};
