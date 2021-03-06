/**
 * New Primary Cells Message Handler
 * ---------------------------------
 * This class implements message handlers
 * of several varieties that come over
 * a CellSocket instance.
 */
import {h} from 'maquette';
import {render} from './components/Component';
import {
    findNamedComponent,
    allNamedChildrenDo
} from './components/util/NamedChildren';

class NewCellHandler {
    constructor(h, projector, components, socket=null){
        // A constructor for
        // hyperscript objects
        this.h = h;

        // A Maquette VDOM
        // projector instance
        this.projector = projector;

        // If we passed in a socket
        // (CellSocket), make it the prop
        this.socket = socket;

        // A dictionary of available
        // Cell Components by name
        this.availableComponents = components;

        // Properties that will be updated
        // as messages come in
        this.cells = {};
        this.activeComponents = {};
        this.postscripts = [];

        // Private properties
        this._sessionId = null;

        // Debugging. Delete this
        // and references to it.
        this._deleted = {};

        // Bind component methods
        this.showConnectionClosed = this.showConnectionClosed.bind(this);
        this.connectionClosedView = this.connectionClosedView.bind(this);
        this.appendPostscript = this.appendPostscript.bind(this);
        this.handlePostscript = this.handlePostscript.bind(this);
        this.sendMessageFor = this.sendMessageFor.bind(this);
        this.receive = this.receive.bind(this);
        this.cellUpdated = this.cellUpdated.bind(this);
        this.cellDataUpdated = this.cellDataUpdated.bind(this);
        this.cellDataRequested = this.cellDataRequested.bind(this);
        this.cellsDiscarded = this.cellsDiscarded.bind(this);
        this.doesNotUnderstand = this.doesNotUnderstand.bind(this);
        this._getUpdatedComponent = this._getUpdatedComponent.bind(this);
        this._createAndUpdate = this._createAndUpdate.bind(this);
        this._updateComponentProps = this._updateComponentProps.bind(this);
        this._updateNamedChildren = this._updateNamedChildren.bind(this);
        this._findOrCreateChild = this._findOrCreateChild.bind(this);
        this._eachChildDo = this._eachChildDo.bind(this);
        this._callDidLoadForNew = this._callDidLoadForNew.bind(this);
        this._callDidUpdate = this._callDidUpdate.bind(this);
    }

    /**
     * Fills the page's primary div with
     * an indicator that the socket has been
     * disconnected.
     */
    showConnectionClosed(){
        this.projector.replace(
            document.getElementById("page_root"),
            this.connectionClosedView
        );
    }

    /**
     * Helper function that generates the vdom Node for
     * to be display when connection closes
     */
    connectionClosedView(){
        return this.h("main.container", {role: "main"}, [
            this.h("div", {class: "alert alert-primary center-block mt-5"},
                   ["Disconnected"])
        ]);
    }

    /**
     * Main entrypoint into the handler.
     * Consumers of this class should call
     * only this method when receiving messages.
     * It will case out the appropriate handling
     * method based on the `type` field in the
     * message.
     * Note taht we call `doesNotUnderstand()`
     * in the event of a message containing a
     * message type that is unknown to the system.
     * @param {Object} message - A JSON decoded
     * message to be handled.
     */
    receive(message){
        switch(message.type){
            case '#cellUpdated':
                return this.cellUpdated(message);
            case '#cellDataUpdated':
                return this.cellDataUpdated(message);
            case '#cellDataRequested':
                return this.cellDataRequested(message);
            case '#cellsDiscarded':
                return this.cellsDiscarded(message);
            case '#appendPostscript':
                return this.appendPostscript(message);
            default:
                return this.doesNotUnderstand(message);
        }
    }

    /** Primary Message Handlers **/

    /**
     * Catch-all message handler for messages
     * whose `type` is not understood by the
     * system (ie has no appropriate handler)
     * @param {Object} message - A JSON decoded
     * message to be handled
     */
    doesNotUnderstand(message){
        let msg = `CellHandler does not understand the following message: ${message}`;
        console.error(msg);
        return;
    }

