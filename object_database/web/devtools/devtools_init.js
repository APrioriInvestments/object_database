// Create a new panel
chrome.devtools.panels.create(
    "Cells",
    null,
    "cells_panel.html",
    function(panel){
        let _window = null; // hold a reference to cell_panel.html
        const data = [];

        // create a connection/port which will handle all communication
        // between the panel and the background script
        const portFromPanel = chrome.runtime.connect({name: "port-from-panel"});
        portFromPanel.onMessage.addListener(function(msg) {
            if (_window){
                // handleMessageFromBackground() is defined in cell_panel.js
                _window.handleMessageFromBackground(msg);
            } else {
                console.log("no connection to background");
                // if the panel's window is undefined store the data for now
                data.push(msg);
                // console.log(`logged data:`)
                // console.log(data);
            }
        });

        // when the panel button is clicked
        panel.onShown.addListener(function tmp(panelWindow) {
            console.log("panel is being shown");
            // clean up any stale listeners
            panel.onShown.removeListener(tmp);

            // set the _window const to panelWindow which allows handling
            // of messages by the panel, i.e. in the panel's window context
            _window = panelWindow;
            let msg = data.shift();
            // if any data was logged while the panel was not available
            // send it along now
            while (msg){
                // console.log("handling logged messages");
                _window.handleMessageFromBackground(msg);
                msg = data.shift();
            }
            // If we ever need to send messages back via the port
            // we can do that as below
            _window.sendMessageToBackground = function(msg) {
                portFromPanel.postMessage(msg);
            }
        });

        panel.onHidden.addListener(function() {console.log("panel is being hidden")});       console.log(panel);
    }
);
