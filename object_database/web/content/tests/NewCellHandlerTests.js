/**
 * Tests for Message Handling in NewCellHandler
 */
require('jsdom-global')();
const maquette = require('maquette');
const h = maquette.h;
const NewCellHandler = require('../NewCellHandler.js').default;
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

let firstText = {
    id: 3,
    cellType: "Text",
    extraData: {
        rawText: "Hello"
    },
    namedChildren: {}
};

let secondText = {
    id: 4,
    cellType: "Text",
    extraData: {
        rawText: "Hello"
    },
    namedChildren: {}
};

let thirdText = {
    id: 5,
    cellType: "Text",
    extraData: {
        rawText: "AGAIN!"
    },
    namedChildren: {}
};

let simpleSequence = {
    id: 2,
    cellType: "Sequence",
    extraData: {},
    namedChildren: {
        "elements": []
    }
};

let simpleSheet = {
    id: 6,
    cellType: "Sheet",
    extraData: {
        "columnNames": ["Col1", "Col2", "Col3"],
        "num_rows": 10,
        "colWidth": 100,
        "rowHeight": 20
    },
    namedChildren: {}
};

let simpleNestedStructure = Object.assign({}, simpleRoot, {
    namedChildren: {
        "child": Object.assign({}, simpleSequence, {
            id: 2,
            nameInParent: "child",
            parentId: 1,
            namedChildren: {
                "elements": [
                    Object.assign({}, firstText, {
                        id: 3,
                        nameInParent: "elements",
                        parentId: 2
                    }),
                    Object.assign({}, secondText, {
                        id: 4,
                        nameInParent: "elements",
                        parentId: 2
                    })
                ]
            }
        })
    }
});
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


describe("Basic NewCellHandler Tests", () => {
    it('Should be able to initialize', () => {
        let instance = new NewCellHandler(h, projector, registry);
        assert.exists(instance);
    });
    it('Has the passed in projector', () => {
        let handler = new NewCellHandler(h, projector, registry);
        assert.equal(projector, handler.projector);
    });
    it('Has the passed in hyperscript constructor', () => {
        let handler = new NewCellHandler(h, projector, registry);
        assert.equal(h, handler.h);
    });
});

describe("Basic Test DOM Tests", () => {
    it("Has a document and body", () => {
        assert.exists(document.body);
    });
    it("Can create and append root element", () => {
        let root = document.createElement('div');
        root.id = "page_root";
        document.body.append(root);
        let found = document.getElementById('page_root');
        assert.exists(found);
        assert.equal(found, root);
    });

    after(() => {
        let root = document.getElementById('page_root');
        if(root){
            root.remove();
        }
    });
});

describe("Basic Structure Handling Component Tests", () => {
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

    it("Creates and stores new RootCell instance", () => {
        let createMessage = makeCreateMessage(simpleRoot);
        handler.receive(createMessage);
        let stored = handler.activeComponents[simpleRoot.id];
        assert.exists(stored);
    });
    it("Root component should have only rendered once for now", () => {
        let component = handler.activeComponents[simpleRoot.id];
        assert.equal(component.numRenders, 1);
    });
    it("Initial RootCell instance has no named children", () => {
        let rootComponent = handler.activeComponents[simpleRoot.id];
        assert.notExists(rootComponent.props.namedChildren['child']);
    });
    it("Creates and stores a new TextCell component", () => {
        let child = Object.assign({}, firstText, {
            parentId: simpleRoot.id,
            nameInParent: 'child'
        });
        let updatedParent = Object.assign({}, simpleRoot, {
            namedChildren: {
                child: child
            }
        });
        assert.notExists(handler.activeComponents[child.id]);
        let updateMessage = makeUpdateMessage(updatedParent);
        handler.receive(updateMessage);
        let stored = handler.activeComponents[child.id];
        assert.exists(stored);
    });
    it("Root should now have rendered exactly twice", () => {
        let component = handler.activeComponents[simpleRoot.id];
        assert.equal(component.numRenders, 2);
    });
    it("Child Text component should have rendered only once for now", function(){
        let component = handler.activeComponents[firstText.id];
        assert.equal(component.numRenders, 1);
    });
    it("RootCell has namedChild 'child' that matches Text component", () => {
        let textComp = handler.activeComponents[firstText.id];
        let parent = handler.activeComponents[simpleRoot.id];
        let namedChild = parent.props.namedChildren['child'];
        assert.equal(textComp, namedChild);
    });
    it("Text component parent attribute set to Root", () => {
        let textComp = handler.activeComponents[firstText.id];
        let parent = handler.activeComponents[simpleRoot.id];
        assert.equal(textComp.parent, parent);
    });
    it("Text component is present in the handler's store", () => {
        let found = handler.activeComponents[firstText.id];
        assert.exists(found);
        assert.equal(found.name, "Text");
    });
    it("Text component has rawText prop value 'WORLD' after update", () => {
        let textComp = handler.activeComponents[firstText.id];
        let updatedText = Object.assign({}, firstText, {
            extraData: {
                rawText: "WORLD"
            }
        });
        let updateMessage = makeUpdateMessage(updatedText);
        let foo = handler.receive(updateMessage);
        assert.equal(handler.activeComponents[firstText.id], foo);
        assert.equal(textComp.props.rawText, "WORLD");
    });
});

