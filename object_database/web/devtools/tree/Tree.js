/**
  * Tree Graph Web component
  **/

import LeaderLine from "leader-line";

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
    }

    connectedCallback(){
        if(this.isConnected){
            this.setup();
        }
    }

    setup(data){
        const wrapper = this.shadowRoot.querySelector("#wrapper");
        const nodeDepth = document.createElement("div");
        nodeDepth.classList.add("depth");
        wrapper.append(nodeDepth);
        this.setupNode(data, nodeDepth);
    }

    setupNode(nodeData, nodeDepth){
        if(nodeData){
            const node = document.createElement("tree-node");
            node.name = nodeData.name;
            node.setAttribute("id", nodeData.id);
            nodeDepth.append(node);
            // setup the children in a new node depth
            const wrapper = this.shadowRoot.querySelector("#wrapper");
            const childrenDepth = document.createElement("div");
            childrenDepth.classList.add("depth");
            wrapper.append(childrenDepth);
            nodeData.children.forEach((childData) => {
                this.setupNode(childData, childrenDepth);

            })
        }
    }

    updateLeaderLines(depth){
        //TODO:
    }

    get ok(){
        return "ok";
    }
}

window.customElements.define("tree-graph", Tree);

export { Tree as default, Tree }
