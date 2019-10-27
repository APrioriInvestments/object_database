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

let simpleSheet = {
    id: 6,
    cellType: "Sheet",
    extraData: {dontFetch: true},
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
        let sheet = document.getElementById(simpleSheet.id);
        assert.exists(sheet);
        let head = document.getElementById(`sheet-${simpleSheet.id}-head`);
        assert.exists(head);
        let body = document.getElementById(`sheet-${simpleSheet.id}-body`);
        assert.exists(body);
    });
    it("Loads initial data into a Sheet component", () => {
        let sheet = document.getElementById(simpleSheet.id);
        assert.exists(sheet);
        let head = document.getElementById(`sheet-${simpleSheet.id}-head`);
        assert.exists(head);
        let body = document.getElementById(`sheet-${simpleSheet.id}-body`);
        assert.exists(body);
        // assert.equal(stored.column_names, null);
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
        assert.equal(body.children.length, data.length);
        assert.equal(head.children.length, column_names.length + 1); // recall we always have the placeholder, column 0
    });
    it("Replacing data in a Sheet component", () => {
        let sheet = document.getElementById(simpleSheet.id);
        assert.exists(sheet);
        let head = document.getElementById(`sheet-${simpleSheet.id}-head`);
        assert.exists(head);
        let body = document.getElementById(`sheet-${simpleSheet.id}-body`);
        assert.exists(body);
        column_names = ["col1", "col2", "col3"],
        data = [
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
        assert.equal(body.children.length, data.length);
        assert.equal(head.children.length, column_names.length + 1); // recall we always have the placeholder, column 0
    });
    it("Row append in a Sheet component", () => {
        let sheet = document.getElementById(simpleSheet.id);
        assert.exists(sheet);
        let head = document.getElementById(`sheet-${simpleSheet.id}-head`);
        assert.exists(head);
        let body = document.getElementById(`sheet-${simpleSheet.id}-body`);
        assert.exists(body);
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
        assert.equal(body.children.length, data.length); // recall the total data length is stable
        assert.equal(head.children.length, column_names.length + 1); // recall we always have the placeholder, column 0
        assert.equal(body.firstChild.firstChild.textContent, data[new_data.length][0])
        assert.equal(body.lastChild.firstChild.textContent, new_data[1][0])
    });
    it("Row prepend in a Sheet component", () => {
        let sheet = document.getElementById(simpleSheet.id);
        assert.exists(sheet);
        let head = document.getElementById(`sheet-${simpleSheet.id}-head`);
        assert.exists(head);
        let body = document.getElementById(`sheet-${simpleSheet.id}-body`);
        assert.exists(body);
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
        assert.equal(body.children.length, data.length); // recall the total data length is stable
        assert.equal(head.children.length, column_names.length + 1); // recall we always have the placeholder, column 0
        assert.equal(body.firstChild.firstChild.textContent, new_data[0][0])
        assert.equal(body.lastChild.firstChild.textContent, data[data.length - new_data.length -1][0])
    });
    it("Column prepend in a Sheet component", () => {
        let sheet = document.getElementById(simpleSheet.id);
        assert.exists(sheet);
        let head = document.getElementById(`sheet-${simpleSheet.id}-head`);
        assert.exists(head);
        let body = document.getElementById(`sheet-${simpleSheet.id}-body`);
        assert.exists(body);
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
            ['index1', 'a11', 'a21'],
            ['index2', 'b21', 'b22'],
            ['index3', 'c31', 'c23'],
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
        assert.equal(body.children.length, data.length); // recall the total data length is stable
        assert.equal(head.children.length, column_names.length + 1); // recall we always have the placeholder, column 0
        assert.equal(head.children[1].textContent, new_column_names[0])
        assert.equal(body.firstChild.children[1].firstChild.textContent, new_data[0][1])
        assert.equal(head.lastChild.textContent, column_names[column_names.length - new_column_names.length - 1])
        assert.equal(body.firstChild.lastChild.firstChild.textContent, data[0][data.length - new_data.length + 1])
    });
    it("Column append in a Sheet component", () => {
        let sheet = document.getElementById(simpleSheet.id);
        assert.exists(sheet);
        let head = document.getElementById(`sheet-${simpleSheet.id}-head`);
        assert.exists(head);
        let body = document.getElementById(`sheet-${simpleSheet.id}-body`);
        assert.exists(body);
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
        assert.equal(body.children.length, data.length); // recall the total data length is stable
        assert.equal(head.children.length, column_names.length + 1); // recall we always have the placeholder, column 0
        assert.equal(head.lastChild.textContent, new_column_names[new_column_names.length - 1])
        assert.equal(body.firstChild.lastChild.firstChild.textContent, new_data[0][new_data[0].length - 1])
        assert.equal(head.children[1].textContent, column_names[new_column_names.length - 1])
        assert.equal(body.firstChild.children[1].firstChild.textContent, data[0][new_data.length - 1])
    });
    it("Column append row number mismatch fail in a Sheet component", () => {
        let sheet = document.getElementById(simpleSheet.id);
        assert.exists(sheet);
        let head = document.getElementById(`sheet-${simpleSheet.id}-head`);
        assert.exists(head);
        let body = document.getElementById(`sheet-${simpleSheet.id}-body`);
        assert.exists(body);
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
        try {
            handler.receive(updateMessage);
        } catch(e) {
            assert.equal(e, "Incoming number of rows don't match current sheet");
        }
    });
    it("Column append row index mismatch fail in a Sheet component", () => {
        let sheet = document.getElementById(simpleSheet.id);
        assert.exists(sheet);
        let head = document.getElementById(`sheet-${simpleSheet.id}-head`);
        assert.exists(head);
        let body = document.getElementById(`sheet-${simpleSheet.id}-body`);
        assert.exists(body);
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
            ['BAD_INDEX', 1, 2],
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
        try {
            handler.receive(updateMessage);
        } catch(e) {
            assert.equal(e, "Sheet row index index3 does not match incoming row index BAD_INDEX");
        }
    });
});
