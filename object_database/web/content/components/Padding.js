/**
 * Padding Cell Component
 */

import {Component} from './Component';
import {h} from 'maquette';

class Padding extends Component {
    constructor(props, ...args){
        super(props, ...args);
    }

    build(){
        return (
            h('span', {
                id: this.getElementId(),
                "data-cell-id": this.props.id,
                "data-cell-type": "Padding",
                class: "px-2"
            }, [" "])
        );
    }
}

export {Padding, Padding as default};
