/**
 * SingleLineTextBox Cell Cell
 */

import {makeDomElt as h} from './Cell';
import {ConcreteCell} from './ConcreteCell';

class SingleLineTextBox extends ConcreteCell {
    constructor(props, ...args){
        super(props, ...args);

        // Bind context to methods
        this.changeHandler = this.changeHandler.bind(this);
    }

    _computeFillSpacePreferences() {
        return {horizontal: true, vertical: false};
    }

    build(){
        let attrs = {
                class: "cell",
                id: this.getElementId().toString(),
                type: "text",
                "data-cell-id": this.identity,
                value: (this.props.defaultValue || ""),
                "data-cell-type": "SingleLineTextBox",
                onchange: (event) => {this.changeHandler(event.target.value);}
        };

        if (this.props.width) {
            attrs.style = "width:" + this.props.width + "px";
        }

        if (this.props.inputValue !== undefined) {
            attrs.pattern = this.props.inputValue;
        }
        return h('input', attrs, []);
    }

    rebuildDomElement() {
        this.domElement.value = this.props.defaultValue;
        this.domElement.setAttribute('value', this.props.defaultValue);
    }

    changeHandler(val) {
        this.sendMessage({event: "click", text: val})
    }
}

export {SingleLineTextBox, SingleLineTextBox as default};
