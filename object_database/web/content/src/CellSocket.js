/**
 * A concrete error thrown
 * if the current browser doesn't
 * support websockets, which is very
 * unlikely.
 */
class WebsocketNotSupported extends Error {
    constructor(args){
        super(args);
    }
}


/**
 * CellSocket Controller
 * ---------------------
 * This class implements an instance of
 * a controller that wraps a websocket client
 * connection and knows how to handle the
 * initial routing of messages across the socket.
 * `CellSocket` instances are designed so that
 * handlers for specific types of messages can
 * register themselves with it.
 * NOTE: For the moment, most of this code
 * has been copied verbatim from the inline
 * scripts with only slight modification.
 **/
class CellSocket {
    constructor(){
        // Instance Props
        this.uri = this.getUri();
        this.socket = null;
        
        /**
         * A callback for handling messages
         * that are normal JSON data messages.
         * @callback messageHandler
         * @param {object} msg - The forwarded message
         */
        this.messageHandler = null;

        /**
         * A callback for handling messages
         * when the websocket connection closes.
         * @callback closeHandler
         */
        this.closeHandler = null;

        /**
         * A callback for handling messages
         * whent the socket errors
         * @callback errorHandler
         */
        this.errorHandler = null;

        /**
         * A callback for receiving packets. Args are (packetId, arrayBuffer)
         **/
        this.packetHandler = null;

        // callback for when we first connect
        this.onOpenHandler = null;

        this.packetId = 1;

        // Bind Instance Methods
        this.connect = this.connect.bind(this);
        this.sendString = this.sendString.bind(this);
        this.handleRawMessage = this.handleRawMessage.bind(this);
        this.onMessage = this.onMessage.bind(this);
        this.onClose = this.onClose.bind(this);
        this.onOpen = this.onOpen.bind(this);
        this.onError = this.onError.bind(this);
        this.onPacket = this.onPacket.bind(this);
    }

    /**
     * Returns a properly formatted URI
     * for the socket for any given current
     * browser location.
     * @returns {string} A URI string.
     */
    getUri(){
        let location = window.location;
        let uri = "";
        if(location.protocol === "https:"){
            uri += "wss:";
        } else {
            uri += "ws:";
        }
        uri = `${uri}//${location.host}`;
        uri = `${uri}/socket${location.pathname}${location.search}`;
        return uri;
    }

    /**
     * Tells this object's internal websocket
     * to instantiate itself and connect to
     * the provided URI. The URI will be set to
     * this instance's `uri` property first. If no
     * uri is passed, `connect()` will use the current
     * attribute's value.
     * @param {string} uri - A  URI to connect the socket
     * to.
     */
    connect(uri){
        if(uri){
            this.uri = uri;
        }
        if(window.WebSocket){
            this.socket = new WebSocket(this.uri);
        } else if(window.MozWebSocket){
            this.socket = MozWebSocket(this.uri);
        } else {
            throw new WebsocketNotSupported();
        }
        this.socket.binaryType = "arraybuffer";
        this.socket.onclose = this.closeHandler;
        this.socket.onmessage = this.handleRawMessage;
        this.socket.onerror = this.errorHandler;
        this.socket.onopen = this.onOpenHandler;
    }

    /**
     * Convenience method that sends the passed
     * string on this instance's underlying
     * websoket connection.
     * @param {string} aString - A string to send
     */
    sendString(aString){
        if(this.socket){
            this.socket.send(aString);
        }
    }

    /**
     * Handles the `onmessage` event of the underlying
     * websocket.
     * This method knows how to fill the internal
     * buffer (to get around the frame limit) and only
     * trigger subsequent handlers for incoming messages.
     * If a buffer is complete, this method will check to see if
     * handlers are registered
     * and will trigger them, passing
     * any parsed JSON data to the callbacks.
     * @param {Event} event - The `onmessage` event object
     * from the socket.
     */
    handleRawMessage(event){
        if (event.data instanceof ArrayBuffer) {
            let packetIdHere = this.packetId;
            this.packetId += 1;

            this.packetHandler(packetIdHere, event.data);
        } else {
            let update = JSON.parse(event.data);

            if (this.messageHandler) {
                this.messageHandler(update);
            }
        }
    }

    onPacket(callback) {
        this.packetHandler = callback;
    }

    onMessage(callback){
        this.messageHandler = callback;
    }

    onClose(callback){
        this.closeHandler = callback;
    }

    onError(callback){
        this.errorHandler = callback;
    }

    onOpen(callback){
        this.onOpenHandler = callback;
    }
}


export {CellSocket, CellSocket as default}
