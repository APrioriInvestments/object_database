/**
 * SingleLineTextBox Cell Cell
 */

import {makeDomElt as h} from './Cell';
import {ConcreteCell} from './ConcreteCell';

class SingleLineTextBox extends ConcreteCell {
    constructor(props, ...args){
        super(props, ...args);
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
            tabIndex: -1,
            value: (this.props.defaultValue || ""),
            "data-cell-type": "SingleLineTextBox",
            oninput: (event) => {
                this.sendMessage({event: "userEdit", text: this.domElement.value})
            },
            onkeydown: (event) => {
                if (event.code == "Escape") {
                    this.sendMessage({event: "escape"});
                    event.preventDefault();
                    return;
                }

                if (event.code == "Enter" || event.code == "NumpadEnter") {
                    this.sendMessage({event: "enter"});
                    event.preventDefault();
                    return;
                }
            },
            onfocus: (event) => {
                this.sendMessage({event: 'gainFocus'});
            }
        };

        let styles = [];

        if (this.props.font) {
            styles.push("font-family: " + this.props.font);
        }

        if (this.props.textSize) {
            styles.push("font-size: " + this.props.textSize + "px");
        }

        attrs.style = styles.join(';');

        if (this.props.pattern) {
            attrs.pattern = this.props.pattern;
        }

        let res = h('input', attrs, [])

        res.setAttribute('value', this.props.initialText)
        res.value = this.props.initialText;

        return res;
    }

    serverKnowsAsFocusedCell() {
        this.domElement.focus();
    }

    rebuildDomElement() {}

    handleMessages(messages) {
        messages.forEach(msg => {
            if (msg.event == 'textChanged') {
                this.domElement.setAttribute('value', msg.text);
                this.domElement.value = msg.text;
            }
        });
    }
}

export {SingleLineTextBox, SingleLineTextBox as default};
