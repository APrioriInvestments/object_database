/*
 * Tests for Key event binding, listening and related
 */
require('jsdom-global')();
const h = require('../Cell.js').makeDomElt;
const CellHandler = require('../../CellHandler.js').default;
const chai = require('chai');
const assert = chai.assert;
const registry = require('../../KeyRegistry').KeyRegistry;
const KeyRegistry = require('../../KeyRegistry.js').KeyRegistry;
const KeyListener = require('../util/KeyListener.js').KeyListener;
const KeyBinding = require('../util/KeyListener.js').KeyBinding;
var Cell = require('../Cell.js').Cell;


class MockEvent {
    constructor(){
        this.key = null;
        this.ctrlKey = false;
        this.metaKey = false;
        this.shiftKey = false;
        this.altKey = false;
        this.isStopPropagation = false;
        this.isStopImmediatePropagation = false;
        this.isPreventDefault = false;

        // bind methods
        this.stopPropagation = this.stopPropagation.bind(this);;
        this.stopImmediatePropagation = this.stopImmediatePropagation.bind(this);
        this.preventDefault = this.preventDefault.bind(this);
    }

    stopPropagation(){
        this.isStopPropagation = true;
    }

    stopImmediatePropagation(){
        this.isStopImmediatePropagation = true;
    }

    preventDefault(){
        this.isPreventDefault = true;
    }
};

class MockCell extends Cell {
    constructor(props, ...args){
        super(props, ...args);
    }

    buildDomElement() {
        return (
            h('div', {
                id: this.getElementId(),
                'data-cell-id': `${this.identity}`,
                'data-cell-type': "test",
                class: "test-Cell subCell"
            }, ['I am a test Cell'])
        );
    }
};

