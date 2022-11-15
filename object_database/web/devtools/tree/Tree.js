/**
  * Tree Graph Web component
  **/


// Simple grid-based sheet component
const templateString = `
<style>
:host {
   display: grid;
   user-select: none;
   overflow: hidden; /* For auto-resize without scrolling on */
}

.depth {
    display: flex;
    justify-content: space-around;
    margin-top: 20px;
    margin-bottom: 20px;
}

.child-wrapper {
    margin-top: 5px;
    margin-bottom: 5px;
    display: flex;
    justify-content: space-around;
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

        // bind methods
        this.setup = this.setup.bind(this);
        this.setupNode = this.setupNode.bind(this);
        this.setupPaths = this.setupPaths.bind(this);
        this.addSVGPath = this.addSVGPath.bind(this);
    }

    connectedCallback(){
        if(this.isConnected){
            // this.setup();

        }
    }

    setup(data){
        const wrapper = this.shadowRoot.querySelector("#wrapper");
        const nodeDepth = document.createElement("div");
        nodeDepth.classList.add("depth");
        nodeDepth.setAttribute("id", "depth-0");
        wrapper.append(nodeDepth);
        const nodeWrapper = document.createElement("div");
        nodeWrapper.classList.add("child-wrapper");
        nodeDepth.append(nodeWrapper);
        this.setupNode(data, nodeWrapper, 1);
        this.setupPaths(data);
    }

    setupNode(nodeData, wrapperDiv, depth){
        if(nodeData){
            const node = document.createElement("tree-node");
            node.name = nodeData.name;
            node.setAttribute("id", nodeData.id);
            wrapperDiv.append(node);
            // setup the children in a new node depth
            if(nodeData.children.length){
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
                    // this.addSVGPath(node, child);

                })
            }
            return node;
        }
    }

    setupPaths(nodeData){
        if (nodeData) {
            const parent = this.shadowRoot.querySelector(`#${nodeData.id}`);
            nodeData.children.forEach((childData) => {
                const child = this.shadowRoot.querySelector(`#${childData.id}`);
                this.addSVGPath(parent, child);
                this.setupPaths(childData);
            })
        }
    }
    /**
      * I add an SVG bezier curve which starts at the bottom middle
      * of the startNode and ends at the top middle of the endNode
      * NODE: svg-type elemnents need to be created using the
      * SVG name space, ie document.createElementNS...
      * @param {element} startNode
      * @param {element} endNode
      */
    addSVGPath(startNode, endNode){
        const wrapper = this.shadowRoot.querySelector("#wrapper");
        const startRect = startNode.getBoundingClientRect();

        const startY = startRect.bottom;
        const startX = startRect.left + (startRect.width / 2);
        const endRect = endNode.getBoundingClientRect();
        const endY = endRect.top;
        const endX = endRect.left + (endRect.width / 2);

        const svg = document.createElementNS('http://www.w3.org/2000/svg', "svg");
        svg.setAttribute("width", "100%");
        svg.setAttribute("height", "100%");
        svg.setAttribute("data-start-node-id", startNode.id);
        svg.setAttribute("data-end-node-id", endNode.id);
        svg.style.left =  0;
        svg.style.top = 0;

        const line = document.createElementNS('http://www.w3.org/2000/svg', "line");
        line.setAttribute("x1", `${startX}`);
        line.setAttribute("y1", `${startY}`);
        line.setAttribute("x2", `${endX}`);
        line.setAttribute("y2", `${endY}`);
        line.setAttribute("stroke", "black");
        svg.append(line);
        wrapper.append(svg);
        /*
        const path = document.createElementNS('http://www.w3.org/2000/svg', "path");
        path.setAttribute("d", `M ${startX} ${startY}  Q 95 10, ${endX} ${endY}`);
        path.setAttribute("stroke", "black");
        path.setAttribute("fill", "transparent");
        svg.append(path);

        wrapper.append(svg);
        const temp = document.createElement("div");
        temp.innerHTML = `<svg width="100%" height="100%" style="position: absolute; top: 0; left: 0"><line x1="${startX}" y1="${startY}" x2="${endX}" y2="${endY}" stroke="black"/></svg>`;
        wrapper.append(temp.childNodes[0])
        */
    }

    get ok(){
        return "ok";
    }
}

window.customElements.define("tree-graph", Tree);

export { Tree as default, Tree }
