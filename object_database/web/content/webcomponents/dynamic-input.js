/**
 * Dynamic Input Component
 */

const style = `
*,
:root {
    box-sizing: border-box;
}
:host {
    display: block;
    box-sizing: border-box;
    position: relative;
    white-space: nowrap;
    text-overflow: ellipsis;
    border: 1px solid transparent;
    text-overflow: ellipsis;
}

input {
    border: none;
    padding: 0;
    margin: 0;
    font-size: inherit;
    font-family: inherit;
}

div {
    display: inline-block;
    padding: 0;
    margin: 0;
    font-size: inherit;
    font-family: inherit;
    white-space: inherit;
    text-overflow: ellipsis;
}

div > span {
    white-space: nowrap;
    text-overflow: ellipsis;
}

:host(.border) {
    border-color: rgba(0, 0, 0, 0.4);
}

:host(:not(.show-value-area)[active="false"]:hover) {
    border-color: rgba(0, 0, 0, 0.1);
    cursor: pointer;
}

#valueArea {
    position: absolute;
    padding: 10px;
    box-sizing: border-box;
    display: inherit;
    width: 0%;
    height: 0%;
    top: 100%;
    left: 0px;
    background-color: white;
    border-bottom: 1px solid rgba(0, 0, 0, 0.3);
    border-right: 1px solid rgba(0, 0, 0, 0.3);
    border-left: 1px solid rgba(0, 0, 0, 0.3);
    border-bottom-left-radius: 10px;
    border-bottom-right-radius: 10px;
    opacity: 0.01;
    z-index: 1000;
}

:host(.show-value-area) {
    border-right: 1px solid rgba(0, 0, 0, 0.3);
    border-left: 1px solid rgba(0, 0, 0, 0.3);
}

:host(.show-value-area) #valueArea {
    height: auto;
    width: calc(100% + 2px);
    left: -1px;
    opacity: 1.0;
}
`;

class DynamicInput extends HTMLElement {
    constructor(){
        super();
        this.attachShadow({mode: 'open'});
        this.makeElements();

        // Whether or not the input
        // is currently being displayed
        this.isActive = false;

        // We store the previous value in
        // the event that the user 'escapes'
        // during input
        this.value = "";
        this.previousValue = "";

        // Bind component methods
        this.handleClick = this.handleClick.bind(this);
        this.handleBlur = this.handleBlur.bind(this);
        this.handleKeyup = this.handleKeyup.bind(this);
        this.handleInputChange = this.handleInputChange.bind(this);
        this.showInput = this.showInput.bind(this);
        this.showLabel = this.showLabel.bind(this);
    }

    makeElements(){
        // Set up the input element.
        // It will not be shown initially
        this.input = document.createElement('input');
        let incomingType = this.getAttribute('type');
        this.input.setAttribute('type', incomingType || 'text');
        this.input.addEventListener('change', this.handleInputChange.bind(this));
        this.input.addEventListener('input', (e) => {
            this.dispatchEvent(new Event('input'));
        });

        // Setup the label element. This will
        // be displayed initially
        this.label = document.createElement('div');
        this.labelSpan = document.createElement('span');

        // Make the display area that will show us the
        // current value when we click the activation button
        this.valueArea = document.createElement('div');
        this.valueArea.id = "valueArea";
        this.valueAreaPara = document.createElement('p');
        this.valueArea.append(this.valueAreaPara);

        // Finally, add the style element
        this.styleElement = document.createElement('style');
        this.styleElement.innerText = style;
    }

    connectedCallback(){
        this.shadowRoot.appendChild(this.label);
        this.label.appendChild(this.labelSpan);
        this.shadowRoot.appendChild(this.styleElement);
        this.shadowRoot.appendChild(this.valueArea);
        this.setAttribute('active', this.isActive);


        // Bind general events to this element
        this.addEventListener('click', this.handleClick);
        this.addEventListener('blur', this.handleBlur);
        this.addEventListener('keyup', this.handleKeyup);
    }

    attributeChangedCallback(name, oldVal, newVal){
        if(name == 'value'){
            this.input.setAttribute('value', newVal);
            this.input.value = newVal;
            this.value = newVal;
            this.previousValue = oldVal;
        }
        if(name == 'type'){
            this.input.setAttribute('type', newVal);
        }
        if(name == 'label'){
            this.labelSpan.innerText = newVal;
        }
    }

    showLabel(){
        let labelText = this.getAttribute('label');
        this.labelSpan.innerText = `${labelText}`;
        this.shadowRoot.children[0].replaceWith(this.label);
        this.isActive = false;
        this.classList.remove('border');
        this.setAttribute('active', this.isActive);
    }

    showInput(width, height){
        this.input.style.width = `${width}px`;
        this.input.style.height = `${height}px`;
        this.shadowRoot.children[0].replaceWith(this.input);
        this.isActive = true;
        this.classList.add('border');
        this.setAttribute('active', this.isActive);
    }

    showValueArea(){
        this.valueAreaPara.innerText = `${this.value}`;
        this.classList.add('show-value-area');
    }

    hideValueArea(){
        this.classList.remove('show-value-area');
    }

    toggleValueArea(){
        if(this.classList.contains('show-value-area')){
            this.hideValueArea();
        } else {
            this.showValueArea();
        }
    }

    handleClick(evt){
        if(!this.isActive && !this.classList.contains('show-value-area')){
            let width = this.label.scrollWidth;
            let height = this.label.scrollHeight;
            this.showInput(width);
            this.isActive = true;
            this.input.focus();
        }
    }

    handleInputChange(evt){
        console.log(this);
        console.log(evt.target);
        console.log(evt.target.value);
        this.setAttribute('value', evt.target.value);
    }

    handleBlur(evt){
        this.showLabel();
    }

    handleKeyup(event){
        if(event.key == 'Enter' && this.isActive){
            this.showLabel();
        } else if(event.key == 'Escape' && this.isActive){
            this.showLabel();
        }
    }

    static get observedAttributes(){
        return [
            'value',
            'type',
            'label'
        ]
    }
};

document.addEventListener('DOMContentLoaded', () => {
    window.customElements.define('dynamic-input', DynamicInput);
});
