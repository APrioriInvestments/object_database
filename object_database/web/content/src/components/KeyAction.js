/**
 * KeyAction Cell Cell
 * ------------------------
 * This Cell matches the unique
 * non-display Cell KeyAction, which
 * uses the Cell class level
 * KeyListener object to globally
 * register certain key combinations
 * that should trigger at the global
 * level.
 */
import {KeyListener} from './util/KeyListener';
import {KeyBinding} from './util/KeyListener';

import {makeDomElt as h} from './Cell';
import {ConcreteCell} from './ConcreteCell';

class KeyAction extends ConcreteCell {
    constructor(props, ...args){
        super(props, ...args);

        // bind method
        this.onKeyDown = this.onKeyDown.bind(this);

        // Key Listener
        let binding = new KeyBinding(
            this.props['keyCmd'],
            this.onKeyDown,
            this.props['stopPropagation'],
            this.props['stopImmediatePropagation'],
            this.props['preventDefault']
        );

        this.keyListener = new KeyListener(document, [binding], `#document-${this.identity}`);
    }

    build() {
        return null;
    }

    onFirstInstalled() {
        this.keyListener.start();
    }

    cellWillUnload(){
        // This method will remove the DOM
        // listener(s) and also remove this
        // keyListener object from the registry
        this.keyListener.pause();
    }

    onKeyDown(event){
        let responseData = {
            event: 'keydown',
            //'target_cell': this.identity,
            data: {
                keyCmd: this.props['keyCmd'],
                key: event.key,
                keyCode: event.keyCode,
                ctrlKey: event.ctrlKey,
                shiftKey: event.shiftKey,
                altKey: event.altKey,
                metaKey: event.metaKey
            }
        };

        this.sendMessage(responseData);
    }
}

export {KeyAction, KeyAction as default};
