/**
 * Tree Node Web component
 **/


// Simple grid-based sheet component
const templateString = `
<style>
:host {
   position: relative;
}

</style>
<div> A Node </div>
`;

class TreeNode extends HTMLElement {
    constructor() {
        super();
        this.template = document.createElement("template");
        this.template.innerHTML = templateString;
        this.attachShadow({ mode: "open" });
        this.shadowRoot.appendChild(this.template.content.cloneNode(true));
    }

    get ok(){
        return "ok";
    }
}

window.customElements.define("tree-node", TreeNode);

export { TreeNode as default, TreeNode }
