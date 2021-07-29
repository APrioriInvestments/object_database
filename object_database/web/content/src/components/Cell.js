/**
 * Generic base Cell Cell.
 * Should be extended by other
 * Cell classes on JS side.
 */
import {KeyListener} from './util/KeyListener';

const render = null;

// build a dom element. 'divstyle' is the kind of element
// props is an object with properties. functions will be assigned
// directly. children is a list of children. undefined will be removed.
const makeDomElt = (divstyle, props, children) => {
    var res = document.createElement(divstyle);

    for (var key in props) {
        if (props.hasOwnProperty(key)) {
            if (typeof(props[key]) === "function") {
                res[key] = props[key];
            } else {
                res.setAttribute(key, props[key]);
            }
        }
    }

    if (children) {
        children.forEach((child) => {
            if (typeof child === 'string') {
                res.appendChild(document.createTextNode(child));
            } else if (child !== null && child !== undefined) {
                res.appendChild(child);
            }
        });
    }

    return res;
};

const replaceChildren = (domElement, children) => {
    if (domElement.replaceChildren) {
        // when this is available...
        domElement.replaceChildren(...children);
    } else {
        // go through the children and append them to the element
        for (var i = 0; i < children.length; i++) {
            domElement.appendChild(children[i]);
        }

        while (domElement.childNodes.length > children.length) {
            domElement.removeChild(domElement.firstChild);
        }
    }
};

class Cell {
    constructor(props = {}, identity=null, namedChildren = {}, handler = null){
        this.isCell = true;
        this.identity = identity;
        this.props = props;
        this.namedChildren = namedChildren;
        this.handler = handler;

        // Bind context to methods
        this.toString = this.toString.bind(this);
        this.getDOMElement = this.getDOMElement.bind(this);
        this.updateSelf = this.updateSelf.bind(this);
        this.sendMessage = this.sendMessage.bind(this);
        this.getElementId = this.getElementId.bind(this);
        this.cellWillUnload = this.cellWillUnload.bind(this);
        this.buildDomElement = this.buildDomElement.bind(this);
        this.buildDomElementInner = this.buildDomElementInner.bind(this);
        this.buildDomSequenceChildren = this.buildDomSequenceChildren.bind(this);
        this.onFirstInstalled = this.onFirstInstalled.bind(this);
        this.rebuildDomElement = this.rebuildDomElement.bind(this);
        this.childChanged = this.childChanged.bind(this);
        this.handleMessages = this.handleMessages.bind(this);
        this.addCanonicalTags = this.addCanonicalTags.bind(this);
    }

    addCanonicalTags(domElt) {
        if (domElt) {
            if (this.props.flexChild) {
                domElt.classList.add('flex-child');
            }
            if (this.props._tag) {
                domElt.setAttribute('data-tag', this.props._tag);
            }
        }

        return domElt;
    }

    // called on any 'updated' nodes in the tree asking them to rebuild the
    // dom.
    rebuildDomElement() {
        throw new Error('rebuildDomElement not defined for ' + this);
    }

    // called on new nodes to produce the dom element. They may return null
    // if they don't have a representation in the DOM. Shouldn't be overridden.
    buildDomElement() {
        return this.addCanonicalTags(this.buildDomElementInner());
    }

    // overridden by child classes
    buildDomElementInner() {
        // given that our tree is fully populated, build a new dom element.
        // this only happens once in the life of a cell, and we expect that we'll call it
        // for each child once also.

        // this function returns a DOM element, or null if it doesn't have a dom representation.
        throw new Error('buildDomElement not defined for ' + this);
    }

    // if we would want to unpack in a sequence of this style, return these children.
    // may return an empty list.
    buildDomSequenceChildren(horizonal) {
        let domElt = this.buildDomElement();

        if (domElt) {
            return [domElt]
        }

        return []
    }

    // called when a child's DOM representation has changed. Cells are responsible for
    // updating their representation.
    childChanged(child) {
        throw new Error('childChanged not defined for ' + this);
    }

    /**
     * called any time a cell is explicitly updated
     */
    updateSelf(namedChildren, data) {
        this.namedChildren = namedChildren;
        this.props = data;
    }

    /**
     * Responds with an actual DOM Element
     * instance into which one can project
     * this Cell's hyperscripts.
     * Here we have the most commonly used
     * default implementation.
     * See `Subscribed` for an example of
     * an alternative override/use.
     * I am consumed by updates in the handler.
     */
    getDOMElement(){
        return document.getElementById(this.getElementId());
    }

    /**
     * Respond with a string-formatted
     * DOM valid id that can be used
     * as the actual element id. Note
     * that this is different from
     * `data-cell-id`, which is just
     * the true id.
     */
    getElementId(){
        return `${this.constructor.elementIdPrefix}${this.identity}`;
    }

    /**
     * Send a message over the socket registered
     * with the current handler. There must be
     * a handler associated with this Cell
     * and the handler must be bound to a socket.
     * See CellHandler >> #sendMessageFor for
     * more details, since that is what gets
     * called here.
     */
    sendMessage(message) {
        if (this.handler) {
            this.handler.sendMessageFor(message, this.identity);
        }
    }

    // called before we remove a cell
    cellWillUnload() {

    }

    // called after the cell is first fully installed in the DOM
    // this also happens after any update cells, but before any
    // message delivery.
    onFirstInstalled() {

    }

    // we're getting a set of events directly from the backend
    // representation of this cell.
    handleMessages(messages) {

    }

    /**
     * Getter that will respond with the
     * constructor's (aka the 'class') name
     */
    get name(){
        return this.constructor.name;
    }

    /**
     * Override default string representation
     */
    toString(){
        return `${this.name} [${this.identity}]`;
    }
};

Cell.elementIdPrefix = "cell-";

export {
    Cell,
    render,
    makeDomElt,
    replaceChildren,
    Cell as default};
