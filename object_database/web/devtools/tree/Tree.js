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
<div> A Tree </div>
`;

class Tree extends HTMLElement {
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

window.customElements.define("my-tree", Tree);

export { Tree as default, Tree }
