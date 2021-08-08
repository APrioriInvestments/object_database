/**
 * Button Cell Cell
 */

import {makeDomElt as h} from './Cell';
import {ConcreteCell} from './ConcreteCell';

/**
 * About Named Children
 * ---------------------
 * `content` (single) - The cell inside of the button (if any)
 */
class Button extends ConcreteCell {
    constructor(props, ...args){
        super(props, ...args);

        // Bind context to methods
        this.onClick = this.onClick.bind(this);
        this._getHTMLClasses = this._getHTMLClasses.bind(this);

        this.buttonDiv = null;
    }

    _computeFillSpacePreferences() {
        return this.namedChildren['content'].getFillSpacePreferences();
    }

    build() {
        this.buttonDiv = h('button', {
            id: this.getElementId(),
            "data-cell-id": this.identity,
            "data-cell-type": "Button",
            class: this._getHTMLClasses(),
            onclick: this.onClick
        }, [this.renderChildNamed('content')]);

        let res = h(
            'div',
            {'class': 'allow-child-to-fill-space button-holder'},
            [this.buttonDiv]
        );

        this.applySpacePreferencesToClassList(this.buttonDiv);
        this.applySpacePreferencesToClassList(res);

        return res;
    }

    onOwnSpacePrefsChanged() {
        this.applySpacePreferencesToClassList(this.domElement);
        this.applySpacePreferencesToClassList(this.buttonDiv);
    }

    onClick() {
        if (this.props.url) {
            if (this.props.target) {
                window.open(this.props.url, this.props.target);
            } else {
                window.location.href = this.props.url;
            }
        } else {
            this.sendMessage({'event': 'click'});
        }
    }

    handleMessages(messages) {
        messages.forEach(msg => {
            if (msg.action == 'redirect') {
                if (msg.target) {
                    window.open(msg.url, msg.target);
                } else {
                    window.location.href = msg.url;
                }
            }
        });
    }

    _getHTMLClasses(){
        let classes = ['btn'];
        if(!this.props.active){
            classes.push(`btn-outline-${this.props.style}`);
        }
        if(this.props.style){
            classes.push(`btn-${this.props.style}`);
        }
        if(this.props.small){
            classes.push('btn-xs');
        }
        return classes.join(" ").trim();
    }
}

export {Button, Button as default};
