/**
 * Key event registry
 * ----------------------
 * This class stores all application`keydown`events
 */

class KeyRegistry {
    constructor(){
        this.keyListeners = {};

        // bind methods here
        this.addListener = this.addListener.bind(this);
        this.removeListener = this.removeListener.bind(this);
        this.numberOfListeners = this.numberOfListeners.bind(this);
        this.getListenerById = this.getListenerById.bind(this);
        this.getListenersByKeyCombination = this.getListenersByKeyCombination.bind(this);
        this.getListenerByCellId = this.getListenerByCellId.bind(this);
        this.sendListenerData = this.sendListenerData.bind(this);
    }

    /* I add KeyListener to this.keyListeners
     * @param {Object} listener - an istance of the KeyListener class
     */
    addListener(listener){
        // if (this.keyListeners[listener.id]){
        //    throw `Listener with id ${listener.id} is already in the registry. ` +
        //    `You are probably trying to add multiple listeners to the same component, ` +
        //        `which is not allowed.`
        //};
        this.keyListeners[listener.id] = listener;
        return true;
    }

    /* I remove KeyListener to this.keyListeners
     * @param {Object} listener - an istance of the KeyListener class
     */
    removeListener(listener){
        delete this.keyListeners[listener.id];
        return true;
    }

    /* I return the number of listners.
     */
    numberOfListeners(){
        return Object.keys(this.keyListeners).length;
    }

    /* I return the listener by id.
     * @param {string} id - id of the listener
     */
    getListenerById(id){
        return this.keyListeners[id];
    }

    /* I find and return all listeners which have a binding
     * for the specified key combination.
     * @param {Object} keyComboString - string
     * for example 'ctrl-D'
     */
    getListenersByKeyCombination(keyComboString){
        let listeners = [];
        Object.keys(this.keyListeners).forEach((key) => {
            this.keyListeners[key].bindings.forEach((b) => {
                if (b.command === keyComboString){
                    listeners.push(this.keyListeners[key]);
                }
            })
        });
        return listeners;
    }

    /* I return the listener by cell id.
     * @param {string} id - id of the listener
     */
    getListenerByCellId(id){
        let listeners = [];
        Object.keys(this.keyListeners).forEach((key) => {
            if (this.keyListeners[key].target.dataset.cellId === id){
                listeners.push(this.keyListeners[key]);
            }
        });
        if (listeners.length > 1){
            throw `Found more than one listener for cell id ${id}. Something is wrong!`;
        }
        return listeners[0];
    }

    /* I send this.keyListeners data over the WebSocket.
     */
    sendListenerData(){
        let responseData = {
            event: "KeyDownEventListenerInfoRequest",
            KeyListeners: this.keyListeners
        };
        cellSocket.sendString(JSON.stringify(responseData));
    }
}


export {KeyRegistry, KeyRegistry as default};