describe("Complex Structure Handling Component Tests", () => {
    var handler;
    before(() => {
        let rootEl = document.createElement('div');
        rootEl.id = "page_root";
        document.body.append(rootEl);
        handler = new NewCellHandler(h, projector, registry);
    });
    after(() => {
        let rootEl = document.getElementById("page_root");
        rootEl.remove();
    });
    describe("Initial Render", () => {
        it("Should create Components from a 3-deep nested description", () => {
            let struct = Object.assign({}, simpleNestedStructure);
            let message = makeCreateMessage(struct);
            let result = handler.receive(message);
            assert.exists(result);
        });
        it("Handler should have Root component", () => {
            let component = handler.activeComponents[simpleRoot.id];
            assert.exists(component);
        });
        it("Root component should only have rendered once for now", () => {
            let component = handler.activeComponents[simpleRoot.id];
            assert.equal(component.numRenders, 1);
        });
        it("Handler should have Sequence component", () => {
            let component = handler.activeComponents[simpleSequence.id];
            assert.exists(component);
        });
        it("Sequence component should only have rendered once for now", () => {
            let component = handler.activeComponents[simpleSequence.id];
            assert.equal(component.numRenders, 1);
        });
        it("Root namedChild 'child' should be Sequence component", () => {
            let parent = handler.activeComponents[simpleRoot.id];
            let child = handler.activeComponents[simpleSequence.id];
            assert.equal(parent.props.namedChildren['child'], child);
        });
        it("Sequence component's parent should be Root component", () => {
            let sequence = handler.activeComponents[simpleSequence.id];
            let root = handler.activeComponents[simpleRoot.id];
            assert.equal(sequence.parent, root);
        });
        it("Handler should have the first Text component", () => {
            let component = handler.activeComponents[firstText.id];
            assert.exists(component);
        });
        it("First Text component should have only rendered once", () => {
            let component = handler.activeComponents[firstText.id];
            assert.equal(component.numRenders, 1);
        });
        it("First Text component should be in array children of Sequence (elements)", () => {
            let sequence = handler.activeComponents[simpleSequence.id];
            let component = handler.activeComponents[firstText.id];
            let elements = sequence.props.namedChildren['elements'];
            assert.include(elements, component, "Sequence children elements contains child");
            assert.equal(elements[0], component);
        });
        it("Handler should have the second Text component", () => {
            let component = handler.activeComponents[secondText.id];
            assert.exists(component);
        });
        it("Second Text component should have only rendered once", () => {
            let component = handler.activeComponents[secondText.id];
            assert.equal(component.numRenders, 1);
        });
        it("Second Text component should be in array children of Sequence (elements)", () => {
            let sequence = handler.activeComponents[simpleSequence.id];
            let component = handler.activeComponents[secondText.id];
            let elements = sequence.props.namedChildren['elements'];
            assert.include(elements, component);
            assert.equal(elements[1], component);
        });
    });
    describe("Update the Sequence, inserting a third text (between original)", () => {
        it("Should update the Sequence component without error", () => {
            let newElements = [];
            let sequence = handler.activeComponents[simpleSequence.id];
            let newText = Object.assign({}, thirdText);
            let seqDescription = Object.assign({}, simpleNestedStructure.namedChildren['child']);
            newElements.push(seqDescription.namedChildren['elements'][0]);
            newElements.push(newText);
            newElements.push(seqDescription.namedChildren['elements'][1]);
            let updatedSequence = Object.assign({}, seqDescription, {
                namedChildren: {
                    elements: newElements
                }
            });
            let updateMessage = makeUpdateMessage(updatedSequence);
            let result = handler.receive(updateMessage);
            assert.exists(result);
        });
        it("Root should still have only rendered once", () => {
            let root = handler.activeComponents[simpleRoot.id];
            assert.equal(root.numRenders, 1);
        });
        it("Sequence should have now rendered twice", () => {
            let component = handler.activeComponents[simpleSequence.id];
            assert.equal(component.numRenders, 2);
        });
        it("Sequence should have First Text as the first namedChild element", () => {
            let sequence = handler.activeComponents[simpleSequence.id];
            let component = handler.activeComponents[firstText.id];
            let elements = sequence.props.namedChildren['elements'];
            assert.include(elements, component);
            assert.equal(elements[0], component);
        });
        it("Sequence should have Third Text as the *second* namedChild element", () => {
            let sequence = handler.activeComponents[simpleSequence.id];
            let component = handler.activeComponents[thirdText.id];
            let elements = sequence.props.namedChildren['elements'];
            assert.include(elements, component);
            assert.equal(elements[1], component);
        });
        it("Sequence should have the Second text as the *third* namedChild element", () => {
            let sequence = handler.activeComponents[simpleSequence.id];
            let component = handler.activeComponents[secondText.id];
            let elements = sequence.props.namedChildren['elements'];
            assert.include(elements, component);
            assert.equal(elements[2], component);
        });
        it("First Text should have rendered twice at this point", () => {
            let component = handler.activeComponents[firstText.id];
            assert.equal(component.numRenders, 2);
        });
        it("Second Text should have rendered twice at this point", () => {
            let component = handler.activeComponents[secondText.id];
            assert.equal(component.numRenders, 2);
        });
        it("Third text should have only rendered once at this point", () => {
            let component = handler.activeComponents[thirdText.id];
            assert.equal(component.numRenders, 1);
        });
    });
});



