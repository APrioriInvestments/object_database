/**
 * Tree Node Web component
 **/


// Simple grid-based sheet component
const templateString = `
<style>
:host {
    position: relative;
    border: 1px blue solid;
    margin-right: 10px;
    margin-left: 10px;
    background-color: var(--palette-orange);
    padding: 5px;
    border-radius: 10px;
}

div#wrapper {
    max-width: 100px;
    text-overflow: ellipsis;
    overflow: hidden;
}
</style>
<div id="wrapper">
<span id="name"></span>
</div>
`;

class TreeNode extends HTMLElement {
    constructor() {
        super();
        this.template = document.createElement("template");
        this.template.innerHTML = templateString;
        this.attachShadow({ mode: "open" });
        this.shadowRoot.appendChild(this.template.content.cloneNode(true));
    }

    set name(s){
        const name = this.shadowRoot.querySelector("#name");
        name.innerText = s;

    }
}

window.customElements.define("tree-node", TreeNode);

export { TreeNode as default, TreeNode }
