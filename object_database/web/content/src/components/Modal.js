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

        this.installedDiv = null;

        // Note these are defined **after** `this` is bound to the Cell methods
        let enterBinding = new KeyBinding(
            "Enter",
            (event) => {
                this.sendMessage({'event': 'enter'})
            },
            true, false, true
        );
        let escapeBinging = new KeyBinding(
            "Escape",
            (event) => {
                this.sendMessage({'event': 'esc'})
            },
            true, false, true
        );

        this.keyListener = new KeyListener(document, [enterBinding, escapeBinging]);
        this.keyListener.start();
    }

    build() {
        return h('div', {'style': 'display:none'}, []);
    }

    allotedSpaceIsInfinite(child) {
        return {horizontal: false, vertical: false}
    }

    _computeFillSpacePreferences() {
        return {horizontal: false, vertical: false}
    }

    onFirstInstalled() {
        let children = [];

        if (this.namedChildren['header']) {
            children.push(
                h('div', {class: "modal-header"}, [this.renderChildNamed('header')])
            );
        }

        if (this.namedChildren['body']) {
            children.push(
                h('div', {class: "modal-body"}, [this.renderChildNamed('body')])
            );
        }

        if (this.namedChildren['footer']) {
            children.push(
                h('div', {class: "modal-footer"}, [this.renderChildNamed('footer')])
            );
        }

        this.installedDiv = h('div',
            {
                'class': 'cell modal-cell modal-cell-show',
            },
            [
                h(
                    'div',
                    {'class': 'modal-dialog',
                        'onkeydown': this.onKeyDown
                    },
                    [
                        h('div', {'class': 'modal-content'}, children)
                    ]
                )
            ]

        );

        document.body.appendChild(this.installedDiv);
    }

    cellWillUnload() {
        this.keyListener.pause();

        if (this.installedDiv) {
            document.body.removeChild(this.installedDiv);
            this.installedDiv = null;
        }
    }
}

export {Modal, Modal as default}