describe("Keydown Event Tests.", () => {
    describe("KeyBinding Class Tests.", () => {
        before(() => {});
        after(() => {});
        it("Handle (single key)", () => {
            let command = "S";
            let handler = function testHadler() {return true};
            let mockEvent = new MockEvent();
            mockEvent.key = "S";
            let kb = new KeyBinding(command, handler);
            let result  = kb.handle(mockEvent);
            assert.isTrue(result);
        });
        it("Handle ignore (single key)", () => {
            let command = "S";
            let handler = function testHadler() {return true};
            let mockEvent = new MockEvent();
            mockEvent.key = "notS";
            let kb = new KeyBinding(command, handler);
            let result  = kb.handle(mockEvent);
            assert.isFalse(result);
        });
        it("Handle (key combo 1)", () => {
            let command = "shiftKey+S";
            let handler = function testHadler() {return true};
            let mockEvent = new MockEvent();
            mockEvent.key = "S";
            mockEvent.shiftKey = true;
            let kb = new KeyBinding(command, handler);
            let result  = kb.handle(mockEvent);
            assert.isTrue(result);
        });
        it("Handle ignore on key (key combo 1)", () => {
            let command = "shiftKey+S";
            let handler = function testHadler() {return true};
            let mockEvent = new MockEvent();
            mockEvent.key = "notS";
            mockEvent.shiftKey = true;
            let kb = new KeyBinding(command, handler);
            let result  = kb.handle(mockEvent);
            assert.isFalse(result);
        });
        it("Handle ignore on mod (key combo 1)", () => {
            let command = "shiftKey+S";
            let handler = function testHadler() {return true};
            let mockEvent = new MockEvent();
            mockEvent.key = "S";
            let kb = new KeyBinding(command, handler);
            let result  = kb.handle(mockEvent);
            assert.isFalse(result);
        });
        it("Handle (key combo 2)", () => {
            let command = "ctrlKey+shiftKey+S";
            let handler = function testHadler() {return true};
            let mockEvent = new MockEvent();
            mockEvent.key = "S";
            mockEvent.shiftKey = true;
            mockEvent.ctrlKey = true;
            let kb = new KeyBinding(command, handler);
            let result  = kb.handle(mockEvent);
            assert.isTrue(result);
        });
        it("Handle ignore on key (key combo 2)", () => {
            let command = "ctrlKey+shiftKey+S";
            let handler = function testHadler() {return true};
            let mockEvent = new MockEvent();
            mockEvent.key = "notS";
            mockEvent.shiftKey = true;
            mockEvent.ctrlKey = true;
            let kb = new KeyBinding(command, handler);
            let result  = kb.handle(mockEvent);
            assert.isFalse(result);
        });
        it("Handle ignore on mod (key combo 2)", () => {
            let command = "ctrlKey+shiftKey+S";
            let handler = function testHadler() {return true};
            let mockEvent = new MockEvent();
            mockEvent.key = "S";
            mockEvent.shiftKey = true;
            let kb = new KeyBinding(command, handler);
            let result  = kb.handle(mockEvent);
            assert.isFalse(result);
        });
        it("Propagation", () => {
            let command = "S";
            let handler = function testHadler() {return true};
            let mockEvent = new MockEvent();
            mockEvent.key = "S";
            let kb = new KeyBinding(command, handler);
            kb.handle(mockEvent);
            assert.isFalse(mockEvent.isStopPropagation);
            kb = new KeyBinding(command, handler, stopPropagation=true);
            kb.handle(mockEvent);
            assert.isTrue(mockEvent.isStopPropagation);
        });
        it("Immediate Propagation", () => {
            let command = "S";
            let handler = function testHadler() {return true};
            let mockEvent = new MockEvent();
            mockEvent.key = "S";
            let kb = new KeyBinding(command, handler);
            kb.handle(mockEvent);
            assert.isFalse(mockEvent.isStopImmediatePropagation);
            kb = new KeyBinding(command, handler, stopPropagation=false,
                stopImmediatePropagation=true);
            kb.handle(mockEvent);
            assert.isTrue(mockEvent.isStopImmediatePropagation);
        });
        it("Prevent Default", () => {
            let command = "S";
            let handler = function testHadler() {return true};
            let mockEvent = new MockEvent();
            mockEvent.key = "S";
            let kb = new KeyBinding(command, handler);
            kb.handle(mockEvent);
            assert.isFalse(mockEvent.isPreventDefault);
            kb = new KeyBinding(command, handler, stopPropagation=false,
                stopImmediatePropagation=false, preventDefault=true);
            kb.handle(mockEvent);
            assert.isTrue(mockEvent.isPreventDefault);
        });
    });

    describe("KeyListener Class Tests.", () => {
        before(() => {
            // NOTE: this is a global object so will persist throughout the tests
            window.keyRegistry = new KeyRegistry();
            command = "S";
            handler = function testHadler() {return true};
            keyBindingSingle = new KeyBinding(command, handler);
            command = "shiftKey+S";
            handler = function testHadler() {return true};
            keyBindingCombo = new KeyBinding(command, handler);
            Cell = new MockCell({id: '1000'});
            renderedCell = Cell.buildDomElement();
            // add dataset attributes to mock the DOM element data
            renderedCell["dataset"] = {
                "cellId": renderedCell.attributes["data-cell-id"],
                "cellType": renderedCell.attributes["data-cell-type"],
            };
            renderedCell.id = "1000";
            // mock the add & remove event listeners
            renderedCell.addEventListener = function(eventName, callback, kwargs){
                return;
            };
            renderedCell.removeEventListener = function(eventName, callback, kwargs){
                return;
            };
        });
        after(() => {
            // reset the registry
            window.keyRegistry = new KeyRegistry();
        });
        it("KeyListener instantiation", () => {
            let kl = new KeyListener(renderedCell, [keyBindingSingle, keyBindingCombo]);
            assert.equal(kl.bindings.length, 2);
            assert.equal(kl.id, 'test-1000');
        });
        it("KeyListener adding and removing listener", () => {
            let kl = new KeyListener(renderedCell, [keyBindingSingle, keyBindingCombo]);
            assert.equal(kl.bindings.length, 2);
            assert.exists(window.keyRegistry.keyListeners);
            assert.equal(Object.keys(window.keyRegistry.keyListeners).length, 0);
            kl.start();
            assert.equal(Object.keys(window.keyRegistry.keyListeners).length, 1);
            kl.pause();
            assert.equal(Object.keys(window.keyRegistry.keyListeners).length, 0);
        });
        it.skip("KeyListener removing listener", () => {
            let kl = new KeyListener(renderedCell, [keyBindingSingle, keyBindingCombo]);
            assert.equal(kl.bindings.length, 2);
            assert.exists(window.keyRegistry.keyListeners);
            kl.start();
            console.log(window.keyRegistry);
            assert.equal(Object.keys(window.keyRegistry.keyListeners).length, 1);
            kl.pause();
            assert.equal(Object.keys(window.keyRegistry.keyListeners).length, 0);
        });
    });
    describe("KeyRegistry Class Tests.", () => {
        before(() => {
            // NOTE: this is a global object so will persist throughout the tests
            window.keyRegistry = new KeyRegistry();
            command = "S";
            handler = function testHadler() {return true};
            keyBindingSingle = new KeyBinding(command, handler);
            command = "shiftKey+S";
            handler = function testHadler() {return true};
            keyBindingCombo = new KeyBinding(command, handler);
            Cell1 = new MockCell({id: '1000'});
            Cell2 = new MockCell({id: '2000'});
            renderedCell1 = Cell1.buildDomElement();
            renderedCell2 = Cell2.buildDomElement();
            // add dataset attributes to mock the DOM element data
            renderedCell1["dataset"] = {
                "cellId": renderedCell1.attributes["data-cell-id"],
                "cellType": renderedCell1.attributes["data-cell-type"],
            };
            renderedCell1.id = "cell-1000";
            // mock the add & remove event listeners
            renderedCell1.addEventListener = function(eventName, callback, kwargs){
                return;
            };
            renderedCell1.removeEventListener = function(eventName, callback, kwargs){
                return;
            };
            renderedCell2["dataset"] = {
                "cellId": renderedCell2.attributes["data-cell-id"],
                "cellType": renderedCell2.attributes["data-cell-type"],
            };
            renderedCell2.id = "cell-2000";
            // mock the add & remove event listeners
            renderedCell2.addEventListener = function(eventName, callback, kwargs){
                return;
            };
            renderedCell2.removeEventListener = function(eventName, callback, kwargs){
                return;
            };
            // add some listeners
            kl1 = new KeyListener(renderedCell1, [keyBindingSingle, keyBindingCombo]);
            kl1.start();
            kl2 = new KeyListener(renderedCell2, [keyBindingCombo]);
            kl2.start();
        });
        after(() => {
            // reset the registry
            window.keyRegistry = new KeyRegistry();
        });
        it("Basic setup, number of Listeners", () => {
            assert.exists(window.keyRegistry.keyListeners);
            assert.equal(window.keyRegistry.numberOfListeners(), 2);
        });
        it.skip("Adding an existing listener error", () => {
            kl = new KeyListener(renderedCell1, [keyBindingSingle, keyBindingCombo]);
            try {
                kl.start();
            } catch(e){
                assert.ok(e);
            }
        });
        it("Get listener by id", () => {
            let listener = window.keyRegistry.getListenerById('test-cell-1000');
            assert.exists(listener);
            assert.equal(listener.target.id, 'cell-1000');
            listener = window.keyRegistry.getListenerById('BAD_ID');
            assert.notExists(listener);
        });
        it("Get listener by key combination", () => {
            let listeners = window.keyRegistry.getListenersByKeyCombination('S');
            assert.exists(listeners);
            assert.equal(listeners.length, 1);
            assert.equal(listeners[0].target.id, 'cell-1000');
            listeners = window.keyRegistry.getListenersByKeyCombination('shiftKey+S');
            assert.exists(listeners);
            assert.equal(listeners.length, 2);
        });
    });
});

