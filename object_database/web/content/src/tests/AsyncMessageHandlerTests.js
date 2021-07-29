/**
 * Tests for Message Handling in CellHandler
 */
require('jsdom-global')();
const AsyncMessageHandler = require('../AsyncMessageHandler.js').default;
const chai = require('chai');
const assert = chai.assert;

/* Example Messages and Structures */
let basic_message1 = {
    id: "Cell_1",
    message_id: 1,
    payload : {}
};

let basic_message11 = {
    id: "Cell_1",
    message_id: 11,
    payload : {}
};

let basic_message2 = {
    id: "Cell_2",
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
            "Cell_1": [1]
        }
        assert.equal(instance.queue["Cell_1"].toString(), test_queue["Cell_1"].toString());
    });
    it('Adding multiple single Cell messages to queue', () => {
        let instance = new AsyncMessageHandler();
        assert.equal(instance.queue.toString(), {}.toString());
        instance.addToQueue(basic_message1);
        instance.addToQueue(basic_message11);
        let test_queue = {
            "Cell_1": [1, 11],
        }
        assert.equal(instance.queue["Cell_1"].toString(), test_queue["Cell_1"].toString());
    });
    it('Adding multiple distinct Cell messages to queue', () => {
        let instance = new AsyncMessageHandler();
        assert.equal(instance.queue.toString(), {}.toString());
        instance.addToQueue(basic_message1);
        instance.addToQueue(basic_message11);
        instance.addToQueue(basic_message2);
        let test_queue = {
            "Cell_1": [1, 11],
            "Cell_2": [2],
        }
        assert.equal(instance.queue["Cell_1"].toString(), test_queue["Cell_1"].toString());
        assert.equal(instance.queue["Cell_2"].toString(), test_queue["Cell_2"].toString());
    });
    it('Adding message to queue errors', () => {
        let instance = new AsyncMessageHandler();
        assert.equal(instance.queue.toString(), {}.toString());
        try {
            instance.addToQueue(bad_message_id);
        } catch(e) {
            assert.equal(e, "Message missing Cell 'id'")
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
            assert.equal(e, "Message missing Cell 'id'")
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
            "Cell_1": [1, 11]
        }
        assert.equal(instance.queue["Cell_1"].toString(), test_queue["Cell_1"].toString());
        instance.removeFromQueue(basic_message11);
        test_queue = {
            "Cell_1": [1]
        }
        assert.equal(instance.queue["Cell_1"].toString(), test_queue["Cell_1"].toString());
    });
    it('Adding single message to cache queue', () => {
        let instance = new AsyncMessageHandler();
        assert.equal(instance.cache_queue.toString(), {}.toString());
        instance._addToCacheQueue(basic_message1);
        assert.equal(instance.cache_queue["Cell_1"].length, 1);
    });
    it('Remove single message from cache queue', () => {
        let instance = new AsyncMessageHandler();
        assert.equal(instance.cache_queue.toString(), {}.toString());
        instance._addToCacheQueue(basic_message1);
        assert.equal(instance.cache_queue["Cell_1"].length, 1);
        let removed_message = instance._removeFromCacheQueue(basic_message1);
        assert.equal(instance.cache_queue["Cell_1"].length, 0);
        assert.equal(removed_message.toString(), basic_message1.toString());
    });
});
