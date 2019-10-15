/**
 * Tests for Message Handling in NewCellHandler
 */
require('jsdom-global')();
const AsyncMessageHandler = require('../AsyncMessageHandler.js').default;
const chai = require('chai');
const assert = chai.assert;

/* Example Messages and Structures */
let basic_message1 = {
    id: "component_1",
    message_id: 1,
    payload : {}
};

let basic_message11 = {
    id: "component_1",
    message_id: 11,
    payload : {}
};

let basic_message2 = {
    id: "component_2",
    message_id: 2,
    payload : {}
};

let bad_message_id = {
    message_id: 2,
    payload : {}
};

let bad_message_m_id = {
    id: 2,
    payload : {}
};

describe("Basic AsyncMessageHandler Tests", () => {
    it('Should be able to initialize', () => {
        let instance = new AsyncMessageHandler();
        assert.exists(instance);
    });
    it('Adding single message to queue', () => {
        let instance = new AsyncMessageHandler();
        assert.equal(instance.queue.toString(), {}.toString());
        instance.addToQueue(basic_message1);
        let test_queue = {
            "component_1": [1]
        }
        assert.equal(instance.queue["component_1"].toString(), test_queue["component_1"].toString());
    });
    it('Adding multiple single component messages to queue', () => {
        let instance = new AsyncMessageHandler();
        assert.equal(instance.queue.toString(), {}.toString());
        instance.addToQueue(basic_message1);
        instance.addToQueue(basic_message11);
        let test_queue = {
            "component_1": [1, 11],
        }
        assert.equal(instance.queue["component_1"].toString(), test_queue["component_1"].toString());
    });
    it('Adding multiple distinct component messages to queue', () => {
        let instance = new AsyncMessageHandler();
        assert.equal(instance.queue.toString(), {}.toString());
        instance.addToQueue(basic_message1);
        instance.addToQueue(basic_message11);
        instance.addToQueue(basic_message2);
        let test_queue = {
            "component_1": [1, 11],
            "component_2": [2],
        }
        assert.equal(instance.queue["component_1"].toString(), test_queue["component_1"].toString());
        assert.equal(instance.queue["component_2"].toString(), test_queue["component_2"].toString());
    });
    it('Adding message to queue errors', () => {
        let instance = new AsyncMessageHandler();
        assert.equal(instance.queue.toString(), {}.toString());
        try {
            instance.addToQueue(bad_message_id);
        } catch(e) {
            assert.equal(e, "Message missing component 'id'")
        }
        try {
            instance.addToQueue(bad_message_m_id);
        } catch(e) {
            assert.equal(e, "Message missing 'message_id'")
        }
    });
    it('Removing message to queue errors', () => {
        let instance = new AsyncMessageHandler();
        assert.equal(instance.queue.toString(), {}.toString());
        try {
            instance.removeFromQueue(bad_message_id);
        } catch(e) {
            assert.equal(e, "Message missing component 'id'")
        }
        try {
            instance.removeFromQueue(bad_message_m_id);
        } catch(e) {
            assert.equal(e, "Message missing 'message_id'")
        }
    });
    it('Remove message to queue', () => {
        let instance = new AsyncMessageHandler();
        assert.equal(instance.queue.toString(), {}.toString());
        instance.addToQueue(basic_message1);
        instance.addToQueue(basic_message11);
        let test_queue = {
            "component_1": [1, 11]
        }
        assert.equal(instance.queue["component_1"].toString(), test_queue["component_1"].toString());
        instance.removeFromQueue(basic_message11);
        test_queue = {
            "component_1": [1]
        }
        assert.equal(instance.queue["component_1"].toString(), test_queue["component_1"].toString());
    });
    it('Adding single message to cache queue', () => {
        let instance = new AsyncMessageHandler();
        assert.equal(instance.cache_queue.toString(), {}.toString());
        instance._addToCacheQueue(basic_message1);
        assert.equal(instance.cache_queue["component_1"].length, 1);
    });
    it('Remove single message from cache queue', () => {
        let instance = new AsyncMessageHandler();
        assert.equal(instance.cache_queue.toString(), {}.toString());
        instance._addToCacheQueue(basic_message1);
        assert.equal(instance.cache_queue["component_1"].length, 1);
        let removed_message = instance._removeFromCacheQueue(basic_message1.id, basic_message1.message_id);
        assert.equal(instance.cache_queue["component_1"].length, 0);
        assert.equal(removed_message.toString(), basic_message1.toString());
    });
    it('Process message (basic).', () => {
        let instance = new AsyncMessageHandler();
        assert.equal(instance.cache_queue.toString(), {}.toString());
        instance.addToQueue(basic_message1);
        assert.equal(instance.queue[basic_message1.id].length, 1);
        let messages = instance.processMessage(basic_message1);
        assert.equal(messages.length, 1);
        assert.equal(instance.queue[basic_message1.id].length, 0);
    });
    it('Process message (add to cache queue).', () => {
        let instance = new AsyncMessageHandler();
        assert.equal(instance.cache_queue.toString(), {}.toString());
        instance.addToQueue(basic_message1);
        instance.addToQueue(basic_message11);
        assert.equal(instance.queue[basic_message1.id].length, 2);
        let messages = instance.processMessage(basic_message11);
        assert.equal(messages.length, 0);
        assert.equal(instance.cache_queue[basic_message11.id].length, 1);
        assert.equal(instance.cache_queue[basic_message11.id].toString(), basic_message11.toString());
    });
    it('Process message (multiple messages).', () => {
        let instance = new AsyncMessageHandler();
        assert.equal(instance.cache_queue.toString(), {}.toString());
        instance.addToQueue(basic_message1);
        instance.addToQueue(basic_message11);
        let messages = instance.processMessage(basic_message11);
        assert.equal(messages.length, 0);
        assert.equal(instance.queue[basic_message1.id].length, 2);
        assert.equal(instance.cache_queue[basic_message1.id].length, 1);
        messages = instance.processMessage(basic_message1);
        assert.equal(messages.length, 2);
        assert.equal(messages.toString(), [basic_message1, basic_message2].toString());
        assert.equal(instance.queue[basic_message1.id].length, 0);
        assert.equal(instance.cache_queue[basic_message11.id].length, 0);
    });
    it('Process message error (component has no messages in queue).', () => {
        let instance = new AsyncMessageHandler();
        assert.equal(instance.cache_queue.toString(), {}.toString());
        try {
            instance.processMessage(basic_message1);
        } catch(e) {
            assert.equal(e, `Component id '${basic_message1.id}' has no messages in the queue.`);
        }
    });
    it('Process message error (message id not foind in queue).', () => {
        let instance = new AsyncMessageHandler();
        assert.equal(instance.cache_queue.toString(), {}.toString());
        instance.addToQueue(basic_message1);
        assert.equal(instance.queue["component_1"].length, 1);
        try {
            instance.processMessage(basic_message11);
        } catch(e) {
            assert.equal(e,
                `Message '${basic_message11.message_id}' not found in queue for component ${basic_message11.id}.`
        );
        }
    });
});
