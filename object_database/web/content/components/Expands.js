/**
 * Expands Cell Component
 */

/** TODO/NOTE: It appears that the open/closed
    State for this component could simply be passed
    with the Cell data, along with what to display
    in either case. This would be how it is normally
    done in large web applications.
    Consider refactoring both here and on the Cells
    side
**/

import {Component} from './Component';
import {h} from 'maquette';

/**
 * About Named Children
 * --------------------
 * `content` (single) - The open or closed cell, depending on source
 *     open state
 * `icon` (single) - The Cell of the icon to display, also depending
 *     on closed or open state
 */
class Expands extends Component {
    constructor(props, ...args){
        super(props, ...args);

        // Bind context to methods
        this.makeIcon = this.makeIcon.bind(this);
        this.makeContent = this.makeContent.bind(this);
        this._getEvents = this._getEvent.bind(this);
    }

    build(){
        return(
            h('div', {
                id: this.getElementId(),
                class: 'cell expands',
                "data-cell-id": this.props.id,
                "data-cell-type": "Expands",
                "data-is-open": this.props.isOpen.toString()
            },
                [
                    h('div', {
                        //style: 'display:inline-block;vertical-align:top',
                        class: 'expands-button-area',
                        onclick: this._getEvent('onclick')
                    },
                      [this.makeIcon()]),
                    h('div', {
                        //style:'display:inline-block'
                        class: 'expands-content-area'
                    },
                      [this.makeContent()]),
                ]
            )
        );
    }

    makeContent(){
        return this.renderChildNamed('content');
    }

    makeIcon(){
        return this.renderChildNamed('icon');
    }

    _getEvent(eventName) {
        return this.props.extraData.events[eventName];
    }
}

export {Expands, Expands as default};
