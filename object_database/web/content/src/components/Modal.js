/**
 * Modal Cell Cell
 */

import {makeDomElt as h} from './Cell';
import {ConcreteCell} from './ConcreteCell';
import {KeyListener} from './util/KeyListener';
import {KeyBinding} from './util/KeyListener';

/**
 * About Named Children
 * --------------------
 * `title` (single) - A Cell containing the title
 * `message` (single) - A Cell contianing the body of the
 *     modal message
 * `buttons` (array) - An array of button cells
 */
class Modal extends ConcreteCell {
    constructor(props, ...args){
        super(props, ...args);
        // Track the Cell show/hide
        // state outside of the props
        // for callback purposes
        // note that when we are first created, we are not yet showing, because
        // we have not installed callbacks etc.
        this.isShowing = false;

        // Bind Cell methods
        this.makeHeader = this.makeHeader.bind(this);
        this.makeBody = this.makeBody.bind(this);
        this.makeFooter = this.makeFooter.bind(this);
        this.makeClasses = this.makeClasses.bind(this);
        this.onShow = this.onShow.bind(this);
        this.onHide = this.onHide.bind(this);
        this.onEnterKey = this.onEnterKey.bind(this);
        this.onEscapeKey = this.onEscapeKey.bind(this);

        // listener for keydown events
        // Note these are defined **after** `this` is bound to the Cell methods
        let enterBinding = new KeyBinding("Enter", this.onEnterKey, true, false, true);
        let escapeBinging = new KeyBinding("Escape", this.onEscapeKey, true, false, true);
        this.keyListener = new KeyListener(document, [enterBinding, escapeBinging]);

    }

    onFirstInstalled(){
        if(!this.isShowing && this.props.show){
            // Then we have "shown" the Modal now.
            // Call onShow method
            this.onShow();
        }
        this.isShowing = this.props.show;
    }

    rebuildDomElement() {
        if(!this.isShowing && this.props.show){
            // In this case, we have gone from
            // hidden to showing, so call
            // onShow
            this.onShow();
            this.domElement.classList.add('modal-cell-show')
        }
        if(this.isShowing && !this.props.show){
            // In this case we have gone from
            // showing to hiding, so call
            // onHide
            this.onHide();
            this.domElement.classList.remove('modal-cell-show')
        }

        this.isShowing = this.props.show;
    }

    cellWillReceiveProps(oldProps, newProps){
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

    cellWillUnload(){
        this.onHide();
    }

    build(){
        return (
            h('div', {
                id: this.getElementId(),
                'data-cell-id': this.identity,
                'data-cell-type': "Modal",
                class: this.makeClasses(),
                tabindex: "-1",
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
            return h('h5', {class: "modal-title", id: `${this.identity}-modalTitle`}, [
                title
            ]);
        }
        return null;
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
            document.activeElement.blur();
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

export {Modal, Modal as default}
