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
        let attrs =
            {
                class: "cell",
                id: this.getElementId().toString(),
                type: "text",
                "data-cell-id": this.props.id,
                value: (this.props.defaultValue || ""),
                "data-cell-type": "SingleLineTextBox",
                onchange: (event) => {this.changeHandler(event.target.value);}
            };
        if (this.props.inputValue !== undefined) {
            attrs.pattern = this.props.inputValue;
        }
        return h('input', attrs, []);
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

SingleLineTextBox.propTypes = {
    defaultValue: {
        type: PropTypes.string,
        description: "Default value to insert into field"
    }
};

export {SingleLineTextBox, SingleLineTextBox as default};
