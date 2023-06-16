/*
 * I am the content script which is injected into the target
 * document window when devtools is open.
 *
 * I create connection port to handle communication between myself
 * and the devtools browser script (which then passes these messages
 * onto the devtools panel scripts).
 *
 * In addition, I handle incoming window level messaging (
 * window.postMessage() API) and routing these application
 * originating messaged to the devtools background.
 */


console.log("loading content script");
var portCSBackground = chrome.runtime.connect({name:"port-cs-background"});

// at the moment nothing much is done with messages going
// to the content-script port
portCSBackground.onMessage.addListener(function(msg) {
    console.log("received message from background: ", msg);
});

window.addEventListener("message", (event) => {
    // filter on the target windows url
    // console.log("message in target window")
    if(event.origin === window.location.origin){
        // filter the message further to make sure it's for devtools
        if(event.data.type == "cells_devtools"){
            // reroute the message to the background script
            portCSBackground.postMessage({data: event.data});
        }
    }
}, false);
