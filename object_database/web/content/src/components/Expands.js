/**
 * Expands Cell Cell
 */

/** TODO/NOTE: It appears that the open/closed
    State for this Cell could simply be passed
    with the Cell data, along with what to display
    in either case. This would be how it is normally
    done in large web applications.
    Consider refactoring both here and on the Cells
    side
**/

import {makeDomElt as h, replaceChildren, Cell} from './Cell';

/**
 * About Named Children
 * --------------------
 * `content` (single) - The open or closed cell, depending on source
 *     open state
 * `icon` (single) - The Cell of the icon to display, also depending
 *     on closed or open state
 */
class Expands extends Cell {
    constructor(props, ...args){
        super(props, ...args);

        // Bind context to methods
        this.onClick = this.onClick.bind(this);
        this.domIconHolder = null;
        this.domContentHolder = null;
        this.domElement = null;
    }

    buildDomElementInner() {
        this.domIconHolder = h('div',
            {
                //style: 'display:inline-block;vertical-align:top',
                class: 'expands-button-area',
                onclick: this.onClick
            },
            [this.namedChildren['icon'].buildDomElement()]
        );

        this.domContentHolder = h('div', {
                //style:'display:inline-block'
                class: 'expands-content-area'
            },
            [this.namedChildren['content'].buildDomElement()]
        );

        this.domElement = (
            h('div', {
                id: this.getElementId(),
                class: 'cell expands',
                "data-cell-id": this.identity,
                "data-cell-type": "Expands",
                "data-is-open": this.props.isOpen.toString()
            },
                [
                    this.domIconHolder,
                    this.domContentHolder,
                ]
            )
        );

        return this.domElement;
    }

    onClick() {
        this.sendMessage({'event': 'click'});
    }

    rebuildDomElement() {
        let newDomIcon = this.namedChildren['icon'].buildDomElement();
        let newDomContent = this.namedChildren['content'].buildDomElement();

        replaceChildren(this.domIconHolder, [newDomIcon]);
        replaceChildren(this.domContentHolder, [newDomContent]);

        this.domElement.setAttribute(
            'data-is-open',
            this.props.isOpen.toString()
        );
    }
}

export {Expands, Expands as default};
