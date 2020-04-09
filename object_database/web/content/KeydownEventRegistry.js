/**
 * KeydownEvent event registry
 * ----------------------
 * This class stores all application`keydown`events
 */

class KeydownEventRegistry {
    constructor(){
        this.keyListeners = {};

        // bind methods here
        this.addListener = this.addListener.bind(this);
        this.removeListener = this.removeListener.bind(this);
        this.numberOfListeners = this.numberOfListeners.bind(this);
        this.getListenerById = this.getListenerByid.bind(this);
        this.getListenersByKeyCombination = this.getListenersByKeyCombination.bind(this);
        this.getListenerByCellId = this.getListenerByCellId.bind(this);
        this.sendListenerData = this.sendListenerData.bind(this);
    }

    /* I add KeyListener to this.keyListeners
     * @param {Object} listener - an istance of the KeyListener class
     */
    addListener(listener){
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
    numberOfListers(){
        return Object.keys(this.keyListeners).length;
    }

    /* I return the listener by id.
     * @param {string} id - id of the listener
     */
    getListenerById(id){
        return this.keyListeners[id];
    }

    /* I find and return all listeners that match the keyComboString
     * pattern.
     * @param {Object} keyComboString - string
     * for example 'ctrl-D'
     */
    getListenersByKeyCombination(keyComboString){
        return; // TODO:
    }

    /* I return the listener by cell id.
     * @param {string} id - id of the listener
     */
    getListenerById(id){
        return; // TODO
    }

    /* I send this.keyListeners data over the WebSocket.
     */
    sendListenerData(){
        let responseData = {
            event: "KeyDownEventListenerInfoRequest",
            KeydownEventListeners: this.keyListeners
        };
        cellSocket.sendString(JSON.stringify(responseData));
    }
}


export {KeydownEventRegistry, KeydownEventRegistry as default};
