/**
 * CircleLoader Cell Component
 */

import {Component} from './Component';
import {h} from 'maquette';


class CircleLoader extends Component {
    constructor(props, ...args){
        super(props, ...args);
    }

    build(){
        return (
            h('div', {
                id: this.getElementId(),
                "data-cell-id": this.props.id,
                "data-cell-type": "CircleLoader",
                class: "spinner",
                role: "status"
            })
        );
    }
}

CircleLoader.propTypes = {
};

export {CircleLoader, CircleLoader as default};
