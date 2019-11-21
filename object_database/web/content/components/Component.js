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
    constructor(props = {}, replacements = []){
        this.isComponent = true;
        this._updateProps(props);

        // Whether or not the the component
        // is a Subscribed. We do this
        // because Subscribed is a proxy
        // for its children and we check it
        // in NewCellHandler.
        this.isSubscribed = false;
        this.isWrappingComponent = false;

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
        this._setupChildRelationships = this._setupChildRelationships.bind(this);
        this._updateProps = this._updateProps.bind(this);
        this._updateData = this._updateData.bind(this);
        this._recursivelyMapNamedChildren = this._recursivelyMapNamedChildren.bind(this);
    }

    get usesReplacements(){
        throw Error('#usesReplacements is now deprecated!');
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
        return document.getElementById(this.props.id);
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
     * Looks up the passed key in namedChildren and
     * if found responds with the result of calling
     * render on that child component. Returns null
     * otherwise.
     */
    renderChildNamed(key){
        let foundChild = this.props.namedChildren[key];
        if(foundChild){
            let velement = render(foundChild);
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
    return items.join(";");
};

export {
    Component,
    render,
    Component as default};
