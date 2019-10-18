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
        // messages to return
        let messages = [];
        // check if component/element id is in the queue
        if (!this.queue[message.id]){
            throw `Component id '${message.id}' has no messages in the queue.`
        }
        // check which order the current message_id takes in the queue for
        // that component
        let message_index = this.queue[message.id].indexOf(message.message_id);
        if (message_index === -1){
            throw `Message '${message.message_id}' not found in queue for component ${message.id}.`
        } else if(message_index === 0){
            // if the message_id is first in the queue return and all subsequent
            // cached messages; remove the relevant message_ids from the queue and messages
            // from the cache_queue
            this.removeFromQueue(message);
            messages.push(message);
            for (let i = 0; i < this.queue[message.id].length; i++){
                // if the next message_id in the queue corresponds to the next
                // message in the cache queue then we add it to the list of messages
                // to return and remove from the queues
                let message_id = this.queue[message.id][i];
                console.log(message_id);
                console.log(this.cache_queue);
                let cache_message_id = this.cache_queue[message.id][i];
                console.log(cache_message_id);
                if (message_id === cache_message_id){
                    messages.push(this._removeFromCacheQueue(message.id, message_id));
                }
            }
        } else {
            // if the message_id is not first in the queue cache the message for later
            this._addToCacheQueue(message);
        }
        return messages;
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
        if (!this.queue[message.id]){
            throw `No messages in queue for component ${message.id}`
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

    _removeFromCacheQueue(component_id, message_id){
        let removed_message = null;
        if (!this.cache_queue[component_id]){
            throw `No messages in cache_queue for component ${component_id}`
        }
        this.cache_queue[component_id].map((item, index) => {
            if (item.message_id === message_id){
                removed_message = this.cache_queue[component_id].pop(index);
            }
        })
        return removed_message;
    }
}

export {AsyncMessageHandler, AsyncMessageHandler as default};