    /**
     * Adds the messages's passed raw JS
     * string to this instance's internal
     * list of postscripts.
     * @param {Object} message -  A JSON decoded
     * message with `script` string contents.
     */
    appendPostscript(message){
        this.postscripts.push(message.script);
    }

    /**
     * Primary handler for messages in which a given
     * Cell/Component is either updated or initially
     * created. These components will be added to
     * a managed dictionary as they are created,
     * so that we can keep track of instances for later
     * updating purposes.
     * This is where all of the DOM updating and
     * manipulation occurs.
     * Note the use of several helper functions.
     * These were designed to deal wtih updating
     * any namedChildren of the passed-in Cell/Component.
     * @param {Object} message - A JSON decoded message
     * containing a description of a Cell structure
     * that should either be updated or created.
     * @returns {Component} - A component that is configured
     * and rendered, along with all of its children.
     */
    cellUpdated(message){
        let component = this._getUpdatedComponent(message);

        let velement = render(component);
        let domElement = component.getDOMElement();

        this.projector.replace(domElement, () => {
            return velement;
        });

        // Call lifecycle methods
        this._callDidLoadForNew();
        this._callDidUpdate();

        if(message.postscript){
            this.postscripts.push(message.postscript);
        }

        return component;
    }

    /**
     * Primary handler for messages in which a cell
     * has requested data from the client. Usually this
     * pertains to global information (for example, the
     * window.keyRegistry
     */
    cellDataRequested(message){
        message.dataInfo.forEach((data) => {
            if(data["request"] == "KeyRegistry"){
                window.keyRegistry.sendListenerData(message);
            }
        })
    }

    /**
     * Primary handler for messages in which a given
     * existing Cell/Component needs to update its
     * internal data store.
     * @returns {Component} - A component that is configured
     * and rendered, along with all of its children.
     */
    cellDataUpdated(message){
        let component = this._getDataUpdatedComponent(message);
        // let velement = render(component);
        // let domElement = document.getElementById(component.props.id);
        // this.projector.replace(domElement, () => {
        //     return velement;
        // });
        // return component;
    }

    /**
     * Message handler for the event of a Cell
     * being discarded. We simply remove any corresponding
     * component instance from the activeComponents
     * managed dictionary.
     * Note that a child being discarded from a parent
     * is not handled here; rather, the #cellUpdated
     * message sent for the parent will automatically
     * re-render without the discarded child, so we
     * don't need to do anything complex in this method.
     * @param {Object} message - A JSON decoded message
     * object containing the ids of the Cell/Components
     * that were discarded.
     * @returns {Component} - The Component instance
     * that was discarded.
     */
    cellsDiscarded(message){
        message.ids.forEach(componentId => {
            let found = this.activeComponents[componentId];
            if(found){
                found.componentWillUnload();
                delete this.activeComponents[componentId];
                this._deleted[found.props.id] = found;
            }
        });
    }

    /* Legacy Methods still required */
    /**
     * Primary method for handling
     * 'postscripts' messages, which tell
     * this object to go through it's array
     * of script strings and to evaluate them.
     * The evaluation is done on the global
     * window object explicitly.
     * NOTE: Future refactorings/restructurings
     * will remove much of the need to call eval!
     * @param {string} message - The incoming string
     * from the socket.
     */
    handlePostscript(message){
        // Evaluate scripts coming
        // across the wire.
        while(this.postscripts.length){
            let postscript = this.postscripts.pop();
            try {
                window.eval(postscript);
            } catch(e){
                console.error("ERROR RUNNING POSTSCRIPT", e);
                console.log(postscript);
            }
        }
    }

    sendMessageFor(message, cellId){
        if(this.socket){
            message['target_cell'] = cellId.toString();
            this.socket.sendString(JSON.stringify(message));
        }
    }

