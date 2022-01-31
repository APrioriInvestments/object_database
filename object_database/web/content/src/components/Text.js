/**
 * Text Cell Cell
 */

import {makeDomElt as h} from './Cell';
import {ConcreteCell} from './ConcreteCell';

class Text extends ConcreteCell {
    constructor(props, ...args){
        super(props, ...args);

        this.style = "display:inline-block";
        this.extraClasses = "";

        if (this.props.textColor) {
            this.style += ";color:" + this.props.textColor;
        }

        if (this.props.bold) {
            this.style += ";font-weight: bold"
        }

        if (this.props.italic) {
            this.style += ";font-style: italic"
        }

        if (this.props.monospace) {
            this.extraClasses += " monospace_font";
        }
        if (this.props.preformatted) {
            this.style += ";white-space: pre";
        }
        if (this.props.nowrap) {
            this.style += ";white-space: nowrap";
        }
        if (this.props.fontSize) {
            this.style += ";fontSize: " + this.props.fontSize;
        }
    }

    build() {
        let divArgs = {
            class: "cell cell-focus-no-outline" + this.extraClasses,
            id: this.getElementId(),
            style: this.style,
            "data-cell-id": `${this.identity}`,
            "data-cell-type": "Text",
            'tabindex': 0
        };

        if (!this.anyParentCapturesClicks()) {
            divArgs.onfocus = this.focusReceived
        }

        return h(
            'div',
            divArgs,
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
