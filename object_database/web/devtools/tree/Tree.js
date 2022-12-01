/**
  * Tree Graph Web component
  **/


// Simple grid-based sheet component
const templateString = `
<style>
.animation-fade-out {
  animation: fade-out 1s steps(90) forwards;
 -webkit-animation: fade-out 1s steps(90) forwards;
  -moz-animation: fade-out 1s steps(90) forwards;
}

.animation-fade-in {
  animation: fade-in 0.5s steps(90) forwards;
 -webkit-animation: fade-in 0.5s steps(90) forwards;
  -moz-animation: fade-in 0.5s steps(90) forwards;
}

@keyframes fade-out {
  from {
    opacity: 1;
  }
  to {
    opacity: 0.0;
  }
}

@keyframes fade-in {
  from {
    opacity: 0.0;
  }
  to {
    opacity: 1;
  }
}

:host {
   display: grid;
   user-select: none;
    width: 100%!important;
}

#wrapper {
}

.depth {
    display: flex;
    justify-content: space-around;
    margin-top: 30px;
    margin-bottom: 30px;
}

.child-wrapper {
    margin-top: 5px;
    margin-bottom: 5px;
    display: flex;
    justify-content: space-around;
}

svg {
    z-index: -1;
}

.non-final-leaf {
    background-color: var(--palette-lightblue)
}

</style>
<div id="wrapper"></div>
`;

class Tree extends HTMLElement {
    constructor() {
        super();
        this.template = document.createElement("template");
        this.template.innerHTML = templateString;
        this.attachShadow({ mode: "open" });
        this.shadowRoot.appendChild(this.template.content.cloneNode(true));

        this.data;

        // bind methods
        this.setup = this.setup.bind(this);
        this.clear = this.clear.bind(this);
        this.setupNode = this.setupNode.bind(this);
        this.setupPaths = this.setupPaths.bind(this);
        this.addSVGPath = this.addSVGPath.bind(this);
        this.onWindowResize = this.onWindowResize.bind(this);
        // event handlers
        this.onNodeDblclick = this.onNodeDblclick.bind(this);
        this.onKeyUp = this.onKeyUp.bind(this);
    }

    connectedCallback(){
        if(this.isConnected){
            // add event listeners
            window.addEventListener("resize", this.onWindowResize);
            document.addEventListener("keyup", this.onKeyUp);
            this.setAttribute("display-depth", 3);
        }
    }

    disconnectedCallback(){
        document.removeEventListener("key", this.onKeyUp);
    }

    setup(data, cache=true){
        this.clear();
        if (cache){
            // cache the data; TODO: think through this
            this.data = data;
        }
        const wrapper = this.shadowRoot.querySelector("#wrapper");
        wrapper.addEventListener("dblclick", this.onNodeDblclick);
        const nodeDepth = document.createElement("div");
        nodeDepth.classList.add("depth");
        nodeDepth.setAttribute("id", "depth-0");
        wrapper.append(nodeDepth);
        const nodeWrapper = document.createElement("div");
        nodeWrapper.classList.add("child-wrapper");
        nodeDepth.append(nodeWrapper);
        this.setupNode(data, nodeWrapper, 1, true); // this is a root node
        // setup the node paths
        const svg = document.createElementNS('http://www.w3.org/2000/svg', "svg");
        svg.setAttribute("width", wrapper.getBoundingClientRect().width);
        svg.setAttribute("height", "100%");
        svg.style.position = "absolute";
        svg.style.left = 0;
        svg.style.top = 0;
        wrapper.append(svg);
        this.setupPaths(svg, data);
        // fade the wrapper
        wrapper.classList.remove("animation-fade-out");
        wrapper.classList.add("animation-fade-in");
    }

    setupNode(nodeData, wrapperDiv, depth, root=false){
        if(nodeData){
            const node = document.createElement("tree-node");
            node.name = nodeData.name;
            node.setAttribute("id", nodeData.id);
            if (root) {
                node.setAttribute("data-root-node", true);
            }
            wrapperDiv.append(node);
            node.addEventListener("dblclick", this.onNodeDblclick);
            // setup the children in a new node depth
            if (nodeData.children.length) {
                // if we are at the display-depth don't iterate on the children
                // simply mark that the nodes have children
                if (depth == this.getAttribute("display-depth")){
                    node.classList.add("non-final-leaf");
                    return;
                }
                // if the corresponding depth has not been added, do so now
                let depthDiv = this.shadowRoot.querySelector(`#depth-${depth}`);
                if (!depthDiv) {
                    depthDiv = document.createElement("div");
                    depthDiv.setAttribute("id", `depth-${depth}`);
                    depthDiv.classList.add("depth");
                    const wrapper = this.shadowRoot.querySelector("#wrapper");
                    wrapper.append(depthDiv);
                }
                const childWrapper = document.createElement("div");
                childWrapper.classList.add("child-wrapper");
                depthDiv.append(childWrapper);
                nodeData.children.forEach((childData) => {
                    this.setupNode(childData, childWrapper, depth + 1);

                })
            }
            return node;
        }
    }

