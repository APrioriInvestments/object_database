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
    border: 2px black solid;
}

.child-wrapper {
    display: flex;
    justify-content: space-around;
    border: 1px blue solid;
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
        this.setupLeaderLines = this.setupLeaderLines.bind(this);
    }

    connectedCallback(){
        if(this.isConnected){
            // this.setup();
        }
    }

    setup(data){
        // const wrapper = this.shadowRoot.querySelector("#wrapper");
        const wrapper = document.body;
        const nodeDepth = document.createElement("div");
        nodeDepth.classList.add("depth");
        nodeDepth.setAttribute("id", "depth-0");
        wrapper.append(nodeDepth);
        const nodeWrapper = document.createElement("div");
        nodeWrapper.classList.add("child-wrapper");
        nodeDepth.append(nodeWrapper);
        this.setupNode(data, nodeWrapper, 1);
    }

    setupNode(nodeData, wrapperDiv, depth){
        if(nodeData){
            console.log(depth);
            const node = document.createElement("tree-node");
            node.name = nodeData.name;
            node.setAttribute("id", nodeData.id);
            wrapperDiv.append(node);
            // setup the children in a new node depth
            if(nodeData.children.length){
                // if the corresponding depth has not been added, do so now
                let depthDiv = document.body.querySelector(`#depth-${depth}`);
                if (!depthDiv) {
                    depthDiv = document.createElement("div");
                    depthDiv.setAttribute("id", `depth-${depth}`);
                    depthDiv.classList.add("depth");
                    // const wrapper = this.shadowRoot.querySelector("#wrapper");
                    const wrapper = document.body;
                    wrapper.append(depthDiv);
                }
                const childWrapper = document.createElement("div");
                childWrapper.classList.add("child-wrapper");
                depthDiv.append(childWrapper);
                nodeData.children.forEach((childData) => {
                    const child = this.setupNode(childData, childWrapper, depth + 1);
                    // this.updateLeaderLines(node, child);

                })
            }
            return node;
        }
    }

    setupLeaderLines(data){
        if (data && data.children) {
            const parent = document.body.querySelector(`tree-node#${data.id}`);
            data.children.forEach((cdata) => {
                const child = document.body.querySelector(`tree-node#${cdata.id}`);
                new LeaderLine(parent, child);
            })
        }
    }

    get ok(){
        return "ok";
    }
}

window.customElements.define("tree-graph", Tree);

export { Tree as default, Tree }
