/*
 * The background script handles communication to and from
 * the content script, embedded in the document, and
 * the panel scripts, living in devtools.
 * This communication is handled via chrome.runtime connection
 * ports.
 * The connections are initialized in the content and panel scripts,
 * respectively. Here we listen for these connection and create
 * connection/port specific handlers.
 */
var portFromCS;
var portFromPanel;

function connected(port) {
    // handle all communication to and from the panel
    if (port.name === "port-from-panel"){
        portFromPanel = port;
        // at the moment we don't do anything with messages coming
        // from the panels
        console.log("setting up port-from-panel listener")
        portFromPanel.onMessage.addListener(function(msg) {
            console.log("background received message from panel", msg);
        });
    };
    // handle all communication to and from the content script
    if (port.name === "port-from-cs"){
        portFromCS = port;
        portFromCS.onMessage.addListener(function(msg) {
            // Having received a message from the content script, i.e.
            // from the target window we forward this message to the panels
            // if the connection is not alive we log this in the devtools's
            // debugger console
            notifyDevtoolsPanel(msg.data);
        });
    }
    // notify if the port has disconnected
    port.onDisconnect.addListener(function(port) {
        if (port.name === "port-from-panel" || port.name === "port-from-cs"){
            console.log(`${port.name} has disconnected`);
        };
    });
}

chrome.runtime.onConnect.addListener(connected);

function notifyDevtoolsPanel(msg){
    if (portFromPanel){
        portFromPanel.postMessage(msg);
    } else {
        console.log(msg);
        console.log("failed to send message to devtools panel: port disconnected");
    }
}

// chrome.browserAction.onClicked.addListener(function() {
//     portFromCS.postMessage({greeting: "they clicked the button!"});
// });
