import {CellsTree} from './tree.js';

// SOME FAKE DATA: TODO!
const cells = {
    name: "root cell",
    children: [
        {
            name: "cell_1_1",
            children: [
                {
                    name: "cell_1_2",
                    children: []
                }
            ]
        },
        {
            name: "cell_2_1",
            children: [
                {
                    name: "cell_2_2",
                    children: []
                }
            ]
        },
        {
            name: "cell_3_1",
            children: [
                {
                    name: "cell_3_2",
                    children: []
                }
            ]
        },
    ]
}


// GLOBALS (TODO: should be handled better)
let state = null;


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
        state = msg.status;
        cellsTreeDisplay();
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

const cellsTreeDisplay = () => {
    clearDisplay();
    // init and run
    // NOTE: the tree class itself attaches the
    // svg element to #main
    const cTree = new CellsTree(cells);
    cTree.setupTree();
}


/**
  * I clear the views when the application
  * views when the application state changes
  **/
const clearDisplay = () => {
    document.getElementById("main").replaceChildren();
    document.getElementById("cell-info").replaceChildren();
}