describe('KeyListener Exclusivity Tests', () => {
    it('When ArrowRight and ArrowRight+shifKey, only trigger former', () => {
        let arrowCalled = false;
        let arrowShiftCalled = false;
        let singleBinding = new KeyBinding('ArrowRight', (e) => {
            arrowCalled = true;
        });
        let compoundBinding = new KeyBinding('shiftKey+ArrowRight', (e) => {
            arrowShiftCalled = true;
        });
        let mockEvent = new MockEvent(); // No shift key
        mockEvent.key = 'ArrowRight';
        singleBinding.handle(mockEvent);
        compoundBinding.handle(mockEvent);

        assert.isFalse(arrowShiftCalled);
        assert.isTrue(arrowCalled);
    });

    it('When ArrowRight and ArrowRight+shiftKey, only trigger latter', () => {
        let arrowCalled = false;
        let arrowShiftCalled = false;
        let singleBinding = new KeyBinding('ArrowRight', (e) => {
            arrowCalled = true;
        });
        let compoundBinding = new KeyBinding('shiftKey+ArrowRight', (e) => {
            arrowShiftCalled = true;
        });
        let mockEvent = new MockEvent();
        mockEvent.shiftKey = true;
        mockEvent.key = 'ArrowRight';

        singleBinding.handle(mockEvent);
        compoundBinding.handle(mockEvent);

        assert.isFalse(arrowCalled);
        assert.isTrue(arrowShiftCalled);
    });

    it('Calls correct binding in more complex example 1 (See comments)', () => {
        let firstCalled = false;
        let secondCalled = false;
        let firstBinding = new KeyBinding('altKey+shiftKey+PageUp', (e) => {
            firstCalled = true;
        });
        let secondBinding = new KeyBinding('altKey+PageUp', (e) => {
            secondCalled = true;
        });

        let mockEvent = new MockEvent();
        mockEvent.shiftKey = true;
        mockEvent.altKey = true;
        mockEvent.key = 'PageUp';

        firstBinding.handle(mockEvent);
        secondBinding.handle(mockEvent);

        assert.isTrue(firstCalled);
        assert.isFalse(secondCalled);
    });
});
