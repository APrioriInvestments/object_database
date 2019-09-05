class AprioriSheet extends HTMLElement {
    static get observedAttributes() {
        return ['text'];
    }

    constructor() {
        super();
        var shadow = this.attachShadow({mode: 'open'});
        var wrapper = document.createElement('span');
        shadow.appendChild(wrapper);
        console.log("construction apriori sheet web component");
    }

    connectedCallback() {
        const shadow = this.shadowRoot;
        console.log('getting sheet attribute: ' + this.getAttribute("text"));
        shadow.querySelector('span').textContent = this.getAttribute("text");

    }

    attributeChangedCallback() {
        const shadow = this.shadowRoot;
        console.log('getting sheet attribute: ' + this.getAttribute("text"));
        shadow.querySelector('span').textContent = this.getAttribute("text");

    }
}
customElements.define('apriori-sheet', AprioriSheet);
