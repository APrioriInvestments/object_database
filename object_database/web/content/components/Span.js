/**
 * Span Cell Component
 */

import {Component} from './Component';
import {h} from 'maquette';


class Span extends Component {
    constructor(props, ...args){
        super(props, ...args);
    }

    build(){
        return (
            h('span', {
                id: this.getElementId(),
                "data-cell-id": this.props.id,
                "data-cell-type": "Span",
                class: "cell"
            }, [this.props.text])
        );
    }
}

export {Span, Span as default};
