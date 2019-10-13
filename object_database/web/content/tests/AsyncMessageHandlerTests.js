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
    });
});
