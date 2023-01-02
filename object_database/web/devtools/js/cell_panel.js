// import {CellsTree} from './tree.js';

// GLOBALS (TODO: should be handled better)
let state = null;
let cellsJSONCache = null;

// setup message handling from background
function handleMessageFromBackground(msg){
    // console.log("handling background message");
    // console.log(msg);
    switch (msg.status){
    case "initial load":
        state = msg.status;
        initialLoadDisplay();
        break;
    case "reconnecting":
        // no need to redisplay reconnection attemps
        if(state != msg.status){
            state = msg.status;
            reconnectingDisplay();
        }
        break;
    case "loaded":
        // check to see if the cells tree has changed
        if(cellsJSONCache != JSON.stringify(msg.cells)){
            state = msg.status;
            cellsJSONCache = JSON.stringify(msg.cells);
            cellsTreeDisplay(msg.cells);
            console.log(msg.cells);
        }
    }
}

window.handleMessageFromBackground = handleMessageFromBackground;


const initialLoadDisplay = () => {
    const main = document.getElementById("main");
    main.textContent = "Initializing: no cells loaded";
}

const reconnectingDisplay = () => {
    const main = document.getElementById("main");
    main.textContent = "Reconnecting: no cells loaded";
}

const cellsTreeDisplay = (cells) => {
    clearDisplay();
    // init and run
    // NOTE: the tree class itself attaches the
    // svg element to #main
    // const cTree = new CellsTree(cells);
    // cTree.setupTree();
    const tree = document.createElement("tree-graph");
    const main = document.getElementById("main");
    main.append(tree);
    // setup node hover event listeners
    // NOTE: these are defined on window by CellHandler
    tree.onNodeMouseover = (event) => {
        // highlight the corresponding element in the target window
        const id = event.target.getAttribute("data-original-id");
        chrome.devtools.inspectedWindow.eval(
            `window.addDevtoolsHighlight(${id})`
        );
    }
    tree.onNodeMouseleave = (event) => {
        // un-highlight the corresponding element in the target window
        const id = event.target.getAttribute("data-original-id");
        chrome.devtools.inspectedWindow.eval(
            `window.removeDevtoolsHighlight()`
        );
    }
    // displaying tree
    tree.setup(cells);
}


/**
  * I clear the views when the application
  * views when the application state changes
  **/
const clearDisplay = () => {
    document.getElementById("main").replaceChildren();
    document.getElementById("cell-info").replaceChildren();
}
