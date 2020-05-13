# Research Frontend Web Application

This documentation includes a description of the client architecture and setup. [TODO]

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

### Testting

JS tests can be run by executing `npm run test` in the [content](../) directory. To run the Selenium headless browser playground examples tests, execute `pytest .` in the [cells_demo](../../cells_demo) directory (note: this will boot up the object database webtest application on the default 8000 port, so make sure you don't have another one up and running at the same time on the same port).

### General architecture

The application is composed of three essential parts:

* various global handlers and regestries (WS message handlers, component registry etc)
* components
* web components

These are described in more detail below.

For a brief and clear overview please refer to the [main.js](../main.js) file and instantiation therein.

### Websocket messaging and the Cell Handler

CellSocket class
CellHandler class

Message types

### Component Registry

The [Componen Registry](../ComponentRegistry.js) is a application global store which contains a list of all the currently available components. This is how the cells message handler knows how to match WS messages and their corresponding components.

### Keydown Event Registry



### Webcomponents
