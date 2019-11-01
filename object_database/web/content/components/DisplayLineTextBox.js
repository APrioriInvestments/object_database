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
 */
class DisplayLineTextBox extends Component {
    constructor(props){
        super(props);

        // We do not use the element's
        // value property. Instead, we
        // store a custom one here, since
        // we always want to display the text
        // when the element isn't active.
        this.storedValue = "";

        // Bind methods
        this.onInput = this.onInput.bind(this);
        this.onChange = this.onChange.bind(this);
        this.onFocus = this.onFocus.bind(this);
        this.onBlur = this.onBlur.bind(this);
        this.onOcticonClick = this.onOcticonClick.bind(this);
        this.handleKeyDown = this.handleKeyDown.bind(this);
    }

    componentDidLoad(){
        this.storedValue = this.props.initialValue;
    }

    build(){
        return (
            h('div', {
                id: this.props.id,
                "data-cell-id": this.props.id,
                "data-cell-type": "DisplayLineTextBox",
                class: "cell display-line-textbox"
            }, [
                h('input', {
                    id: `display-line-input-${this.props.id}`,
                    class: "cell display-line-textbox-input",
                    onchange: this.onChange,
                    oninput: this.onInput,
                    onfocus: this.onFocus,
                    onblur: this.onBlur,
                    value: this.props.displayText,
                    onkeydown: this.handleKeyDown
                }, []),
                h('span', {
                    class: 'display-line-textbox-secondary',
                    onclick: this.onOcticonClick
                }, [
                    this.renderChildNamed('octicon')
                ])
            ])
        );
    }

    onFocus(event){
        event.target.value = this.storedValue;
    }

    onBlur(event){
        event.target.value = this.props.displayText;
    }

    onInput(event){
        this.storedValue = event.target.value;
    }

    onChange(event){
        cellSocket.sendString(
            JSON.stringify(
                {
                    "event": "input",
                    "target_cell": this.props.id,
                    "text": this.storedValue
                }
            )
        );
    }

    onOcticonClick(event){
        let inputEl = document.getElementById(`display-line-input-${this.props.id}`);
        if(document.activeElement == inputEl){
            inputEl.blur();
        } else {
            inputEl.focus();
        }
    }

    handleKeyDown(event){
        if(event.code == 'Escape'){
            event.target.blur();
            event.preventDefault();
            event.stopPropagation();
        }
    }
}

export {
    DisplayLineTextBox,
    DisplayLineTextBox as default
};
