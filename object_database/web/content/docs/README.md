# Research Frontend Web Application

This documentation includes a description of the client-side architecture and setup.

### Basic setup
The web app consists of three main files:
* [page.html](./page.html) : this is what the web server actually serves; it contains the headers file and the application bundle
* [main.js](main.js) : generally app level configuration. This is where much of the front end is setup: Websocket message handling, initial page load, component and keyevent registries etc.
* [main.bundle.js](../dist/main.bundle.js) : this is the core of the application. It is built using [webpack](https://webpack.js.org/concepts/); see `Building the application below.`

### Installing
Repository wide installation, as described in [INSTALLATION.md](../../../INSTALLATION.md) is the common way to install the application dependencies.

However if you prefer to run a manual install, then execute the following in a virtual environment:
```
pip3 install nodeenv; \
nodeenv --prebuilt --node=10.15.3 $(NODE_ENV); \
. $(NODE_ENV)/bin/activate; \
npm install --global webpack webpack-cli; \
cd object_database/web/content; \
npm install
```

### Building
 The application is build using [webpack](https://webpack.js.org/concepts/).

To build the application simply run `npm run build` from the [content](../) directory, in a virtual environment. This will build all application-wide dependencies, including the web-components.

The build itself is configured in the [webpack.config.js](../webpack.config.js) file. There you will find a very simple configuration which tells webpack to get everything main.js needs and put it into the [main.bunldle.js](../dist/main.bundle.js) file.

### Testing

JS tests can be run by executing `npm run test` in the [content](../) directory. To run the Selenium headless browser playground examples tests, execute `pytest .` in the [cells_demo](../../cells_demo) directory.
(note: this will boot up the object database webtest application on the default 8000 port, so make sure you don't have another one up and running at the same time on the same port).

### General architecture

The application is composed of three essential parts:

* [maquette.js](https://maquettejs.org/)
* various global handlers and regestries (WS message handlers, component registry etc)
* components
* web components

These are described in more detail below.

For a brief and clear overview please refer to the [main.js](../main.js) file and instantiation therein.

### Maquette

The maquette library handles all interaction with the virtual DOM. The components themselves are written in the maquette h-script.

### Websocket messaging and the Cell Handler

The [CellSocket class](../CellSocket.js) is a convenience wrapper for all web-socket messagaing.

The [CellHandler class](../NewCellHandler.js) handles is the API that handles interaction between cells and their corresponding components. This handling is branched into five core message types:

* cellUpdated: occurs whenever a new cell (and hence component) is created or a cell is updated
* cellDataUpdated: occurs when the data dependent cell/component receieved new data (sheet navigation is a good example of when this happens)
* cellDataRequested: indicates that the server has requested some data from the client, with no updates of changes occuring the application (requesting the current KeyListener data is a an example)
* cellsDiscarded: a list of cell/component ids which are to be removed from the DOM
* appendPostscript: execute the raw JS script on the client side

### Component Registry

The [Component Registry](../ComponentRegistry.js) is a application global store which contains a list of all the currently available components. For example, the cells message handler uses the store to match WS messages and their corresponding components.

### Keydown Event Registry

The keydown event registry presents easily accessible/inspectable/serializable global keydown event registry, which can be sent over the WS, and also potentially directly manipulated via a WS protocol.

It also allows  to keep component specific keydown event definitions local as needed, i.e. we want to be able to define an `onkeydown`event handlers within a specific component class instance for easier development and debugging, but also to be able to defined more global and inter-component events  (such as keyboard switching between editors).

## Approach
There are three main classes which handle the keyboard related events:
* `KeyBinding:` handles the binding of a key combination and the callback/handler
* `KeyListener`: handles adding and removing `keydown` event listeners to specific DOM elements (components) as well as to the KeyRegistry and passing the event down to specific

#### KeyBinding instances
* `KeyRegistry`: registers all `keydown` event KeyListener instances (similar in spirit to the `ComponentRegistry`); can serialize current state and send over the WS; potentially will accept server side programmatic instantiation of key events in the future

#### Features of the KeyRegistry:
* find all live components/DOM element which listen for specific key-combinations
* given a component/DOM element see which, if any, KeyListener it subscribes to
* find KeyListener by it’s id (all listeners will generate a unique id, which is can be the DOM element `nodeName`, id or props passed id depending on the situation).
* generate a JSON serializable view of current state of the Registry which can be sent over the WS. The current implementation returns very basic information about the listeners but this can be expanded as needed. Here is an example of the return format:
```
	{
		‘KeyListeners’: [
			{‘cell_id’: string, ‘key-combo`: string},
			{….},
			….
		]
	}
```
* KeyListeners  are added and removed (by id) from the registry
* KeyRegistry are added to `window` and hence accessible globally

#### Features of the KeyListener:
* a KeyListener is initialized with a target  element (for example `component.getDomElement()` or `document`) and a list of instances of KeyBinding which will contain information about which key-combinations to listen for and the handler/callback.
* global/window event listeners can be defined within the `RootComponent` or in the `KeyAction` component as needed. (If defining various global KeyListeners will become unwieldy there we can create a separate file/module to keep this clean.)
*  `KeyListener.start()` adds the `keydown`-event listener to the target (self.target ) element. It will also add self to the registry. In general .start() will be called inside the component.componentDidMount() method but it can also be a callback for a DOM event like onFocus() to make sure the listener is only there when the component/element is in focus
* `KeyListener.pause()` removes the keydown listener from the target and self from the registry. Like .start() you will have the option to define this as a callback for say onBlur() Anytime `component.componentWillUnload()`  is called, for example when a “cellDiscard” message comes through .pause()  will be called on self.KeyListener if it is defined.

#### Features of KeyBinding:
* Initiates the callback given a matching key-combination. This allows a clean way to keep track of which key-combination act on which DOM element. In addition, various event-flow controller options are added such as `preventDefault` or `stopPropagation`.


### Webcomponents

As of writing there `ap-sheet` is the only web-component in the library. All web-component code and tests live in [this](../webcomponents) directory.