    /** Private Methods **/

    /**
     * Attempts to find or create a component based
     * on a description of the corresponding Cell
     * present in a message object.
     * If the id of the description is not in the
     * current dictionary of activeComponents, we
     * create it and proceed. Otherwise we find the
     * component and update its props and children
     * recursively.
     * @param {Object} description - A description of the Cell
     * that needs to be updated or created. This is usually a part
     * of an incoming socket message object, and includes all of
     * the information needed to properly create and render
     * a cell component.
     * @returns {Component} - A configured Component (with children)
     * prepared for rendering.
     */
    _getUpdatedComponent(description){
        if(!Object.keys(this.activeComponents).includes(description.id.toString())){
            // In this case, we are creating a totally new Cell
            // and component combination.
            return this._createAndUpdate(description);
        }
        let component = this.activeComponents[description.id];
        this._updateComponentProps(component, description);
        this._updateNamedChildren(component, description);
        component._wasUpdated = true;
        return component;
    }

    /**
     * Attempts to find and update the data of a component based
     * on a description of the corresponding Cell
     * present in a message object.
     * If the id of the description is not in the
     * current dictionary of activeComponents, we
     * create it and proceed. Otherwise we find the
     * component and update its props and children
     * recursively.
     * @param {Object} description - A description of the Cell
     * that needs to have its data updated. This is usually a part
     * of an incoming socket message object, and includes all of
     * the information needed to properly update the data store of
     * a cell component.
     * @returns {Component} - A configured Component (with children)
     * prepared for rendering.
     */
    _getDataUpdatedComponent(description){
        if(!Object.keys(this.activeComponents).includes(description.id.toString())){
            // something went wrong; can't find the component
            console.error("data update fail; no component with id: " + description.id);
        }
        let component = this.activeComponents[description.id];
        component._updateData(description.dataInfo, this.projector);
        component._wasUpdated = true;
        return component;
    }
    /**
     * Handles the creation and registration of a new Component
     * based on a Cell description in a message object.
     * Note that other helpers might call this method
     * recursively as it creates or updates any of its
     * children.
     * @param {Object} message - A JSON decoded message that
     * contains a description of the Cell that should be
     * created, along with props and children descriptions.
     * @returns {Component} - The newly created Component
     */
    _createAndUpdate(message){
        let componentClass = this.availableComponents[message.cellType];
        if(!componentClass || componentClass == undefined){
            throw new Error(`Cannot find Component for Cell Type: ${message.cellType}`);
        }
        let componentProps = Object.assign({}, message.extraData, {
            id: message.id,
            extraData: message.extraData
        });
        let newComponent = new componentClass(componentProps, this);
        this._updateNamedChildren(newComponent, message);
        this.activeComponents[newComponent.props.id] = newComponent;
        return newComponent;

    }

    /**
     * Helper that will update the `props` of
     * a given component based on a incoming
     * #cellUpdated message.
     * Note that we also call the component's
     * `componentWillReceiveProps` lifecycle
     * method here.
     * @param {Component} component - The component
     * whose props will be updated.
     * @param {Object} message - A JSON decoded
     * message containing a description of the Cell
     * to be updated, including its new props.
     */
    _updateComponentProps(component, message){
        let nextProps = Object.assign({}, message.extraData, {
            id: message.id,
            extraData: message.extraData
        });
        let newProps = component.componentWillReceiveProps(
            component.props,
            nextProps
        );
        component._updateProps(newProps);
    }

    /**
     * Helper  that will update the namedChildren
     * of the given component based on the updated
     * namedChildren description in the provided
     * #cellUpdated message object.
     * @param {Component} component - The component
     * whose namedChildren will be updated.
     * @param {Object} message - A JSON decoded
     * update message containing a description of
     * the correpsonding Cell and its namedChildren.
     */
    _updateNamedChildren(component, message){
        let newNamedChildren = {};
        Object.keys(message.namedChildren).forEach(childName => {
            let childDescription = message.namedChildren[childName];
            newNamedChildren[childName] = this._findOrCreateChild(childDescription, component);
        });
        component.props.namedChildren = newNamedChildren;
    }

