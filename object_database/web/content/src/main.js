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
 * Cell Socket and Handler
 **/
const cellSocket = new CellSocket();
const cellHandler = new CellHandler(ComponentRegistry, cellSocket);
window._cellHandler = cellHandler;
cellSocket.onMessage(cellHandler.receive);
cellSocket.onClose(cellHandler.showConnectionClosed);
cellSocket.onError(err => {
    console.error("SOCKET ERROR: ", err);
});

/** For now, we bind the current socket and handler to the global window **/
window.cellSocket = cellSocket;
window.cellHandler = cellHandler;

/** Render top level Cell once DOM is ready **/
document.addEventListener('DOMContentLoaded', () => {
    cellHandler.initialRender();
    cellSocket.connect();
});

// TESTING; REMOVE
console.log('Main module loaded');
