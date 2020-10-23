/**
 * Generic base Cell Component.
 * Should be extended by other
 * Cell classes on JS side.
 */
import {KeyListener} from './util/KeyListener';
import {PropTypes} from './util/PropertyValidator';
import {h} from 'maquette';

const render = (aComponent) => {
    let velement = aComponent.render();
    aComponent.numRenders += 1;
    return velement;
};

class Component {
    constructor(props = {}, handler = null){
        this.isComponent = true;
        this._updateProps(props);

        // If we have passed in a handler
        // use it
        this.handler = handler;

        // If a KeyListener is defined it will be bound here
        this.keyListener = null;

        // Whether or not the the component
        // is a Subscribed. We do this
        // because Subscribed is a proxy
        // for its children and we check it
        // in NewCellHandler.
        this.isSubscribed = false;
        this.isWrappingComponent = false;
        this.subscribedTo = null;
        this.prevSubscribedTo = null;

        // Lifecycle handlers used by the
        // CellHandler
        this._wasUpdated = false;
        this._wasCreated = true;

        // Setup parent relationship, if
        // any. In this abstract class
        // there isn't one by default
        this.parent = null;
        this._setupChildRelationships();

        // Ensure that we have passed in an id
        // with the props. Should error otherwise.
        if(!this.props.id || this.props.id == undefined){
            throw Error('You must define an id for every component props!');
        }

        // Add any extra utility properties
        this.numRenders = 0;

        // Validate the incoming props
        // on initialization
        this.validateProps();

        // Bind context to methods
        this.toString = this.toString.bind(this);
        this.getDOMElement = this.getDOMElement.bind(this);
        this.componentDidLoad = this.componentDidLoad.bind(this);
        this.componentDidUpdate = this.componentDidUpdate.bind(this);
        this.componentWillReceiveProps = this.componentWillReceiveProps.bind(this);
        this.childrenDo = this.childrenDo.bind(this);
        this.namedChildrenDo = this.namedChildrenDo.bind(this);
        this.renderChildNamed = this.renderChildNamed.bind(this);
        this.renderChildrenNamed = this.renderChildrenNamed.bind(this);
        this.sendMessage = this.sendMessage.bind(this);
        this.getElementId = this.getElementId.bind(this);
        this.getInheritanceChain = this.getInheritanceChain.bind(this);
        this.getSubscribedChain = this.getSubscribedChain.bind(this);
        this.getTopSubscribedAncestor = this.getTopSubscribedAncestor.bind(this);
        this._setupChildRelationships = this._setupChildRelationships.bind(this);
        this._updateProps = this._updateProps.bind(this);
        this._updateData = this._updateData.bind(this);
        this._recursivelyMapNamedChildren = this._recursivelyMapNamedChildren.bind(this);
    }

    build(){
        // Objects that extend from
        // me should override this
        // method in order to build
        // some content for the vdom
        throw new Error('You must implement a `build` method on Component objects!');
    }

    /**
     * I first call the component build()
     * to generate the v-dom/hyperscript element. Then
     * alter it if necessary and return the hyperscript.
     * Instead of calling a render() directly on the
     * subclassed components themselves I provide the option for
     * global/component-wide changes before the final rendering.
    */
    render() {
        let velement = this.build();

        // If the component's parent is a Subscribed,
        // we need to give the velement the data
        // attribute that maps to its Subscribed

        if(this.subscribedTo){
            velement.properties['data-subscribed-to'] = this.subscribedTo;
        }


        // All components that have a flexChild
        // property should add the class to their
        // root hyperscript's CSS.
        if(this.props.flexChild){
            velement.properties.class += " flex-child";
        }

        // Add any custom inline styles required
        // from the server side. For now this is
        // limited to `padding` and `margin`
        // inset values.
        if(this.props.customStyle){
            addCustomStyles(this.props.customStyle, velement);
        }

        // Add any custom queryTag that should be
        // added as a data attribute
        if(this.props.queryTag){
            velement.properties['data-tag'] = this.props.queryTag.toString();
        }

        return velement;
    }

    /**
     * Object that extend from me could overwrite this method.
     * It is to be used for lifecylce management and is to be called
     * after the components loads.
    */
    componentDidLoad() {
        return null;
    }