/**
 * A Note on cellDiscarded Tests
 * ------------------------------
 * Previously we expected #cellDiscarded messages to have to navigate
 * their parent components and remove themselves from namedChildren collections.
 * In practice, an updated parent Cell/Component will send #cellUpdated with
 * the child already removed, so even the most complex kinds of
 * #cellDiscarded handling seem unnecessary for the moment.
 * We will preserve these tests in case the need arises again
 * to implement more complicated discarding handling.
 */
describe("#cellDiscarded basic", function(){
    var handler;
    before(() => {
        let rootEl = document.createElement('div');
        rootEl.id = 'page_root';
        document.body.append(rootEl);
        handler = new NewCellHandler(h, projector, registry);
    });
    after(() => {
        let rootEl = document.getElementById('page_root');
        rootEl.remove();
    });

    it('Initially handles basic structure', () => {
        let text = Object.assign({}, firstText);
        let root = Object.assign({}, simpleRoot, {
            namedChildren: {
                child: text
            }
        });
        let updateMessage = makeCreateMessage(root);
        handler.receive(updateMessage);
        let component = handler.activeComponents[text.id];
        let rootComponent = handler.activeComponents[root.id];
        assert.equal(rootComponent, component.parent);
    });
    it("Can successfully call the discard method", () => {
        let text = Object.assign({}, firstText);
        let discardMessage = makeDiscardedMessage(text);
        handler.receive(discardMessage);
        assert.isTrue(true);
    });
    it("Is no longer present in handler after discard", () => {
        let found = handler.activeComponents[firstText.id];
        assert.notExists(found);
    });
    it("Is no longer present in the namedChildren of old parent", function(){
        this.skip('For the moment we dont need this test. See test file comments');
        let rootComponent = handler.activeComponents[simpleRoot.id];
        let child = rootComponent.props.namedChildren['child'];
        assert.notExists(child);
    });
});

