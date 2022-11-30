## About ##

The tree plotting library is a simple way of plotting nested list n-arry tree representations. It is build on two main web-components: the [Tree](./Tree.js) and [TreeNode](./TreeNode.js). The nodes are connected by svg lines and any node of your choosing can be used. IE `Tree` class-element simply expects that there is a `tree-node` element defined in the DOM and that is has some width and height. 

### Installation and Build ###

In a `nodeenv` run `npm install && npm run build`. To see an example serve the [examples](./examples) directory using `python -m http.server` (or whatever web-server you prefer).
