/**
 * Subscribed Tests
 * ----------------------------------------
 * These tests handle full CellHandler, rendering
 * and DOM integration for components that
 * interact with Subscribeds
 */
require('jsdom-global')();
const maquette = require('maquette');
const h = maquette.h;
const NewCellHandler = require('../NewCellHandler.js').default;
const AllComponents = require('../ComponentRegistry').default;
const chai = require('chai');
const assert = chai.assert;
let projector = maquette.createProjector();
const registry = require('../ComponentRegistry').ComponentRegistry;

/* Example Messages and Structures */
let simpleRoot = {
    id: "page_root",
    cellType: "RootCell",
    parentId: null,
    nameInParent: null,
    extraData: {},
    namedChildren: {}
};

let subscribedTemplate = {
    id: 'replaceme',
    cellType: 'Subscribed',
    parentId: null,
    nameInParent: null,
    extraData: {},
    namedChildren: {}
};

let textTemplate = {
    id: 'replaceme',
    cellType: 'Text',
    extraData: {
        rawText: "TEXT1"
    },
    namedChildren: {}
};

let makeUpdateMessage = (compDescription) => {
    return Object.assign({}, compDescription, {
        channel: "#main",
        type: "#cellUpdated",
        shouldDisplay: true
    });
};

let makeCreateMessage = (compDescription) => {
    return Object.assign({}, compDescription, {
        channel: "#main",
        type: "#cellUpdated",
        shouldDisplay: true
    });
};

let makeDiscardedMessage = (compDescription) => {
    return Object.assign({}, compDescription, {
        channel: "#main",
        type: "#cellDiscarded"
    });
};


