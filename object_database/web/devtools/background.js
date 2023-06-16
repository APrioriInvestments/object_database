/*
 * The background script handles communication to and from
 * the content script, embedded in the document, and
 * the panel scripts, living in devtools.
 * These communiccation are handled by chrome.runtime connection
 * ports.
 * The connections are initialized int he content and panel scripts,
 * respectively. Here we listen for these connection and create
 * connection/port specific handlers.
 */
var portCSBackground;
var portPanelBackground;

function connected(port) {
    // handle all communication to and from the panel
    if (port.name === "port-panel-background"){
        portPanelBackground = port;
        // at the moment we don't do anything with messages coming
        // from the panels
        portPanelBackground.onMessage.addListener(function(msg) {
            console.log("recieved message from panel", msg);
            if (msg.action == "notifyCS") {
                notifyCS(msg);
            }
        });
    };
    // handle all communication to and from the content script
    if (port.name === "port-cs-background"){
        portCSBackground = port;
        portCSBackground.onMessage.addListener(function(msg) {
            // Having received a message from the content script, i.e.
            // from the target window we forward this message to the panels
            // if the connection is not alive we log this in the devtools's
            // debugger console
            notifyDevtoolsPanel(msg.data);
        });
    }
    // notify if the port has disconnected
    port.onDisconnect.addListener(function(port) {
        if (port.name === "port-panel-background" || port.name === "port-cs-background"){
            console.log(`${port.name} has disconnected`);
        };
    });
}

chrome.runtime.onConnect.addListener(connected);

function notifyDevtoolsPanel(msg){
    if (portPanelBackground){
        portPanelBackground.postMessage(msg);
    } else {
        console.log(msg);
        console.log("failed to send message to devtools panel: port disconnected");
    }
}

function notifyCS(msg) {
    if (portCSBackground) {
        portCSBackground.postMessage(msg);
    } else {
        console.log("failed to send message to content script: port disconnected", msg);
    }
}
