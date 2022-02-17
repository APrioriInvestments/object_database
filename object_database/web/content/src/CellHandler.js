/**
 * New Primary Cells Message Handler
 * ---------------------------------
 * This class implements message handlers
 * of several varieties that come over
 * a CellSocket instance.
 */
import {makeDomElt as h, Cell, replaceChildren} from './components/Cell';
import {ComponentRegistry} from './ComponentRegistry';

class CellHandler {
    constructor(Cells, socket=null){
        // If we passed in a socket
        // (CellSocket), make it the prop
        this.socket = socket;

        // A dictionary of available
        // Cell Cells by name
        this.availableCells = Cells;

        this.activeCells = {};

        // Bind Cell methods
        this.renderMainDiv = this.renderMainDiv.bind(this);
        this.initialRender = this.initialRender.bind(this);
        this.renderErrorMessage = this.renderErrorMessage.bind(this);

        this.afterConnected = this.afterConnected.bind(this);
        this.showConnectionClosed = this.showConnectionClosed.bind(this);
        this.createCellFromInitialMessage = this.createCellFromInitialMessage.bind(this);
        this.sendMessageFor = this.sendMessageFor.bind(this);
        this.sendMessageToCells = this.sendMessageToCells.bind(this);
        this.sendMessageToCellSession = this.sendMessageToCellSession.bind(this);
        this.receive = this.receive.bind(this);
        this.handleFrame = this.handleFrame.bind(this);
        this.doesNotUnderstand = this.doesNotUnderstand.bind(this);
        this.updateCell = this.updateCell.bind(this);
        this.handleSessionId = this.handleSessionId.bind(this);
        this.cellReceivedFocus = this.cellReceivedFocus.bind(this);
        this.tearDownAllLiveCells = this.tearDownAllLiveCells.bind(this);

        this.onPacket = this.onPacket.bind(this);
        this.requestPacket = this.requestPacket.bind(this);

        // identity of the current focus event.
        // this increases monotonically, and lets us differentiate between
        // user-focus events and messages from the server that have not yet
        // caught up to the browser state
        this.committedFocusEventId = 0;
        this.isProcessingFocusEvent = false;
        this.currentlyFocusedCellId = null;

        // unallocated packets
        this.packets = {};

        // registered packet callbacks
        this.packetHandlers = {};

        // the server-assigned session
        this.sessionId = null;
    }

    tearDownAllLiveCells() {
        Object.values(this.activeCells).forEach(node => {
            node.cellWillUnload();
        });
    }

    onPacket(packetId, packet) {
        if (this.packetHandlers[packetId] !== undefined) {
            try {
                this.packetHandlers[packetId](packetId, packet)
            } catch (e) {
                console.error("Packet handler failed: " + e + "\n\n" + e.stack);
            }
            delete this.packetHandlers[packetId];
        } else {
            this.packets[packetId] = packet;
        }
    }

    requestPacket(packetId, handler) {
        if (this.packets[packetId] !== undefined) {
            let res = this.packets[packetId];
            delete this.packets[packetId];
            try {
                handler(res);
            } catch (e) {
                console.error("Packet handler failed: " + e + "\n\n" + e.stack);
            }
        } else {
            this.packetHandlers[packetId] = handler;
        }
    }

    renderMainDiv(div) {
        if (!document.getElementById("page_root")) {
            let pageRootDiv = h("div", {}, [
                 h("div", {id: "page_root", 'data-cell-id': 'page_root', 'class': 'allow-child-to-fill-space',
                        'data-cell-type': 'RootCell'}, []),
            ]);

            document.body.appendChild(pageRootDiv);
        }

        replaceChildren(
            document.getElementById("page_root"),
            [div]
        );

    }

    renderErrorMessage(msg) {
        this.renderMainDiv(
            h("main", {role: "main", class: 'container'}, [
            h("div", {class: "alert alert-primary center-block alert-margin"},
                   ["Failed to connect: " + msg])
            ])
        );
    }

    initialRender() {
        this.renderMainDiv(
             h("div", {class: 'container-fluid'}, [
                 h("div", {class: "card alert-margin"}, [
                     h("div", {class: 'card-body'}, ["Loading..."])
                 ])
             ])
        );
    }

    afterConnected() {
        let sessionId = window.sessionStorage.getItem('sessionId');

        if (sessionId == null) {
            this.sendMessageToCellSession({
                'event': "requestSessionId"
            })
        } else {
            this.sessionId = sessionId;

            this.sendMessageToCellSession({
                'event': 'setSessionId',
                'sessionId': sessionId
            })
        }
    }

