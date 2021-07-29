/**
 * Async Message Handler
 * ---------------------------------
 * This class is built to handle async message
 * passing. It plays the role of an intermediary
 * between Cells that need async message handling,
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
        // check if Cell/element id is in the queue
        if (!this.queue[message.id]){
            throw `Cell id ${message.id} }has no messages in the queue.`
        }
        // check which order the current message_id takes in the queue for
        // that Cell
        let message_index = this.queue[message.id][message.message_id];
        if (message_index === -1){
            throw `Message ${message.message_id} not found in queue for Cell ${message.id}.`
        } else if(message_index === 1){
            // if the message_id is first in the queue return and all subsequent
            // cached messages; remove the relevant message_ids from the queue and messages
            this.removeFromQueue(message);
            return [message]; // TODO add the other cached messages and remove them from the list
        } else {
            this._addToCacheQueue(message);
        }
        // from the cachec_queue
        // if the message_id is not first in the queue cache the message for later
    }

    addToQueue(message){
        // make sure the message has the Cell name
        // and a timestamp
        if (!message.id) {
            throw "Message missing Cell 'id'";
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
        // make sure the message has the Cell name
        // and a timestamp
        if (!message.id) {
            throw "Message missing Cell 'id'";
        }
        if (!message.message_id) {
            throw "Message missing 'message_id'";
        }
        if (!this.queue[message.id]){
            throw `No messages in queue for Cell ${message.id}`
        }
        this.queue[message.id].map((item, index) => {
            if (item === message.message_id){
                this.queue[message.id].pop(index);
            }
        })
    }

    _addToCacheQueue(message){
        if (!this.cache_queue[message.id]){
            this.cache_queue[message.id] = [message]
        } else {
            this.cache_queue[message.id].push(message)
        }
    }

    _removeFromCacheQueue(message){
        let removed_message = null;
        if (!this.cache_queue[message.id]){
            throw `No messages in cache_queue for Cell ${message.id}`
        }
        this.cache_queue[message.id].map((item, index) => {
            if (item.message_id === message.message_id){
                removed_message = this.cache_queue[message.id].pop(index);
            }
        })
        return removed_message;
    }

}

export {AsyncMessageHandler, AsyncMessageHandler as default};
