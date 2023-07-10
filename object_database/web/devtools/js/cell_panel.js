// import {CellsTree} from './tree.js';

// GLOBALS (TODO: should be handled better)
let state = null;
let cellsJSONCache = null;

/**
  * Messages and related
  */
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
        break;
    case "info":
        handleInfoFromBackground(msg);
        break;
    }
}

window.handleMessageFromBackground = handleMessageFromBackground;


/**
  * Display lifecycle.
  */
const initialLoadDisplay = () => {
    const main = document.getElementById("main");
    main.textContent = "Initializing: no cells loaded";
}

const reconnectingDisplay = () => {
    const main = document.getElementById("main");
    main.textContent = "Reconnecting: no cells loaded";
}

const clearDisplay = () => {
    document.getElementById("main").replaceChildren();
    document.getElementById("cell-info").replaceChildren();
}

// display the tree
const cellsTreeDisplay = (cells) => {
    clearDisplay();
    const info = document.getElementById("cell-info");
    info.textContent = "click on a node to see more info";
    // init and run
    // NOTE: the tree class itself attaches the
    // svg element to #main
    // const cTree = new CellsTree(cells);
    // cTree.setupTree();
    const tree = document.createElement("tree-graph");
    const main = document.getElementById("main");
    main.append(tree);
    tree.setAttribute("display-depth", 4);
    // setup node hover event listeners
    // NOTE: these are defined on window by CellHandler
    tree.onNodeMouseover = (event) => {
        // highlight the corresponding element in the target window
        const id = event.target.getAttribute("data-original-id");
        window.sendMessageToBackground({
            action: "notifyCS",
            event: "mouseover",
            nodeId: id
        })
    }
    tree.onNodeMouseleave = (event) => {
        // un-highlight the corresponding element in the target window
        window.sendMessageToBackground({
            action: "notifyCS",
            event: "mouseleave",
        })
    }

    tree.onNodeClick = (event) => {
        updateInfoPanel(event.target);
    }
    tree.customizeNode = (node) => {
        if (node.name == "Subscribed") {
            node.style.backgroundColor = "var(--palette-beige)";
        }
        // customize a tooltip here
        const id = node.getAttribute("data-original-id");
        node.title = `cell-id: ${id}`;
    }
    // displaying tree
    tree.setup(cells);
}

// info panel display
const updateInfoPanel = (node) => {
    const infoPanel = document.getElementById("cell-info");
    // clear it out first
    infoPanel.textContent = null;
    const infoSpan = document.createElement("span");
    const id = node.getAttribute("data-original-id");
    // we need to retrieve the source code for the node
    window.sendMessageToBackground({
        action: "notifyCS",
        event: "click",
        nodeId: id,
    })
    const name = node.name;
    let info = `${name}\ncell-id: ${id}`;
    const tree = document.querySelector("tree-graph");
    const parentSubtree = tree.findParentSubTree(id, tree.data);
    if (parentSubtree.name.match("Subscribed")) {
        info = `${info}\nsubscribed to cell-id: ${parentSubtree.id}`;
    }

    infoSpan.innerText = info;
    infoPanel.append(infoSpan);
    // args/props section
    const span = document.createElement('span');
    span.textContent = "Cell Arguments";
    span.setAttribute("id", "node-args");
    infoPanel.append(span);
}


const createPropsTable = (propsDict) => {
    const table = document.createElement('table');
    // header
    const thead = document.createElement('thead');
    const tr = document.createElement('tr');
    const thName = document.createElement('th');
    const thVal = document.createElement('th');
    thead.append(tr);
    tr.append(thName);
    tr.append(thVal);
    thName.textContent = "Name";
    thVal.textContent = "Val";
    table.append(thead);
    // body
    const tbody = document.createElement('tbody');
    table.append(tbody);
    Object.keys(propsDict).forEach((key) => {
        const tr = document.createElement('tr');
        const tdKey = document.createElement('td');
        const tdValue = document.createElement('input');
        tdValue.setAttribute("type", "text");
        tdKey.textContent = key;
        tdValue.setAttribute("placeholder", propsDict[key]);
        tr.append(tdKey);
        tr.append(tdValue);
        tbody.append(tr);
    });

    return table;
}

// I handle incoming background 'info' messages
// ie generally these are coming from a devtools request
// to the target application and response from the target app
// returning via content script -> background
const handleInfoFromBackground = (msg) => {
    console.log("message from backgound", msg)
    const infoPanel = document.getElementById("cell-info");
    if (Object.keys(msg.data).length) {
        const table = createPropsTable(msg.data);
        infoPanel.append(table);
    } else {
        const span = document.createElement('span');
        span.textContent = "This node takes no args";
        infoPanel.append(span);
    }
}
