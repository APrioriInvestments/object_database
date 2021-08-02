import {makeDomElt as h} from './Cell';
import {ConcreteCell} from './ConcreteCell';

class Expands extends ConcreteCell {
    constructor(props, ...args){
        super(props, ...args);

        // Bind context to methods
        this.onClick = this.onClick.bind(this);
    }

    build() {
        return h('div', {
            id: this.getElementId(),
            class: 'cell expands',
            "data-cell-id": this.identity,
            "data-cell-type": "Expands",
            "data-is-open": this.props.isOpen.toString()
        },
            [
                h('div',
                    {
                        class: 'expands-button-area',
                        onclick: this.onClick
                    },
                    [this.renderChildNamed('icon')]
                ),
                h('div', {
                        class: 'expands-content-area'
                    },
                    [this.renderChildNamed('content')]
                )
            ]
        )
    }

    onClick() {
        this.sendMessage({'event': 'click'});
    }
}

export {Expands, Expands as default};
