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
        this.queue = {};
        // this is where incoming messages that need to be cached for
        // later are stored
        this.cache_queue = {};

        // Bind context to methods
        this.addToQueue = this.addToQueue.bind(this);
        this.removeFromQueue = this.removeFromQueue.bind(this);
        this._addToCacheQueue = this._addToCacheQueue.bind(this);
        this._removeFromCacheQueue = this._removeFromCacheQueue.bind(this);
    }

    /* I handle serve-side incoming messages and return a list
     * of messages (potenitally empty) to the CellHandler.
     */
    processMessage(message){
    }

    addToQueue(message){
        // make sure the message has the component name
        // and a timestamp
        if (!message.id) {
            throw "Message missing component 'id'";
        }
        if (!message.message_id) {
            throw "Message missing 'message_id'";
        }

        if (!this.queue[message.id]){
            this.queue[message.id] = [message.message_id]
        } else {
            this.queue[message.id].push(message.message_id)
        }
    }

    removeFromQueue(message){
        // make sure the message has the component name
        // and a timestamp
        if (!message.id) {
            throw "Message missing component 'id'";
        }
        if (!message.message_id) {
            throw "Message missing 'message_id'";
        }
    }

    _addToCacheQueue(message){
    }


    _removeFromCacheQueue(message){
    }

}

export {AsyncMessageHandler, AsyncMessageHandler as default};