    /**
     * Lifecycle function that will be called just before
     * the component is removed from the global handler's
     * dict of components and also from the DOM.
     */
    componentWillUnload(){
        // pause/remove the keyListener if present
        if (this.keyListener){
            this.keyListener.pause();
        }
        if (this.constructor.keyListener){
            this.constructor.keyListener.pause();
        }
        return null;
    }

    /**
     * Will be called on subsequent changes to the props
     * for the component. Needs to return a new props
     * object.
     * By default we simply return the passed-in
     * nextProps
     */
    componentWillReceiveProps(oldProps, nextProps){
        return nextProps;
    }

    /**
     * Lifecycle function that will be called
     * each time an exsting component is matched
     * in the CellHandler's #cellUpdated message.
     * Will only be triggered *after* the initial
     * load and will happen with each update.
     */
    componentDidUpdate(){
        return null;
    }

    /**
     * Responds with an actual DOM Element
     * instance into which one can project
     * this Component's hyperscripts.
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
     * If there is a `propTypes` object present on
     * the constructor (ie the component class),
     * then run the PropTypes validator on it.
     */
    validateProps(){
        if(this.constructor.propTypes){
            PropTypes.validate(
                this.constructor.name,
                this.props,
                this.constructor.propTypes
            );
        }
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
        return `${this.constructor.elementIdPrefix}${this.props.id}`;
    }

    /**
     * Send a message over the socket registered
     * with the current handler. There must be
     * a handler associated with this component
     * and the handler must be bound to a socket.
     * See NewCellHandler >> #sendMessageFor for
     * more details, since that is what gets
     * called here.
     */
    sendMessage(message){
        if(this.handler){
            this.handler.sendMessageFor(message, this.props.id);
        }
    }

    /**
     * Looks up the passed key in namedChildren and
     * if found responds with the result of calling
     * render on that child component. Returns null
     * otherwise.
     */
    renderChildNamed(key){
        let foundChild = this.props.namedChildren[key];
        /*if(foundChild && foundChild.isSubscribed){
            let subVElement = render(foundChild);
            let contentVElement = foundChild.renderContent();
            contentVElement.key = `subscribedTo${foundChild.props.id}`;
            subVElement.key = foundChild;
            return [contentVElement, subVElement];
        }*/
        if(foundChild){
            let velement = render(foundChild);

            // some children don't render themselves
            if (velement === null) {
                return null;
            }

            velement.key = foundChild;
            return velement;
        }

        return null;
    }

    /**
     * Looks up the passed key in namedChildren
     * and if found -- and the value is an Array
     * or Array of Arrays, responds with an
     * isomorphic structure that has the rendered
     * values of each component.
     */
    renderChildrenNamed(key){
        let foundChildren = this.props.namedChildren[key];
        if(foundChildren){
            return this._recursivelyMapNamedChildren(foundChildren, child => {
                let velement = render(child);
                // In some cases velement
                // will be null, as in non-display
                // components.
                if(velement){
                    velement.key = child;
                }
                /*if(child.isSubscribed){
                    let contentVElement = child.renderContent();
                    contentVElement.key = `subscribedTo${child.props.id}`;
                    return [contentVElement, velement];
                }*/
                return velement;
            });
        }
        return [];
    }



    /**
     * Getter that will respond with the
     * constructor's (aka the 'class') name
     */
    get name(){
        return this.constructor.name;
    }

    /**
     * Getter that will respond true if this
     * the component has not yet been rendered
     * even once
     */
    get hasRenderedBefore() {
        return this.numRenders > 0;
    }

    /**
     * Override default string representation
     */
    toString(){
        return `${this.name} [${this.props.id}]`;
    }

    /**
     * Getter that will respond with an
     * array of rendered (ie configured
     * hyperscript) objects that represent
     * each child. Note that we will create keys
     * for these based on the ID of this parent
     * component.
     */
    get renderedChildren(){
        if(this.props.children.length == 0){
            return [];
        }
        return this.props.children.map(childComponent => {
            let renderedChild = render(childComponent);
            renderedChild.properties.key = `${this.props.id}-child-${childComponent.props.id}`;
            return renderedChild;
        });
    }

    /** Public Util Methods **/

    /**
     * Calls the provided callback on each
     * array child for this component, with
     * the child as the sole arg to the
     * callback
     */
    childrenDo(callback){
        this.props.children.forEach(child => {
            callback(child);
        });
    }

