import 'maquette';
const h = maquette.h;
//import {langTools} from 'ace/ext/language_tools';
import {NewCellHandler as CellHandler} from './NewCellHandler';
import {CellSocket} from './CellSocket';
import {ComponentRegistry} from './ComponentRegistry';
import {KeyRegistry} from './KeyRegistry';
import {KeyListener} from './components/util/KeyListener';
import {Component, render} from './components/Component';

/**
 * Globals
 **/
window.langTools = ace.require("ace/ext/language_tools");
window.aceEditorComponents = {};
window.keyRegistry = new KeyRegistry();

/**
 * Initial Render
 **/
const initialRender = function(){
    return h("div", {}, [
         h("div", {id: "page_root"}, [
             h("div.container-fluid", {}, [
                 h("div.card", {class: "mt-5"}, [
                     h("div.card-body", {}, ["Loading..."])
                 ])
             ])
         ]),
        h("div", {id: "holding_pen", style: "display:none"}, [])
     ]);
};

/**
 * Cell Socket and Handler
 **/
let projector = maquette.createProjector();
const cellSocket = new CellSocket();
const cellHandler = new CellHandler(h, projector, ComponentRegistry, cellSocket);
window._cellHandler = cellHandler;
cellSocket.onPostscripts(cellHandler.handlePostscript);
cellSocket.onMessage(cellHandler.receive);
cellSocket.onClose(cellHandler.showConnectionClosed);
cellSocket.onError(err => {
    console.error("SOCKET ERROR: ", err);
});

/** For now, we bind the current socket and handler to the global window **/
window.cellSocket = cellSocket;
window.cellHandler = cellHandler;

/** Render top level component once DOM is ready **/
document.addEventListener('DOMContentLoaded', () => {
    projector.append(document.body, initialRender);
    projector.append(document.body, () => {
        return h('div', {id: 'modal-area'}, []);
    });
    cellSocket.connect();
});

// TESTING; REMOVE
console.log('Main module loaded');
