/**
 * A Global Key Event Handler
 * and registry.
 * --------------------------
 * This module represents a set of classes whose
 * instances will comprise a global keypress
 * event registry.
 * `KeyListener` is the main combination and event
 * binding mechanism.
 * `KeyBinding` is a specific key combination plus
 * listener that will be managed by `KeyListener`
 * Here we can register different key combinations,
 * like 'Alt+i' 'Ctrl+x' 'Meta+D' etc.
 * `KeyBinding` listeners can be stored with
 * an optional priority level, and those listeners
 * will be fired before all others.
 * See class comments for `KeyListener` and
 * `KeyBinding` for more information.
 */

/**
 * A simple mapping from common
 * modifier key strings to the
 * respective keys on a keyup/down
 * event object.
 */
const modKeyMap = {
    'Shift': 'shiftKey',
    'Alt': 'altKey',
    'Meta': 'metaKey',
    'Control': 'ctrlKey',
    'Ctrl': 'ctrlKey'
};


/**
 * A class whose instances manage keydown event listeners.
 * Note that particular keycombo/handler combinations
 * are stored internally as instances of `KeyBinding`.
 * Note also that only the `keydown` even if listned to
 * as opposed to `keypress` or `keyup`.
 */
class KeyListener {
    /**
     * Creates a new `KeyListener` instance.
     * @param {DOMElement} target - The target element
     * to which we will bind all key event listeners.
     * defaults to `window.document.body`
     * @param {Array} bindings - Array of instances of
     * KeyBinding
     */
    constructor(target, bindings){
        this.target = target;
        this.bindings = bindings;
        this.id = this.createId(this.target);

        // Bind methods
        this.start = this.start.bind(this);
        this.pause = this.pause.bind(this);
        this.mainListener = this.mainListener.bind(this);
    }

    /* I generate a unique id for the listener.
     * @param {DOMElement} target - The target element
     * to which this event listener is bound.
     */
    createId(target){
        return `${target.data.cellType}-${target.id}`
    }

    /**
     * Tells the instance to begin listening for keydown events.
     * This method will bind the instance's single main listener,
     * `mainListener` to the specified target object, either the
     * passed in value or the stored internal one from construction.
     * I also add the listener to the global KeydownEventListener
     * The idea here is that we can easily stop and start all of the
     * constituent listeners simply by adding / removing this single
     * listener.
     */
    start(){
        this.target.addEventListener('keydown', this.mainListener, {'capture': true});
        window.KeydownEventListener.add(this);
    }

    /**
     * Stops global listening for keydown events.
     * In practice, this method simply removes the single
     * listener from the target DOMElement and from the global
     * KeydownEventListntner.
     * To resume, one can simply call `start()` again without
     * arguments.
     */
    pause(){
        this.target.removeEventListener('keydown', this.mainListener);
        window.KeydownEventListener.remove(this);
    }

    /**
     * I am the main keydown event listener that is attached
     * to the target DOMElement when `start()` is called.
     * I pass along the event to each of the bindings (instances
     * of KeyBinding) and let these handle, or ingore, the event
     * as needed.
     * @param {KeyEvent} event - A keydown event object.
     */
    mainListener(event){
        this.bindings.forEach((binding) => {
            binding.handle(event);
        });
    }
}

/**
 * A class whose instances represent a combination of key commands
 * (like `Alt+i`, `I`, `Meta+D` etc), listeners for keydown, priority
 * level, and whether or not the binding should stop other bindings with
 * the same command from being triggered.
 * It's primary consumer is `KeyListener`, whose instances register
 * all key events as `KeyBinding` objects.
 */
class KeyBinding {
    /**
      * @param {String} command - A key combo command string like `Alt+i`,
      * `X`, `Meta+D`, etc.
      * @param {Function} handler - A function that serves as the event
      * handler, which will be triggered when the command is pressed.
      * Will be passed the normal keydown event object.
      * @param {Boolean} stopPropagation - prevents further propagation of
      * the current event in the capturing and bubbling phases.
      * @param {Boolean} stopImmediatePropagation - prevents other
      * listeners of the same event from being called.
      * @param {Boolean} preventDefault - tells the user agent that if the
      * event does not get explicitly handled, its default action should
      * not be taken as it normally would be.
      */
    constructor(command, handler, stopPropagation=false,
        stopImmediatePropagation=false, preventDefault=false){
        this.command = command;
        this.handler = handler;
        this.stopPropagation = stopPropagation;
        this.stopImmediatePropagation = stopImmediatePropagation;
        this.preventDefault = preventDefault;
        this.commandKeys = this.command.split("+");
        this.key = this.commandKeys[this.commandKeys.length - 1];
        this.modKeys = this.commandKeys.slice(0, this.commandKeys.length - 1);

        // Bind instance methods
        this.handle = this.handle.bind(this);
        this.handleSingleKey = this.handleSingleKey.bind(this);
        this.handleComboKey = this.handleComboKey.bind(this);
    }

    /**
     * For a given keydown event, attempt to "handle" it
     * by calling this object's handler.
     * Note that if there is only one command key (ie the command
     * is a single character without a modifier key like `X`)
     * we call `handleSingleKey`. Otherwise calls `handleComboKey`.
     * @param {KeyEvent} event - A keydown event object
     * @returns {Boolean} - Will return true if the keybinding
     * both has its handler called and requires that propagation
     * stops. false in all other cases.
     */
    handle(event){
        if(this.stopPropagation){
            event.stopPropagation();
        }
        if(this.stopImmediatePropagation){
            event.stopImmediatePropagation();
        }
        if(this.preventDefault){
            event.preventDefault();
        }
        if(!this.key){
            return false;
        } else if(this.modKeys.length == 0){
            return this.handleSingleKey(event, this.key);
        } else {
            return this.handleComboKey(event);
        }
    }

    /**
     * Determines if this KeyBinding's
     * single trigger key matches that of the
     * passed in event. If so, that means we have
     * a match and the handler should fire.
     * @param {KeyEvent} event - A keydown event
     * object that we will check for a match with.
     * @param {String} keyName - The name of this
     * instance's first `commandKey` value.
     * @returns {Boolean} - If there is a match,
     * we return true if this instance asks to
     * stop propagation. Returns false in all
     * other cases.
     */
    handleSingleKey(event, key){
        if(event.key == key){
            return this.handler(event);
        } else {
            return false;
        }
    }

    /**
     * Attempts to "handle" (ie call handler for)
     * cases where this instance uses a modifier key
     * and has a combo command like `Alt+i` or `Meta+D`.
     * Will attempts to match the internal `commandKey`
     * parts to the passed-in event object and, if there
     * is a match, will call the handler.
     * @param {KeyEvent} event - A keydown event object
     * @returns {Boolean} - Will return true only if
     * this binding is a match to the event and it is
     * also asking to stop propagation. False in all
     * other cases.
     */
    handleComboKey(event){
        // check that all the modifier keys are down;
        let modKeysDown = this.modKeys.map((key) => {
            return event[key];
        }).every((item) => {
            return item;
        });
        // and if all mod keys are down handle the event
        // else return false
        if(modKeysDown){
            return this.handleSingleKey(event, this.key);
        } else {
            return false;
        }
    }
}

export {KeyListener, KeyBinding};
