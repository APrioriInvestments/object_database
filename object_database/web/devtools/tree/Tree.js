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

</style>
<div id="wrapper"> A Tree </div>
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
        this.setupNode(data);
    }


    setupNode(nodeData){
        if(nodeData){
            const wrapper = this.shadowRoot.querySelector("#wrapper");
            const node = document.createElement("tree-node");
            wrapper.append(node);
            // setup the children
            nodeData.children.forEach((childData) => {
                this.setupNode(childData);
            })
        }
    }




    get ok(){
        return "ok";
    }
}

window.customElements.define("tree-graph", Tree);

export { Tree as default, Tree }
