/**
 * Code Cell Component
 */

import {Component} from './Component';
import {PropTypes} from './util/PropertyValidator';
import {h} from 'maquette';

/**
 * About Named Children
 * --------------------
 */
class Code extends Component {
    constructor(props, ...args){
        super(props, ...args);
    }

    build(){
        return h('pre', {
            class: "cell code",
            id: this.getElementId(),
            'data-cell-id': this.props.id.toString(),
            'data-cell-type': "Code"
        }, [this.props.contents]);
    }
}

Code.propTypes = {
    content: {
        type: PropTypes.string,
        description: 'The code content to display'
    }
};

export {Code, Code as default};
