# APSheet #
A lazy-loading, spreadsheet-like Table

APSheet presents a Table that can be navigated like a spreadsheet, and whose underlying data can be loaded remotely.

See the [Docs](docs/) for more information.

## Building and Testing ##
The following build instructions assume a node environment that has already installed the dependencies listed in the [package file located here](../../package.json).

### Build Steps ###
1. Install Mocha globally within your node environment `npm install -g mocha`.
2. Install Webpack globalls within your node environment `npm install -g webpack-cli`
3. Build the bundle from the source files: `webpack`
4. Load the example [webcomponent index page](./index.html) in any browser

### Test Steps ###
Follow the build steps above, then run `mocha --require esm ./tests/`

## About Demo Component ##
The Webcomponent (a Custom Element) used by the demo index.html file in this directory is currently only for testing and demonstration purposes
