/**
 * KeyAction Cell component
 * ------------------------
 * This component matches the unique
 * non-display Cell KeyAction, which
 * uses the Component class level
 * KeyListener object to globally
 * register certain key combinations
 * that should trigger at the global
 * level.
 */
import {Component} from './Component';
import {KeyListener} from './util/KeyListener';
import {KeyBinding} from './util/KeyListener';

class KeyAction extends Component {
    constructor(props, ...args){
        super(props, ...args);

        let binding = new KeyBinding(
            this.props.extraData['keyCombo'],
            this.onKeyDown,
            this.props.extraData['stopPropagation'],
            this.props.extraData['stopImmediatePropagation'],
            this.props.extraData['preventDefault']
        )
        this.keyListener = new KeyListener(document, [binding]);
    }

    componentDidLoad(){
        this.keyListener.start();
    }

    build(){
        // This is a non-display cell
        // and does not add any elements
        // to the DOM.
        return null;
    }

    registerKeyAction(){
        if(this.constructor.keyListener){
            this.constructor.keyListener.register(
                this.props.extraData['keyCombo'],
                this.props.extraData['wantedEventKeys'],
                this.props.id,
                this.props.extraData['priority'],
                this.props.extraData['stopsPropagation']
            );
        } else {
            throw new Error(`KeyAction(${this.props.id}) attempted to register with the KeyListener but there was no contstructor instance found!`);
        }
    }

    componentWillUnload() {
        this.keyListener.pause();
    }
}

export {KeyAction, KeyAction as default};
