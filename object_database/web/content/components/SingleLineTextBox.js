/**
 * SingleLineTextBox Cell Component
 */

import {Component} from './Component';
import {PropTypes} from './util/PropertyValidator';
import {h} from 'maquette';

class SingleLineTextBox extends Component {
    constructor(props, ...args){
        super(props, ...args);

        // Bind context to methods
        this.changeHandler = this.changeHandler.bind(this);
    }

    build(){
        let attributes = {
            class: 'cell single-line-textbox',
            type: 'text',
            id: this.props.id,
            "data-cell-id": this.props.id,
            "data-cell-type": "SingleLineTextBox",
            pattern: this.props.pattern,
            onchange: (event) => {this.changeHandler(event.target.value);}
        };
        if(this.numRenders == 0 && this.props.initialValue){
            attributes.value = this.props.initialValue;
        }
        return h('input', attributes, []);
    }

    changeHandler(val) {
        cellSocket.sendString(
            JSON.stringify(
                {
                    "event": "click",
                    "target_cell": this.props.id,
                    "text": val
                }
            )
        );
    }
};

SingleLineTextBox.propTypes = {
    pattern: {
        type: PropTypes.string,
        description: "The pattern the input will accept (HTML5 valid)"
    },
    initialValue: {
        type: PropTypes.string,
        description: "An initial value that will be given to the input on first render"
    }
};

export {SingleLineTextBox, SingleLineTextBox as default};
