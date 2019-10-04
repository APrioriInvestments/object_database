/**
 * Modal Cell Component
 */

import {Component} from './Component';
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

        // Bind component methods
        this.makeHeader = this.makeHeader.bind(this);
        this.makeBody = this.makeBody.bind(this);
        this.makeFooter = this.makeFooter.bind(this);
        this.makeClasses = this.makeClasses.bind(this);
    }

    build(){
        return (
            h('div', {
                id: this.props.id,
                'data-cell-id': this.props.id,
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
            return h('h5', {class: "modal-title", id: `${this.props.id}-modalTitle`}, [
                title
            ]);
        }
        return null;
    }
}

export {Modal, Modal as default}
