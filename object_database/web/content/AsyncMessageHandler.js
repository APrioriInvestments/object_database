/**
 * Async Message Handler
 * ---------------------------------
 * This class is built to handle async message
 * passing. It plays the role of an intermediary
 * between components that need async message handling,
 * the web socket and the cell handler.
 */

class AsyncMessageHandler {
    constructor() {
        this.queue = null;
        // this is where incoming messages that need to be cached for
        // later are stored
        this.cashe_queue = null;

        // Bind context to methods
        this.addToQueue = this.addToQueue.bind(this);
        this.removeFromQueue = this.removeFromQueue.bind(this);
        this._addToCacheQueue = this._addToCacheQueue._bind(this);
        this._removeFromCacheQueue = this._removeFromCacheQueue._bind(this);
    }

    /* I handle serve-side incoming messages and return a list
     * of messages (potenitally empty) to the CellHandler.
     */
    processMessage(message){
    }

    addToQueue(message){
        // make sure the message has the component name
        // and a timestamp
        if (message.target_cell === null) {
            throw "Message missing 'target_cell' id";
        }
        if (message.message_id === null) {
            throw "Message missing 'message_id' id";
        }
    }

    removeFromQueue(message){
        // make sure the message has the component name
        // and a timestamp
        if (message.target_cell === null) {
            throw "Message missing 'target_cell' id";
        }
        if (message.message_id === null) {
            throw "Message missing 'message_id' id";
        }
    }


    _addToCacheQueue(message){
    }


    _removeFromCacheQueue(message){
    }

}
