//import {langTools} from 'ace/ext/language_tools';
import {CellHandler} from './CellHandler';
import {CellSocket} from './CellSocket';
import {ComponentRegistry} from './ComponentRegistry';
import {KeyRegistry} from './KeyRegistry';
import {KeyListener} from './components/util/KeyListener';
import {Cell, render} from './components/Cell';

/**
 * Globals
 **/
window.langTools = ace.require("ace/ext/language_tools");
window.keyRegistry = new KeyRegistry();

// disable 'tab' from flowing through
document.addEventListener('keydown', (event) => {
    if (event.code == "Tab") {
        event.preventDefault();
    }
});

/**
 * Cell Socket and Handler globals
 **/
var cellSocket = null;
var cellHandler = null;
var timesDisconnected = 0;
var reconnectAt = null;

const onSessionDisconnected = function(e) {
    timesDisconnected += 1;

    console.log("Session Disconnected: " + timesDisconnected + " times in a row. " + e)

    let waitSeconds = Math.pow(2, timesDisconnected - 1);

    reconnectAt = Date.now() + waitSeconds * 1000;

    cellHandler.showConnectionClosed(waitSeconds);

    // attempt to reconnect
    window.setTimeout(checkForConnectionTimeout, 250);
}

const checkForConnectionTimeout = function() {
    if (Date.now() > reconnectAt) {
        console.log("Session attempting to reconnect");

        initializeCellsSession();
    } else {
        let waitSeconds = Math.round((reconnectAt - Date.now()) / 1000);
        cellHandler.showConnectionClosed(Math.round(waitSeconds));
        window.setTimeout(checkForConnectionTimeout, 250);
    }

}

const initializeCellsSession = function() {
    cellSocket = new CellSocket();
    cellHandler = new CellHandler(ComponentRegistry, cellSocket);

    cellSocket.onOpen(() => {
        console.log("Session connected to socket");
        cellHandler.afterConnected();
    });
    cellSocket.onMessage((msg) => {
        // only reset disconnect state if we actually connected.
        timesDisconnected = 0;
        cellHandler.receive(msg)
    });
    cellSocket.onClose(onSessionDisconnected);

    cellSocket.onError(err => {
        console.log("Session had an error: " + err);
    });

    cellHandler.initialRender();
    cellSocket.connect();
}

/** Render top level Cell once DOM is ready **/
document.addEventListener('DOMContentLoaded', () => {
    initializeCellsSession();
});

// TESTING; REMOVE
console.log('Main module loaded');