describe.skip("#cellDiscarded complex case", function(){
    var handler;
    before(() => {
        let rootEl = document.createElement('div');
        rootEl.id = "page_root";
        document.body.append(rootEl);
        handler = new NewCellHandler(h, projector, registry);
    });
    after(() => {
        let rootEl = document.getElementById('page_root');
        rootEl.remove();
    });
    it("Initially creates the complex strutcure", () => {
        let struct = Object.assign({}, simpleNestedStructure);
        let createMessage = makeCreateMessage(struct);
        handler.receive(createMessage);
        let foundRoot = handler.activeComponents[simpleRoot.id];
        assert.exists(foundRoot);
    });
    it("Can call #cellDiscarded on firstText", () => {
        let textToRemove = Object.assign({}, firstText);
        let discardMessage = makeDiscardedMessage(textToRemove);
        handler.receive(discardMessage);
        assert.isTrue(true);
    });
    it("firstText is removed from handler", () => {
        let found = handler.activeComponents[firstText.id];
        assert.notExists(found);
    });
    it("firstText is not present in Sequence elements namedChild array", () => {
        let sequenceComp = handler.activeComponents[simpleSequence.id];
        let elements = sequenceComp.props.namedChildren['elements'];
        let elementIds = elements.map(item => {return item.props.id;});
        assert.equal(elements.length, 1);
        assert.notInclude(elementIds, firstText.id);
        assert.include(elementIds, secondText.id);
    });
    it("Can remove the entire Sequence", () => {
        let seqToRemove = Object.assign({}, simpleSequence);
        let discardMessage = makeDiscardedMessage(seqToRemove);
        handler.receive(discardMessage);
        let found = handler.activeComponents[simpleSequence.id];
        assert.notExists(found);
    });
    it("All of Sequence's children should also be removed", () => {
        let first = handler.activeComponents[firstText.id];
        let second = handler.activeComponents[secondText.id];
        assert.notExists(first);
        assert.notExists(second);
    });
    it("Root's namedChild 'child' should be set to null", () => {
        let root = handler.activeComponents[simpleRoot.id];
        let child = root.props.namedChildren['child'];
        assert.equal(child, null);
    });
});

describe("Basic Structure Handling DOM Tests", () => {
    var handler;
    before(() => {
        let root = document.createElement('div');
        root.id = "page_root";
        document.body.append(root);
    });

    after(() => {
        let root = document.getElementById('page_root');
        if(root){
            root.remove();
        }
    });

    it("Properly renders new Root Component to the DOM", () => {
        handler = new NewCellHandler(h, projector, registry);
        let createMessage = makeCreateMessage(simpleRoot);
        handler.receive(createMessage);
        let pageRoot = document.getElementById('page_root');
        let inlineType = pageRoot.dataset.cellType;
        assert.exists(inlineType);
        assert.equal(inlineType, "RootCell");
    });
    describe("Can render text cell child on subsequent update", () => {
        before(() => {
            handler = new NewCellHandler(h, projector, registry);
        });
        it("Can receive update message without error", () => {
            let newText = Object.assign({}, firstText, {
                id: 7,
                parentId: simpleRoot.id,
                nameInParent: "child"
            });
            let struct = Object.assign({}, simpleRoot, {
                namedChildren: {
                    child: newText
                }
            });
            let updateMessage = makeUpdateMessage(struct);
            handler.receive(updateMessage);
            assert.equal(Object.keys(handler.activeComponents).length, 2);
        });
        it("Has a RootCell in the DOM", () => {
            assert.equal(Object.keys(handler.activeComponents).length, 2);
            let pageRoot = document.getElementById("page_root");
            assert.exists(pageRoot);
            let cellType = pageRoot.dataset.cellType;
            assert.exists(cellType);
            assert.equal(cellType, "RootCell");
        });
        it("Added a new Component to the handler for Text", () => {
            let found = handler.activeComponents[7];
            assert.exists(found);
        });
        it("Has a Text cell in the DOM under RootCell", () => {
            let pageRoot = document.getElementById("page_root");
            let textChild = pageRoot.querySelector(".cell");
            assert.exists(textChild);
        });
        it("Can replace the existing child", () => {
            let newText = Object.assign({}, firstText, {
                id: 8,
                parentId: 1,
                nameInParent: "child",
                extraData: {
                    rawText: "FARTS"
                }
            });
            let parent = Object.assign({}, simpleRoot, {
                namedChildren: {
                    child: newText
                }
            });
            let updateMessage = makeUpdateMessage(parent);
            handler.receive(updateMessage);
            let pageRoot = document.getElementById(simpleRoot.id);
            assert.equal(pageRoot.children.length, 1);
            let textChild = pageRoot.firstElementChild;
            assert.exists(textChild);
            assert.equal(textChild.textContent, "FARTS");
            assert.equal(textChild.id, 8);
        });
    });
});

