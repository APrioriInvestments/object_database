class AprioriSheet extends HTMLElement {
    // expose non-inherited (custom) attributes
    static get observedAttributes() {
        return ['rows', 'cols'];
    }

    constructor() {
        super();
        var shadow = this.attachShadow({mode: 'open'});
        this.build(shadow)
        console.log("construction apriori sheet web component");
    }

    // this happens after the component is registered but not fully inserted into the
    // DOM by maquette
    connectedCallback() {
        console.log('initial document DOM append of sheet, id: ' + this.getAttribute('id'));
    }

    // this is effectively our <<first>> load, since it happens after maquette inserts the
    // sheet into the DOM
    attributeChangedCallback() {
        const shadow = this.shadowRoot;
        let table = shadow.querySelector('table');
    }

    // our element is disconnected from the document's DOM
    disconnectedCallback() {
        console.log('disconnecting of sheet, id: ' + this.getAttribute('id'));
    }

    build(shadow) {
        var wrapper = document.createElement('table');
        shadow.appendChild(wrapper);
    }

}
customElements.define('apriori-sheet', AprioriSheet);
