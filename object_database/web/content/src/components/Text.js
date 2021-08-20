/**
 * Text Cell Cell
 */

import {makeDomElt as h} from './Cell';
import {ConcreteCell} from './ConcreteCell';

class Text extends ConcreteCell {
    constructor(props, ...args){
        super(props, ...args);

        this.style = "display:inline-block";

        if (this.props.textColor) {
            this.style += ";color:" + this.props.textColor;
        }
    }

    build() {
        return h(
            'div',
            {
                class: "cell cell-focus-no-outline",
                id: this.getElementId(),
                style: this.style,
                "data-cell-id": `${this.identity}`,
                "data-cell-type": "Text",
                'onfocus': this.focusReceived,
                'tabindex': 0
            },
            [this.props.rawText ? this.props.rawText.toString() : null]
        );
    }

    serverKnowsAsFocusedCell() {
        if (this.domElement) {
            this.domElement.focus();
        }
    }
}

export {Text, Text as default};