    /**
     * Helper that will determine whether a component
     * needs to be updated or created based upon a description
     * of the cell and an instance of its parent Component.
     * Note that this method is called recursively.
     * Note also that this is where we set the `parent`
     * property of the child component.
     * @param {Object} childDescription - An object
     * represending a description of the corresponding
     * Cell, usually in the form of a #cellUpdated message
     * @param {Component} parentComponent - A Component
     * instance that represents the parent of the Component
     * that will be updated or created.
     * @returns {Component} childComponent - The found or
     * created Component instance.
     */
    _findOrCreateChild(childDescription, parentComponent){
        if(Array.isArray(childDescription)){
            return childDescription.map(item => {
                return this._findOrCreateChild(item, parentComponent);
            });
        }
        // Sometimes the childDescription is not a whole object,
        // but merely an ID. This tells us to simply return the
        // component with that id and not to update anything
        // about it at all.
        let childComponent;
        if(typeof(childDescription) == 'string' || typeof(childDescription) == 'number'){
            childComponent = this.activeComponents[childDescription.toString()];
            childComponent.parent = parentComponent;
            childComponent._wasUpdated = true;
            this._eachChildDo(childComponent, comp => {
                comp._wasUpdated = true;
            });
            return childComponent;
        }

        // Otherwise we are either updating this child or
        // freshly creating it. So we start the cycle over again
        childComponent = this._getUpdatedComponent(childDescription);
        childComponent.parent = parentComponent;
        if(parentComponent.isSubscribed){
            childComponent.prevSubscribedTo = childComponent.subscribedTo;
            childComponent.subscribedTo = parentComponent.props.id;
        }
        return childComponent;
    }

    /**
     * Helper that cucles through all components
     * that were freshly created as a part of a
     * single message handling cycle and calls the
     * `componentDidLoad` lifecycle method on each.
     */
    _callDidLoadForNew(){
        // Goes through the stored list of
        // new components created during a message handle
        // and calls componentDidLoad()
        /**this._newComponents.forEach(component => {
            component.componentDidLoad();
        });
        this._newComponents = [];*/
        Object.keys(this.activeComponents).map(key => {
            return this.activeComponents[key];
        }).filter(component => {
            return component._wasCreated;
        }).forEach(component => {
            component.componentDidLoad();
            component._wasCreated = false;
        });
    }

    /**
     * Helper that cycles through all Components
     * that were updated (but not created) as a
     * part of a single message handling cycle
     * and calls the `componentDidUpdate`
     * lifecycle method on each.
     */
    _callDidUpdate(){
        // Goes through the stored
        // list of existing components
        // that were updated during a
        // message handle and calls
        // componenDidUpdate()
        /*this._updatedComponents.forEach(component => {
            component.componentDidUpdate();
        });
        this._updatedComponents = [];*/
        Object.keys(this.activeComponents).map(key => {
            return this.activeComponents[key];
        }).filter(component => {
            return component._wasUpdated;
        }).forEach(component => {
            component.componentDidUpdate();
            component._wasUpdated = false;
        });
    }

    /**
     * Convenience method that will call the
     * passed in callback on each resolved
     * child of the given component.
     * Can be used recursively where needed.
     */
    _eachChildDo(aComponent, callback){
        if(Array.isArray(aComponent)){
            aComponent.forEach(item => {
                this._eachChildDo(item, callback);
            });
            return;
        }
        Object.keys(aComponent.props.namedChildren).forEach(key => {
            let childComponent = aComponent.props.namedChildren[key];
            this._eachChildDo(childComponent, callback);
        });
        return callback(aComponent);
    }
}

export {NewCellHandler, NewCellHandler as default};