    /**
     * Fills the page's primary div with
     * an indicator that the socket has been
     * disconnected.
     */
    showConnectionClosed(waitSeconds) {
        this.renderMainDiv(
            h("main", {role: "main", class: 'container'}, [
            h("div", {class: "alert alert-primary center-block alert-margin"},
                   ["Reconnecting in " + waitSeconds + " seconds"])
            ])
        );
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
            case '#frame':
                return this.handleFrame(message);
            case '#sessionId':
                return this.handleSessionId(message);
            default:
                return this.doesNotUnderstand(message);
        }
    }

    /** Primary Message Handlers **/
    handleSessionId(message) {
        window.sessionStorage.setItem('sessionId', message.sessionId);
        this.sessionId = message.sessionId;
    }

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

    /****
    Handle a single block of updates from the server.

    Each message will consist of
        nodesToDiscard - a list of cell identities that are going to be
            removed from the tree.
        nodesUpdated - a dict from cell identity to an 'update' which consists
            of children and properties. Updated cells _must_ already exist.
        nodesCreated - a dict from cell identity to newly created cells.
            Every such cell must be in the tree somewhere.
        messages - a dict from cell identity to a list of json objects
            to be handed to the given named cell
        dynamicCellTypeDefinitions - a list of [(javascript, css)] to
            be evaluated to install new cell types
    ****/
    handleFrame(message) {
        // take each dynamic cell typedef and apply it to our current state
        // the javascript provided should construct new entries in the
        // ComponentRegistry, and the CSS definitions will apply to the
        // entire document.
        this.isProcessingFocusEvent = true;

        let t0 = Date.now();

        let totalUpdateCount = (
            Object.keys(message.nodesCreated).length +
            Object.keys(message.nodesUpdated).length
        )

        try {
            message.dynamicCellTypeDefinitions.forEach(javascriptAndCss => {
                Function(javascriptAndCss[0])()(ComponentRegistry);

                var styleSheetElement = document.createElement('style');
                styleSheetElement.type = 'text/css';
                styleSheetElement.innerHTML = javascriptAndCss[1];
                document.head.appendChild(styleSheetElement)
            });

            if (Object.keys(message.nodesUpdated).length > 0) {
                console.log(
                    "Updating " + (Object.keys(message.nodesUpdated).length) + " nodes "
                    + "and creating " + (Object.keys(message.nodesCreated).length) + " nodes "
                    + "at " + (Date.now() % 1000))
            }

            // indicate to each cell that's going out of scope that we're
            // getting rid of it
            message.nodesToDiscard.forEach(nodeId => {
                let cell = this.activeCells[nodeId]

                if (cell) {
                    cell.cellWillUnload();
                    cell.parent = null;
                    this.activeCells[nodeId].parent = null;
                } else {
                    console.error("Node " + nodeId + " can't be discarded because it doesn't exist.");
                }
            });

            // build a map of the parents of any new cells
            let parentIdentities = {};
            let cellCreationOrder = [];

            for (var createdCellId in message.nodesCreated) {
                let parentId = message.nodesCreated[createdCellId].parent;

                if (parentId !== null) {
                    parentIdentities[createdCellId] = parentId;
                }
            }

            let rebuildPageRoot = false;

            // the first message we get should define the page root
            if (message.nodesCreated['page_root']) {
                if (this.activeCells['page_root']) {
                    throw new Error("Page root was already set");
                }

                this.createCellFromInitialMessage('page_root', message.nodesCreated, cellCreationOrder);

                rebuildPageRoot = true;
            }

            // walk through each 'updated' cell and construct any new
            // cells beneath it
            for (var updatedNodeId in message.nodesUpdated) {
                this.updateCell(
                    updatedNodeId,
                    message.nodesUpdated[updatedNodeId].children,
                    message.nodesUpdated[updatedNodeId].extraData,
                    message.nodesCreated,
                    cellCreationOrder
                );
            }

            // at this point, message.nodesCreated should be empty
            if (message.nodesCreated && Object.keys(message.nodesCreated).length) {
                throw new Error(
                    "Frame contained unused cell ids: [" + Object.keys(message.nodesCreated).join(", ") + "]"
                );
            }

            // remove the unused cells
            message.nodesToDiscard.forEach(nodeId => {
                if (this.activeCells[nodeId]) {
                    delete this.activeCells[nodeId];
                }
            });

            // wire any parents
            for (var cellId in parentIdentities) {
                this.activeCells[cellId].setParent(this.activeCells[parentIdentities[cellId]]);
            }

            for (var updatedNodeId in message.nodesUpdated) {
                this.activeCells[updatedNodeId].rebuildDomElement();
            }

            if (rebuildPageRoot) {
                this.activeCells['page_root'].rebuildDomElement();
            }

            // notify cells that they now exist
            cellCreationOrder.forEach(childId => {
                this.activeCells[childId].onFirstInstalled();
            });

            for (var updatedNodeId in message.messages) {
                this.activeCells[updatedNodeId].handleMessages(
                    message.messages[updatedNodeId]
                );
            }

            if (message.focusedCellEventId > this.committedFocusEventId) {
                this.committedFocusEventId = message.focusedCellEventId;
                this.currentlyFocusedCellId = message.focusedCellId;
            }

            // we have to do this every time we process a message because otherwise
            // when we move things around in the DOM we end up losing the focus.
            if (this.currentlyFocusedCellId) {
                if (this.activeCells[this.currentlyFocusedCellId]) {
                    this.activeCells[this.currentlyFocusedCellId].serverKnowsAsFocusedCell();
                }
            } else {
                // defocus
                if (document.activeElement) {
                    document.activeElement.blur();
                }
            }
        }
        finally {
            this.isProcessingFocusEvent = false;

            if (Date.now() - t0 > 10) {
                console.log(
                    "Spent " + (Date.now() - t0) + " ms handling a message with "
                        + totalUpdateCount + " nodes created/updated."
                )
            }
        }
    }

    updateCell(identity, children, data, newUnbuiltCells, cellCreationOrder) {
        if (this.activeCells[identity]) {
            this.activeCells[identity].updateSelf(
                this.mapChildrenIdentitiesToCells(identity, children, newUnbuiltCells, cellCreationOrder),
                data
            );
        } else {
            console.error("Cell " + identity + " can't be updated because it doesn't exist.");
        }
    }

    mapChildrenIdentitiesToCells(parentId, children, newUnbuiltCells, cellCreationOrder) {
        if (Array.isArray(children)) {
            return children.map(c =>
                this.mapChildrenIdentitiesToCells(parentId, c, newUnbuiltCells, cellCreationOrder)
            );
        }

        if (typeof(children) == "string") {
            if (this.activeCells[children]) {
                if (this.activeCells[children].parent.identity != parentId) {
                    throw new Error(
                        "Cell named "
                        + children + " attempted to move in the tree from "
                        + this.activeCells[children].parent.identity + " to "
                        + parentId
                    );
                }

                return this.activeCells[children];
            }
            return this.createCellFromInitialMessage(children, newUnbuiltCells, cellCreationOrder);
        }

        // this is a key-value dictionary of objects
        let newObject = {}

        for (var childName in children) {
            newObject[childName] = this.mapChildrenIdentitiesToCells(
                parentId,
                children[childName],
                newUnbuiltCells,
                cellCreationOrder
            );
        }

        return newObject;
    }

    createCellFromInitialMessage(newNodeId, newUnbuiltCells, cellCreationOrder) {
        if (!newUnbuiltCells[newNodeId]) {
            throw new Error("No cell with identity " + newNodeId + " was provided.");
        }

        // record the order in which we built the cells.
        cellCreationOrder.push(newNodeId);

        // pull the definition of the cell directly out of the message
        // since we want to track and confirm that we consumed all the cells.
        let message = newUnbuiltCells[newNodeId];
        delete newUnbuiltCells[newNodeId];

        let cellClass = this.availableCells[message.cellType];

        if(!cellClass) {
            throw new Error(`Cannot find Cell for Cell Type: ${message.cellType}`);
        }

        let actualNamedChildren = this.mapChildrenIdentitiesToCells(
            newNodeId,
            message.children,
            newUnbuiltCells,
            cellCreationOrder
        );

        let parent = message.parent !== null ? this.activeCells[message.parent] : null;

        let newCell = new cellClass(
            message.extraData,
            newNodeId,
            actualNamedChildren,
            this
        );

        this.activeCells[newNodeId] = newCell;

        return newCell;
    }

    cellReceivedFocus(cellId) {
        if (this.isProcessingFocusEvent) {
            // we don't need to send this back to the server
            return;
        }

        this.committedFocusEventId += 1;
        this.currentlyFocusedCellId = cellId;

        this.sendMessageToCells(
            {
                event: 'focusChanged',
                eventId: this.committedFocusEventId,
                cellId: cellId
            }
        );
    }

    sendMessageFor(message, cellId){
        if (this.socket) {
            message['target_cell'] = cellId.toString();
            this.socket.sendString(JSON.stringify(message));
        }
    }

    sendMessageToCells(message){
        if (this.socket) {
            message['target_cell'] = 'main_cells_handler';
            this.socket.sendString(JSON.stringify(message));
        }
    }

    sendMessageToCellSession(message){
        if (this.socket) {
            message['target_cell'] = 'main_cells_session';
            this.socket.sendString(JSON.stringify(message));
        }
    }
}

export {CellHandler, CellHandler as default};