describe("Properties Update Tests", () => {
    var handler;
    before(() => {
        handler = new NewCellHandler(h, projector, registry);
        let rootEl = document.createElement('div');
        rootEl.id = "page_root";
        document.body.append(rootEl);
    });
    after(() => {
        let rootEl = document.getElementById('page_root');
        if(rootEl){
            rootEl.remove();
        }
    });
    it("Creates a Text Cell whose content is 'HELLO'", () => {
        let newText = Object.assign({}, firstText, {
            id: 2,
            nameInParent: "child",
            parentId: 1,
            extraData: {
                rawText: "HELLO"
            }
        });
        let parent = Object.assign({}, simpleRoot, {
            namedChildren: {
                child: newText
            }
        });
        let updateMessage = makeUpdateMessage(parent);
        handler.receive(updateMessage);
        let el = document.getElementById(newText.id);
        assert.exists(el);
        assert.equal(el.textContent, "HELLO");
    });
    it("Has text 'WORLD' after props update", function(){
        let newText = Object.assign({}, firstText, {
            id: 2,
            parentId: simpleRoot.id,
            nameInParent: "child",
            extraData: {
                rawText: "WORLD"
            }
        });
        let updateMessage = Object.assign({}, newText, {
            type: "#cellUpdated",
            shouldDisplay: true,
            channel: "#main"
        });
        handler.receive(updateMessage);
        let root = document.getElementById('page_root');
        assert.equal(root.children.length, 1);
        let textChild = document.getElementById(newText.id);
        assert.equal(textChild.textContent, "WORLD");
    });
});