    /**
     * Calls the provided callback on
     * each named child with key, child
     * as the two args to the callback.
     */
    namedChildrenDo(callback){
        Object.keys(this.props.namedChildren).forEach(key => {
            let child = this.props.namedChildren[key];
            callback(key, child);
        });
    }

    /**
     * Responds with an array of all ancestor
     * components to the current one.
     */
    getInheritanceChain(){
        let result = [];
        let parent = this.parent;
        while(parent){
            result.push(parent);
            parent = parent.parent;
        }
        return result;
    }

    /**
     * Similar to getInheritanceChain,
     * but only adds Components that are
     * of type Subscribed
     */
    getSubscribedChain(){
        let result = [];
        let parent = this.parent;
        while(parent && parent.isSubscribed){
            result.push(parent);
            parent = parent.parent;
        }
        return result;
    }

    /**
     * Responds with a Component representing
     * the top ancestor in the SubcribedChain.
     * See #getSubscribedChain for more information.
     */
    getTopSubscribedAncestor(){
        let result = this.getSubscribedChain();
        if(result.length){
            return result.pop();
        }
        return null;
    }

    /** Private Util Methods **/

    /**
     * Sets the parent attribute of all incoming
     * array and/or named children to this
     * instance.
     */
    _setupChildRelationships(){
        // Named children first
        Object.keys(this.props.namedChildren).forEach(key => {
            let child = this.props.namedChildren[key];
            child.parent = this;
        });

        // Now array children
        this.props.children.forEach(child => {
            child.parent = this;
        });
    }

    /**
     * Updates this components props object
     * based on an incoming object
     */
    _updateProps(incomingProps){
        this.props = incomingProps;
        this.props.children = incomingProps.children || [];
        this.props.namedChildren = incomingProps.namedChildren || {};
        this._setupChildRelationships();
    }

    /**
     * Updates this components data
     * based on an incoming object
     */
    _updateData(incomingData, projector){

    }

    /**
     * Recursively maps a one or multidimensional
     * named children value with the given mapping
     * function.
     */
    _recursivelyMapNamedChildren(collection, callback){
        return collection.map(item => {
            if(Array.isArray(item)){
                return this._recursivelyMapNamedChildren(item, callback);
            } else {
                return callback(item);
            }
        });
    }
};

Component.elementIdPrefix = "cell-";


/**
 * Given a dictionary of `customStyles`
 * (usually provided by a Component),
 * adds those styles to a given `velement`'s
 * existing `style` string.
 * Note that we use helper methods to translate
 * to and from dicts/strings for convenience.
 * @param {object} customStyles - An object
 * mapping CSS style names to values.
 * @param {maquette.VNode} velement - A Maquette
 * virtual element whose `properties.style` string
 * we will update with the new given styles.
 * @returns {maquette.VNode} - The modified
 * maquette virtual element with updated
 * styling.
 */
const addCustomStyles = (customStyles, velement) => {
    let sourceStyle = velement.properties.style;
    let styleDict = {};
    if(sourceStyle){
        styleDict = styleToDict(sourceStyle);
    }

    Object.keys(customStyles).forEach(key => {
        styleDict[key] = customStyles[key];
    });

    let styleString = dictToStyle(styleDict);

    return velement.properties.style = styleString;
};


/**
 * Helper function that translates
 * HTML style attribute strings
 * (ie, `style="width:100%;padding-left:10px;"`)
 * to dictionary/object form for easier
 * manipulation.
 * @param {String} styleString - The source
 * HTML attribute style string
 * @param {object} - An object/dictionary
 * like version of the styles
 */
const styleToDict = (styleString) => {
    let items = styleString.split(";");
    let keysAndVals = items.map(item => {
        return item.split(":");
    });
    let result = {};
    keysAndVals.forEach(part => {
        result[part[0]] = part[1];
    });
    return result;
};

/**
 * Helper function that translates
 * objects/dictionaries of HTML/CSS
 * style names (keys) and values to
 * an HTML attribute string form
 * (ie, inline HTML style string)
 * @param {object} styleDict - An object
 * whose keys are the style names and
 * values are the style values.
 * @returns {String} - An HTML attribute
 * style string, ie inline style string.
 */
const dictToStyle = (styleDict) => {
    let items = Object.keys(styleDict).map(key => {
        return `${key}:${styleDict[key]}`;
    });
    let result = items.join(";");
    if(!result.endsWith(";")){
        result += ";";
    }
    return result;
};

export {
    Component,
    render,
    Component as default};
