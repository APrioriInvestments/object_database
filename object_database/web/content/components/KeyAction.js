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

        // bind method
        this.onKeyDown = this.onKeyDown.bind(this);

        // Key Listener
        let binding = new KeyBinding(
            this.props.extraData['keyCmd'],
            this.onKeyDown,
            this.props.extraData['stopPropagation'],
            this.props.extraData['stopImmediatePropagation'],
            this.props.extraData['preventDefault']
        );
        this.keyListener = new KeyListener(document, [binding], `#document-${this.props.id}`);
    }

    componentDidLoad(){
        this.keyListener.start();
    }

    componentWillUnload(){
        // This method will remove the DOM
        // listener(s) and also remove this
        // keyListener object from the registry
        this.keyListener.pause();
    }

    build(){
        // This is a non-display cell
        // and does not add any elements
        // to the DOM.
        return null;
    }

    render() {
        // This is a non-display cell
        // and does not add any elements
        // to the DOM.
        return null;
    }

    onKeyDown(event){
        let responseData = {
            event: 'keydown',
            //'target_cell': this.props.id,
            data: {
                keyCmd: this.props.extraData['keyCmd'],
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