describe("Subscribed Tests", () => {
    describe("Renders a single basic Subscribed", () => {
        var sub = Object.assign({}, subscribedTemplate, {
            id: '1',
            nameInParent: 'child',
            parentId: simpleRoot.id
        });
        var root = Object.assign({}, simpleRoot, {
            namedChildren: {
                child: sub
            }
        });
        var handler = new NewCellHandler(h, projector, registry);
        before(() => {
            let rootEl = document.createElement('div');
            rootEl.id = 'page_root';
            document.body.append(rootEl);
        });
        after(() => {
            let rootEl = document.getElementById('page_root');
            rootEl.remove();
        });
        it("Can create components for basic structure", () => {
            assert.exists(sub);
            assert.exists(root);
            let createMessage = makeCreateMessage(root);
            handler.receive(createMessage);
            let storedRoot = handler.activeComponents[root.id];
            let storedSubscribed = handler.activeComponents[sub.id];
            assert.exists(storedRoot);
            assert.exists(storedSubscribed);
        });

        it("Subscrbed placeholder (empty) is present in the DOM", () => {
            let foundSubEl = document.querySelector(`[data-cell-id="${sub.id}"]`);
            assert.exists(foundSubEl);
            assert.equal(foundSubEl.style.display, "none");
        });

        it("Subscribed chain is empty", () => {
            let subComponent = handler.activeComponents[sub.id];
            assert(subComponent);
            let chain = subComponent.getSubscribedChain();
            assert.isEmpty(chain);
        });

        it("No other DOM elements should have data-attrs for subscription", () => {
            let found = document.querySelector(`[data-subscribed-to="${sub.id}"]`);
            assert.notExists(found);
        });

        it("Can properly receive and update message for the Subscribed", () => {
            let text = Object.assign({}, textTemplate, {
                id: '2',
                extraData: {
                    rawText: 'Text2'
                }
            });
            sub = Object.assign({}, sub, {
                namedChildren: {
                    content: text
                }
            });
            let updateMessage = makeUpdateMessage(sub);
            handler.receive(updateMessage);
            let subComponent = handler.activeComponents[sub.id];
            assert.exists(subComponent);
            let textComponent = handler.activeComponents[text.id];
            assert.exists(textComponent);
        });

        it('Subscribed placeholder is removed from the DOM', () => {
            let placeholder = document.querySelector('[data-cell-id="${sub.id}"]');
            assert.notExists(placeholder);
        });

        it('Subscribed Text content element is present in the DOM', () => {
            let textId = 2;
            let textEl = document.querySelector(`[data-cell-id="${textId}"]`);
            assert.exists(textEl);
        });

        it('Subscribed Text element has correct mapped data attribute', () => {
            let textEl = document.querySelector(`[data-subscribed-to="${sub.id}"]`);
            assert.exists(textEl);
        });

        it("Subscribed Text component has correct Subscribed Chain", () => {
            let subComponent = handler.activeComponents[sub.id];
            let textComponent = handler.activeComponents['2'];
            assert.exists(subComponent);
            assert.exists(textComponent);
            let chain = textComponent.getSubscribedChain();
            assert.equal(1, chain.length);
            assert.include(chain, subComponent);
        });

        it("Subscribed Text component top ancestor is the Subscribed", () => {
            let subComponent = handler.activeComponents[sub.id];
            let textComponent = handler.activeComponents['2'];
            assert.exists(subComponent);
            assert.exists(textComponent);
            let topAncestor = textComponent.getTopSubscribedAncestor();
            assert.equal(subComponent, topAncestor);
        });

        it("Can update again back to empty", () => {
            sub = Object.assign({}, sub, {
                namedChildren: {}
            });
            let updateMessage = makeUpdateMessage(sub);
            handler.receive(updateMessage);
            let subComponent = handler.activeComponents[sub.id];
            assert.exists(subComponent);
        });

        it('Subscribed placeholder is again present in the DOM', () => {
            let placeholder = document.querySelector(`[data-cell-id="${sub.id}"]`);
            assert.exists(placeholder);
        });

        it("There are no other elements with mapped subscribed data-attrs", () => {
            let found = document.querySelector(`[data-subscribed-to="${sub.id}"]`);
            assert.notExists(found);
        });

        it("The Text element is definitely not present in the DOM", () => {
            let textElById = document.querySelector(`[data-cell-id="2"]`);
            assert.notExists(textElById);
            let textElByType = document.querySelector('[data-cell-type="Text"]');
            assert.notExists(textElByType);
        });
    });

    describe("Two Nested Subscribed Tests", () => {
        var handler = new NewCellHandler(h, projector, registry);
        before(() => {
            let rootEl = document.createElement('div');
            rootEl.id = 'page_root';
            document.body.append(rootEl);
        });
        after(() => {
            let rootEl = document.getElementById('page_root');
            rootEl.remove();
        });
        var childSub = Object.assign({}, subscribedTemplate, {
            id: '2'
        });
        var parentSub = Object.assign({}, subscribedTemplate, {
            id: '1'
        });
        var root = Object.assign({}, simpleRoot, {
            namedChildren: {
                child: parentSub
            }
        });

        // Alternate child of parentSub
        var text1 = Object.assign({}, textTemplate, {
            id: '3',
            extraData: {
                rawText: 'Text3'
            }
        });

        // Alternate child of childSub
        var text2 = Object.assign({}, textTemplate, {
            id: '4',
            extraData: {
                rawText: 'Text4'
            }
        });

        it('Can render two empty nested Subscribeds', () => {
            parentSub = Object.assign({}, parentSub, {
                namedChildren: {
                    content: childSub
                }
            });
            root = Object.assign({}, root, {
                namedChildren: {
                    child: parentSub
                }
            });
            let createMessage = makeCreateMessage(root);
            handler.receive(createMessage);
            let parentSubComp = handler.activeComponents[parentSub.id];
            assert.exists(parentSubComp);
            let childSubComp = handler.activeComponents[childSub.id];
            assert.exists(childSubComp);
        });

        it("There should be a single Subscribed placeholder in the DOM", () => {
            let placeholders = document.querySelectorAll('[data-cell-type="Subscribed"]');
            assert.exists(placeholders);
            assert.equal(1, placeholders.length);
        });

        it("The present placeholder should have the child Subscribed's id", () => {
            let placeholder = document.querySelector('[data-cell-type="Subscribed"]');
            assert.exists(placeholder);
            assert.equal(placeholder.id, childSub.id);
        });

        it("The present placeholder should have a subscribed-to attr mapped to parent Subscribed", () => {
            let placeholder = document.querySelector(`[data-subscribed-to="${parentSub.id}"]`);
            assert.exists(placeholder);
        });

        it("Can update the child Subscribed to display text", () => {
            childSub = Object.assign({}, childSub, {
                namedChildren: {
                    content: text2
                }
            });
            let updateMessage = makeUpdateMessage(childSub);
            handler.receive(updateMessage);
            let text2Comp = handler.activeComponents[text2.id];
            assert.exists(text2Comp);
        });

        it("There should be a Text in the dom with proper id", () => {
            let foundText = document.querySelector(`[data-cell-id="${text2.id}"]`);
            assert.exists(foundText);
        });

        it("There should be no Subscribed placeholders in the DOM", () => {
            let placeholders = document.querySelectorAll('[data-cell-type="Subscribed"]');
            assert.equal(0, placeholders.length);
        });

        it("Can update the Text of child Subscribed", () => {
            text2 = Object.assign({}, text2, {
                id: '5',
                extraData: {
                    rawText: 'Text5'
                }
            });
            childSub = Object.assign({}, childSub, {
                namedChildren: {
                    content: text2
                }
            });
            let updateMessage = makeUpdateMessage(childSub);
            handler.receive(updateMessage);
            let text2Comp = handler.activeComponents[text2.id];
            assert.exists(text2Comp);
        });

        it("There should be a single Text in the DOM with the proper id", () => {
            let foundTexts = document.querySelectorAll('[data-cell-type="Text"]');
            assert.equal(1, foundTexts.length);
            assert.equal(foundTexts[0].id, '5');
        });

        it("Can update the Text of the parent Subscribed, overwriting child", () => {
            parentSub = Object.assign({}, parentSub, {
                namedChildren: {
                    content: text1
                }
            });
            let updateMessage = makeUpdateMessage(parentSub);
            handler.receive(updateMessage);
            let text1Comp = handler.activeComponents[text1.id];
            assert.exists(text1Comp);
        });

        it("There should be a single Text in the DOM with the proper id", () => {
            let foundTexts = document.querySelectorAll('[data-cell-type="Text"]');
            assert.equal(1, foundTexts.length);
            assert.equal(foundTexts[0].id, text1.id);
        });

        it("There should be no Subscribed placeholders in the DOM", () => {
            let placeholders = document.querySelectorAll('[data-cell-type="Subscribed"]');
            assert.isEmpty(placeholders);
        });

        it("Can update parent Subscribed to be empty", () => {
            parentSub = Object.assign({}, parentSub, {
                namedChildren: {}
            });
            let updateMessage = makeUpdateMessage(parentSub);
            handler.receive(updateMessage);
            let parentComp = handler.activeComponents[parentSub.id];
            assert.exists(parentComp);
        });

        it("Has a single placeholder corresponding to the parent Subscribed", () => {
            let placeholders = document.querySelectorAll('[data-cell-type="Subscribed"]');
            assert.equal(1, placeholders.length);
            assert.equal(placeholders[0].id, parentSub.id);
        });

        it("There are no subscribed-to elements in the DOM", () => {
            let subscribedToEls = document.querySelectorAll('[data-subscribed-to]');
            assert.isEmpty(subscribedToEls);
        });

        it("There are no Texts in the DOM", () => {
            let foundTexts = document.querySelectorAll('[data-cell-type="Text"]');
            assert.isEmpty(foundTexts);
        });
    });
});
