/**
 * Modal Cell Component
 */

import {Component} from './Component';
import {PropTypes} from './util/PropertyValidator';
import {KeyListener} from './util/KeyListener';
import {KeyBinding} from './util/KeyListener';
import {h} from 'maquette';

/**
 * About Named Children
 * --------------------
 * `title` (single) - A Cell containing the title
 * `message` (single) - A Cell contianing the body of the
 *     modal message
 * `buttons` (array) - An array of button cells
 */
class Modal extends Component {
    constructor(props, ...args){
        super(props, ...args);
        // Track the component show/hide
        // state outside of the props
        // for callback purposes
        this.isShowing = this.props.show || false;

        // Bind component methods
        this.makeHeader = this.makeHeader.bind(this);
        this.makeBody = this.makeBody.bind(this);
        this.makeFooter = this.makeFooter.bind(this);
        this.makeClasses = this.makeClasses.bind(this);
        this.focusFirstInput = this.focusFirstInput.bind(this);
        this.beforeShow = this.beforeShow.bind(this);
        this.beforeHide = this.beforeHide.bind(this);
        this.onShow = this.onShow.bind(this);
        this.onHide = this.onHide.bind(this);
        this.onEnterKey = this.onEnterKey.bind(this);
        this.onEscapeKey = this.onEscapeKey.bind(this);

        // listener for keydown events
        let enterBinding = new KeyBinding("Enter", this.onEnterKey, true, false, true);
        let escapeBinging = new KeyBinding("Escape", this.onEscapeKey, true, false, true);
        this.keyListener = new KeyListener(document, [enterBinding, escapeBinging]);

    }

    componentDidLoad(){
        this.focusFirstInput();
        if(!this.isShowing && this.props.show){
            // Then we have "shown" the Modal now.
            // Call onShow method
            this.onShow();
        }
        this.isShowing = this.props.show;
    }

    componentDidUpdate(){
        this.focusFirstInput();
        if(!this.isShowing && this.props.show){
            // In this case, we have gone from
            // hidden to showing, so call
            // onShow
            this.onShow();
        }
        if(this.isShowing && !this.props.show){
            // In this case we have gone from
            // showing to hiding, so call
            // onHide
            this.onHide();
        }
    }

    componentWillReceiveProps(oldProps, newProps){
        // If we are going from showing to not
        // showing, trigger the beforeHide method
        if(oldProps.show && !newProps.show){
            this.beforeHide();
        }

        // If we are going from not showing to
        // showing, trigger the beforeShow method
        if(oldProps.show == false && newProps.show){
            this.beforeShow();
        }

        return newProps;
    }

    componentWillUnload(){
        this.onHide();
    }

    build(){
        return (
            h('div', {
                id: this.getElementId(),
                'data-cell-id': this.props.id,
                'data-cell-type': "Modal",
                class: this.makeClasses(),
                //tabindex: "-1",
                role: "dialog"
            }, [
                h('div', {class: "modal-dialog", role: "document"}, [
                    h('div', {class: "modal-content"}, [
                        h('div', {class: "modal-header"}, [this.makeHeader()]),
                        h('div', {class: "modal-body"}, [this.makeBody()]),
                        h('div', {class: "modal-footer"}, this.makeFooter())
                    ])
                ])
            ])
        );
    }

    makeClasses(){
        let classes = ["cell", "modal-cell"];
        if(this.props.show){
            classes.push("modal-cell-show");
        }
        return classes.join(" ");
    }

    makeFooter(){
        return this.renderChildrenNamed('buttons');
    }

    makeBody(){
        return this.renderChildNamed('message');
    }

    makeHeader(){
        var title = null;
        title = this.renderChildNamed('title');
        if(title){
            return h('h5', {class: "modal-title", id: `${this.props.id}-modalTitle`}, [
                title
            ]);
        }
        return null;
    }

    focusFirstInput(){
        // If there are any input fields present
        // in the Modal, find the first one of them
        // and give it the focus, as long as the
        // modal is currently being shown.
        if(this.props.show){
            console.log("Setting focus to first available input field");
            let firstInputField = this.getDOMElement().querySelector('input[type="text"]');
            if(firstInputField){
                firstInputField.select();
            }
        }
    }

    beforeHide(){
        // Nothing for now
    }

    beforeShow(){
        // Nothing for now
    }

    onShow(){
        // Bind global event listeners for
        // Enter and Escape keys
        this.keyListener.start();
    }

    onHide(){
        this.keyListener.pause();
    }

    onEnterKey(event){
        if (this.props.show) {
            console.log("Enter pushed in modal");
            this.sendMessage({event: 'accept'});
        }
    }

    onEscapeKey(event){
        if(this.props.show) {
            console.log("Escape pushed in modal");
            this.sendMessage({event: 'close'});
        }
    }
}

Modal.propTypes = {
    show: {
        type: PropTypes.boolean,
        description: "Whether or not the Modal should be displayed"
    }
};

export {Modal, Modal as default}