describe("Sheet and Update Data Tests", () => {
    var handler;
    before(() => {
        handler = new NewCellHandler(h, projector, registry);
        let rootEl = document.createElement('div');
        rootEl.id = "page_root";
        document.body.append(rootEl);
        let createMessage = makeCreateMessage(simpleRoot);
        handler.receive(createMessage);
    });
    after(() => {
        let rootEl = document.getElementById('page_root');
        if(rootEl){
            rootEl.remove();
        }
    });
    it("Creates a Sheet component", () => {
        let child = Object.assign({}, simpleSheet, {
            parentId: simpleRoot.id,
            nameInParent: 'child'
        });
        let updatedParent = Object.assign({}, simpleRoot, {
            namedChildren: {
                child: child
            }
        });
        assert.notExists(handler.activeComponents[child.id]);
        let updateMessage = makeUpdateMessage(updatedParent);
        handler.receive(updateMessage);
        let stored = handler.activeComponents[child.id];
        assert.exists(stored);
    });
    it("Loads initial data into a Sheet component", () => {
        let stored = handler.activeComponents[simpleSheet.id];
        assert.exists(stored);
        assert.equal(stored.current_data, null);
        assert.equal(stored.column_names, null);
        column_names = ["col1", "col2", "col3"],
        data = [
            ["index1", 1, 2, 3],
            ["index2", 2, 3, 4],
            ["index3", 3, 4, 5],
        ]
        let updateMessage = {
            id: simpleSheet.id,
            type: "#cellDataUpdated",
            dataInfo : {
                action: "replace",
                column_names : column_names,
                data : data
            }
        }
        handler.receive(updateMessage);
        assert.equal(stored.current_data.toString(), data.toString());
        assert.equal(stored.column_names.toString(), column_names.toString());
    });
    it("Row append in a Sheet component", () => {
        let stored = handler.activeComponents[simpleSheet.id];
        column_names = ["col1", "col2", "col3"]
        let data = [
            ["index1", 1, 2, 3],
            ["index2", 2, 3, 4],
            ["index3", 3, 4, 5],
            ["index4", 2, 3, 4],
            ["index5", 3, 4, 5],
            ["index6", 4, 5, 6],
        ]
        let updateMessage = {
            id: simpleSheet.id,
            type: "#cellDataUpdated",
            dataInfo : {
                action: "replace",
                column_names : column_names,
                data : data
            }
        }
        handler.receive(updateMessage);
        let new_data = [
            ["index7", 4, 5, 6],
            ["index8", 4, 5, 6],
        ]
        // not here we are append and poping rows
        let test_data = [
            ["index3", 3, 4, 5],
            ["index4", 2, 3, 4],
            ["index5", 3, 4, 5],
            ["index6", 4, 5, 6],
            ["index7", 4, 5, 6],
            ["index8", 4, 5, 6],
        ]

        updateMessage = {
            id: simpleSheet.id,
            type: "#cellDataUpdated",
            dataInfo : {
                action: "append",
                axis: "row",
                data : new_data
            }
        }
        handler.receive(updateMessage);
        assert.equal(stored.current_data.toString(), test_data.toString());
        assert.equal(stored.column_names.toString(), column_names.toString());
    });
    it("Row prepend in a Sheet component", () => {
        let stored = handler.activeComponents[simpleSheet.id];
        column_names = ["col1", "col2", "col3"]
        let data = [
            ["index3", 3, 4, 5],
            ["index4", 2, 3, 4],
            ["index5", 3, 4, 5],
            ["index6", 4, 5, 6],
            ["index7", 4, 5, 6],
            ["index8", 4, 5, 6],
        ]
        let updateMessage = {
            id: simpleSheet.id,
            type: "#cellDataUpdated",
            dataInfo : {
                action: "replace",
                column_names : column_names,
                data : data
            }
        }
        handler.receive(updateMessage);
        let new_data = [
            ["index1", 1, 2, 3],
            ["index2", 2, 3, 4],
        ]
        // not here we are append and poping rows
        let test_data = [
            ["index1", 1, 2, 3],
            ["index2", 2, 3, 4],
            ["index3", 3, 4, 5],
            ["index4", 2, 3, 4],
            ["index5", 3, 4, 5],
            ["index6", 4, 5, 6],
        ]

        updateMessage = {
            id: simpleSheet.id,
            type: "#cellDataUpdated",
            dataInfo : {
                action: "prepend",
                axis: "row",
                data : new_data
            }
        }
        handler.receive(updateMessage);
        assert.equal(stored.current_data.toString(), test_data.toString());
        assert.equal(stored.column_names.toString(), column_names.toString());
    });
    it("Column prepend in a Sheet component", () => {
        let stored = handler.activeComponents[simpleSheet.id];
        column_names = ["col3", "col4", "col5"]
        let data = [
            ["index1", 1, 2, 3],
            ["index2", 2, 3, 4],
            ["index3", 3, 4, 5],
        ]
        let updateMessage = {
            id: simpleSheet.id,
            type: "#cellDataUpdated",
            dataInfo : {
                action: "replace",
                column_names : column_names,
                data : data
            }
        }
        handler.receive(updateMessage);
        new_column_names = ["col1", "col2"]
        let new_data = [
            ['index1', 1, 2],
            ['index2', 1, 2],
            ['index3', 1, 2],
        ]
        // not here we are append and poping rows
        let test_column_names = ["col1", "col2", "col3"]
        let test_data = [
            ["index1", 1, 2, 1],
            ["index2", 1, 2, 2],
            ["index3", 1, 2, 3],
        ]

        updateMessage = {
            id: simpleSheet.id,
            type: "#cellDataUpdated",
            dataInfo : {
                action: "prepend",
                axis: "column",
                column_names: new_column_names,
                data : new_data
            }
        }
        handler.receive(updateMessage);
        assert.equal(stored.current_data.toString(), test_data.toString());
        assert.equal(stored.column_names.toString(), test_column_names.toString());
    });
    it("Column append in a Sheet component", () => {
        let stored = handler.activeComponents[simpleSheet.id];
        column_names = ["col1", "col2", "col3"]
        let data = [
            ["index1", 1, 2, 3],
            ["index2", 2, 3, 4],
            ["index3", 3, 4, 5],
        ]
        let updateMessage = {
            id: simpleSheet.id,
            type: "#cellDataUpdated",
            dataInfo : {
                action: "replace",
                column_names : column_names,
                data : data
            }
        }
        handler.receive(updateMessage);
        new_column_names = ["col4", "col5"]
        let new_data = [
            ['index1', 1, 2],
            ['index2', 1, 2],
            ['index3', 1, 2],
        ]
        // not here we are append and poping rows
        let test_column_names = ["col3", "col4", "col5"]
        let test_data = [
            ["index1", 3, 1, 2],
            ["index2", 4, 1, 2],
            ["index3", 5, 1, 2],
        ]

        updateMessage = {
            id: simpleSheet.id,
            type: "#cellDataUpdated",
            dataInfo : {
                action: "append",
                axis: "column",
                column_names: new_column_names,
                data : new_data
            }
        }
        handler.receive(updateMessage);
        assert.equal(stored.current_data.toString(), test_data.toString());
        assert.equal(stored.column_names.toString(), test_column_names.toString());
    });
});