    setupPaths(svg, nodeData){
        if (nodeData) {
            this.attainedDepth += 1;
            const parent = this.shadowRoot.querySelector(`#${nodeData.id}`);
            nodeData.children.forEach((childData) => {
                const child = this.shadowRoot.querySelector(`#${childData.id}`);
                if (parent && child) {
                    this.addSVGPath(svg, parent, child);
                    this.setupPaths(svg, childData);
                }
            })
        }
    }

    /**
      * I add an SVG bezier curve which starts at the bottom middle
      * of the startNode and ends at the top middle of the endNode
      * NODE: svg-type elemnents need to be created using the
      * SVG name space, ie document.createElementNS...
      * @param {svg-element} svg
      * @param {element} startNode
      * @param {element} endNode
      */
    addSVGPath(svg, startNode, endNode){
        const startRect = startNode.getBoundingClientRect();

        const startY = startRect.bottom;
        const startX = startRect.left + (startRect.width / 2);
        const endRect = endNode.getBoundingClientRect();
        const endY = endRect.top;
        const endX = endRect.left + (endRect.width / 2);


        /**
        const line = document.createElementNS('http://www.w3.org/2000/svg', "line");
        line.setAttribute("x1", `${startX}`);
        line.setAttribute("y1", `${startY}`);
        line.setAttribute("x2", `${endX}`);
        line.setAttribute("y2", `${endY}`);
        line.setAttribute("stroke", "var(--palette-blue)");
        line.setAttribute("stroke-width", "3px");
        line.setAttribute("data-start-node-id", startNode.id);
        line.setAttribute("data-end-node-id", endNode.id);
        svg.append(line);
        **/
        // add a quadratic bezier curve path
        let midX;
        let controlX;
        let controlSlope = 1;
        if (endX < startX) {
            midX = endX + 0.5 * (startX - endX);
            controlX = midX + 0.5 * (startX - midX);
            controlSlope *= -1;
        } else {
            midX = startX + 0.5 * (endX - startX);
            controlX = startX + 0.5 * (startX - midX);
        }
        const midY = startY + 0.5 * (endY - startY);
        let controlY = startY + 0.5 * (midY - startY);
        controlX *= controlSlope;
        controlY *= controlSlope;
        const path = document.createElementNS('http://www.w3.org/2000/svg', "path");
        path.setAttribute("stroke", "var(--palette-blue)");
        path.setAttribute("stroke-width", "3px");
        path.setAttribute("fill", "transparent");
        path.setAttribute("data-start-node-id", startNode.id);
        path.setAttribute("data-end-node-id", endNode.id);
        const d = `M ${startX} ${startY} Q ${controlX} ${controlY}, ${midX} ${midY} T ${endX} ${endY}`;
        path.setAttribute("d", d);
        svg.append(path);

    }

    /**
      * On a window resize I first clear the tree and then redraw it
      **/
    onWindowResize(event){
        this.setup(this.data);
    }

    onNodeDblclick(event){
        // if clicking on the root node, reset back to cached this.data tree
        if (event.target.nodeName != "TREE-NODE") {
            this.setup(this.data);
        } else if (event.target.hasAttribute("data-root-node")) {
            const id = event.target.id;
            const subTree = this.findParentSubTree(id, this.data);
            this.setup(subTree, false); // do not cache this data
        } else {
            const id = event.target.id;
            const subTree = this.findSubTree(id, this.data);
            this.setup(subTree, false); // do not cache this data
        }
    }

    onKeyUp(event){
        if (event.key == "ArrowUp") {
            // re-render the tree from the parent of the current root node
            const rootNode = this.shadowRoot.querySelector("tree-node[data-root-node]");
            const subTree = this.findParentSubTree(rootNode.id, this.data);
            this.setup(subTree, false); // do not cache this data
        }
    }
    /**
      * I recursively walk the tree to find the corresponding
      * node, and when I do I return its subtree
      **/
    findSubTree(id, node){
        if(node.id == id) {
            return node;
        }
        let subTree;
        node.children.forEach((childNode) => {
            const out = this.findSubTree(id, childNode);
            if (out) {
                subTree = out;
            }
        })
        return subTree;
    }

    /**
     * I recursively walk the tree to find the corresponding
     * parent node, and when I do I return its subtree
     **/
    findParentSubTree(id, node){
        // if already at the top of the tree return it
        if (id == this.data.id) {
            return this.data;
        }
        let subTree;
        const isParent = node.children.some((child) => child.id == id)
        if (isParent) {
            subTree = node;
        } else {
            node.children.forEach((childNode) => {
                const out = this.findParentSubTree(id, childNode);
                if (out) {
                    subTree = out;
                }
            })
        }
        return subTree;
    }
    clear(){
        const wrapper = this.shadowRoot.querySelector("#wrapper");
        wrapper.classList.remove("animation-fade-in");
        wrapper.classList.add("animation-fade-out");
        wrapper.replaceChildren();
    }

    static get observedAttributes() {
        return ["display-depth"];
    }

    attributeChangedCallback(name, oldValue, newValue) {
        if (name == "display-depth") {
            this.setup(this.data);
        }
    }
}

window.customElements.define("tree-graph", Tree);

export { Tree as default, Tree }
