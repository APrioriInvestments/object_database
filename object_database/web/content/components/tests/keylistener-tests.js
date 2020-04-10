/*
 * Tests for Key event binding, listening and related
 */
require('jsdom-global')();
const maquette = require('maquette');
const h = maquette.h;
const NewCellHandler = require('../../NewCellHandler.js').default;
const chai = require('chai');
const assert = chai.assert;
const registry = require('../../KeyRegistry').KeyRegistry;
const KeyListener = require('../util/KeyListener.js').KeyListener;
const KeyBinding = require('../util/KeyListener.js').KeyBinding;
var Component = require('../Component.js').Component;
var render = require('../Component.js').render;


class MockEvent {
    constructor(){
        this.key = null;
        this.ctrlKey = false;
        this.metaKey = false;
        this.shiftKey = false;
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

class MockComponent extends Component {
    constructor(props, ...args){
        super(props, ...args);
    }

    build(){
        return (
            h('div', {
                id: this.getElementId(),
                'data-cell-id': `${this.props.id}`,
                class: "test-component subcomponent"
            }, [`Child: ${this.props.id}`])
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
});
