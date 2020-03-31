/**
 * DisplayLineTextBox Cell Component
 * ----------------------------------
 * I am like a SingleLineTextBox, except
 * that I display like a label until clicked
 * upon, after which you can enter arbitrary
 * text into me. I will not change my underlying
 * value, however.
 * To be used primarily in table filtering on
 * columns
 */
import {Component} from './Component';
import {PropTypes} from './util/PropertyValidator';
import {h} from 'maquette';

/**
 * About Named Children
 * ---------------------
 * `octicon` (single) - Optional octicon to display
 *    to the right of the input area.
 * `clearOcticon (single) - Optional octicon to display
 *    to the right of the input area only when
 *    the input contains a current value.
 */
class DisplayLineTextBox extends Component {
    constructor(props, ...args){
        super(props, ...args);

        // We don't use the input element's
        // value property directly. Instead,
        // we store our own. The initial value
        // is based on the incoming props
        this.storedValue = this.props.initialValue || "";

        // We use the following property to say
        // whether or not the overall component
        // is 'active'. Active means the input
        // is showing (and the label is hidden).
        // Inactive (or false) means the reverse.
        this.isActive = false;

        // Bind component methods
        this.makeLabelArea = this.makeLabelArea.bind(this);
        this.makeInputArea = this.makeInputArea.bind(this);
        this.makeButtonArea = this.makeButtonArea.bind(this);
        this.handleBlur = this.handleBlur.bind(this);
        this.handleFocus = this.handleFocus.bind(this);
        this.handleChange = this.handleChange.bind(this);
        this.handleInput = this.handleInput.bind(this);
        this.handleKeyDown = this.handleKeyDown.bind(this);
        this.handleLabelClick = this.handleLabelClick.bind(this);
        this.handleOcticonClick = this.handleOcticonClick.bind(this);
        this.activate = this.activate.bind(this);
        this.deactivate = this.deactivate.bind(this);
    }

    build(){
        console.log("Build!");
        return(
            h('div', {
                id: this.getElementId(),
                "data-cell-id": this.props.id,
                "data-cell-type": "DisplayLineTextBox",
                "data-is-active": this.isActive.toString(),
                class: "cell display-line-textbox"
            }, [
                this.makeInputArea(),
                this.makeLabelArea(),
                this.makeButtonArea()
            ])
        );
    }

    /** Area Builders **/


    /**
     * Creates the initial input area
     * velement and binds the appropriate
     * event handlers to it.
     * @returns {velement} - A maquette velement
     */
    makeInputArea(){
        return(
            h('input', {
                id: `display-line-input-${this.props.id}`,
                class: "display-line-input",
                onchange: this.handleChange,
                oninput: this.handleInput,
                onfocus: this.handleFocus,
                onblur: this.handleBlur,
                onkeydown: this.handleKeyDown,
                value: this.storedValue
            }, [])
        );
    }

    /**
     * Creates the label display area
     * velement and binds the click event
     * to it.
     * @returns {velement} - A maquette velement
     */
    makeLabelArea(){
        let displayText = this.props.displayText;
        if(this.storedValue != ""){
            displayText = `${displayText} [F]`;
        }
        return(
            h('div', {
                id: `display-line-label-${this.props.id}`,
                class: "display-line-label",
                onclick: this.handleLabelClick
            }, [displayText])
        );
    }

    /**
     * Creates the octicon button
     * display area velement and
     * binds the click events for
     * it.
     * @returns {velement} - A maquette
     * velement
     */
    makeButtonArea(){
        let which = this.storedValue != "" ? "clearOcticon" : "octicon";
        return(
            h('span', {
                id: `display-line-buttons-${this.props.id}`,
                class: "display-line-buttons",
                onclick: this.handleOcticonClick,
                "data-to-display": which
            }, [this.renderChildNamed(which)])
        );
    }

    /** State Change Logic **/

    /**
     * Sets the component to 'active'.
     * This hides the label and shows the
     * input.
     */
    activate(){
        if(this.isActive){
            return;
        }
        this.isActive = true;

        // Get the label area's width.
        // We will use this to set the
        // input area's width
        let labelWidth = this.getDOMElement().querySelector('.display-line-label').scrollWidth;
        let inputEl = this.getDOMElement().querySelector('input');
        inputEl.style.width = `${labelWidth}px`;

        // Now switch the data-attr on the
        // root element, which will update
        // the display styles
        // (See CSS sheet for more info)
        let thisEl = this.getDOMElement();
        thisEl.setAttribute('data-is-active', 'true');

        // Finally, we give the input
        // element the focus and selection
        inputEl.focus();
        inputEl.select();
    }

    deactivate(){
        if(!this.isActive){
            return;
        }

        this.isActive = false;

        // Reset the width of the input
        // back to zero
        let inputEl = this.getDOMElement().querySelector('input');
        inputEl.style.width = null;

        // Switch the data-attr on the
        // root element, which will update
        // the display styles.
        // (See CSS sheet for more info)
        let thisEl = this.getDOMElement();
        thisEl.setAttribute('data-is-active', 'false');
    }

    /**
     * Sets the internal stored value
     * to an empty string. Also sets
     * the input value to an empty
     * string and sends message to
     * the server.
     */
    clear(){
        this.storedValue = "";
        let inputEl = this.getDOMElement().querySelector('input');
        inputEl.value = "";
        this.isActive = false;
        this.sendMessage({
            event: "input",
            text: this.storedValue
        });
    }


    /** Event Handling **/
    handleChange(event){
        // Because this message will trigger a
        // rebuild, we don't need to call the
        // full deactivate() method, but instead
        // simply set isActive.
        this.isActive = false;
        if(event.target.value != this.storedValue){
            this.storedValue = event.target.value;
            this.sendMessage({
                event: "input",
                text: this.storedValue
            });
        }
    }

    handleInput(event){
        // handle input events on the input
    }

    handleFocus(event){
        // handle focus events on the input
    }

    handleBlur(event){
        let inputVal = event.target.value;
        if(inputVal == this.storedValue){
            // Then no change event will fire,
            // so we need to deactivate here
            // manually
            this.deactivate();
        }
    }

    handleKeyDown(event){
        // handle keydown events on the
        // input
        if(event.key == 'Escape' && document.activeElement == event.target){
            event.target.value = this.storedValue;
            this.deactivate();
            event.preventDefault();
        }
    }

    handleLabelClick(event){
        this.activate();
    }

    handleOcticonClick(event){
        let targetKind = event.currentTarget.dataset.toDisplay;
        console.log(targetKind);
        if(targetKind && targetKind == "clearOcticon"){
            this.clear();
        } else if(targetKind == "octicon" && this.isActive){
            this.deactivate();
        } else if(targetKind == "octicon" && !this.isActive){
            this.activate();
        }
    }
};

/** TODO: Add PropTypes **/

export {
    DisplayLineTextBox as default,
    DisplayLineTextBox
};
