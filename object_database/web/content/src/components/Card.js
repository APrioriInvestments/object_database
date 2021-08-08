/**
 * Card Cell Cell
 */

import {makeDomElt as h} from './Cell';
import {ConcreteCell} from './ConcreteCell';

/**
 * About Named Children
 * `body` (single) - The cell to put in the body of the Card
 * `header` (single) - An optional header cell to put above
 *        body
 */
class Card extends ConcreteCell {
    constructor(props, ...args){
        super(props, ...args);

        // Bind Cell methods
        this.makeBody = this.makeBody.bind(this);
        this.makeHeader = this.makeHeader.bind(this);

        this.bodyElement = null;
        this.headerElement = null;
    }

    build(){
        let bodyClass = "cells-card-body allow-child-to-fill-space";

        let sp = this._computeFillSpacePreferences();

        if (this.props.padding) {
            bodyClass += ` p-${this.props.padding}`;
        } else {
            bodyClass += ` p-2`;
        }

        if (sp.horizontal) {
            bodyClass += ' fill-space-horizontal';
        }

        if (sp.vertical) {
            bodyClass += ' fill-space-vertical';
        }

        let body = this.makeBody();

        this.bodyElement = h('div', {
            class: bodyClass
        }, [body]);

        let header = this.makeHeader();

        this.headerElement = null;

        let headerClass = "cells-card-header";

        if (sp.horizontal) {
            headerClass += " fill-space-horizontal";
        }

        if (header) {
            this.headerElement = h('div', {class: headerClass}, [header]);
        }

        let res = h('div',
            {
                class: "cell cells-card sequence-vertical",
                id: this.getElementId(),
                "data-cell-id": this.identity,
                "data-cell-type": "Card"
            },
            [this.headerElement, this.bodyElement]
        );

        return res;
    }

    onOwnSpacePrefsChanged() {
        this.applySpacePreferencesToClassList(this.domElement);
        this.applySpacePreferencesToClassList(this.bodyElement);

        let sp = this.getFillSpacePreferences();

        if (this.headerElement) {
            if (sp.horizontal) {
                this.headerElement.classList.add('fill-space-horizontal');
            } else {
                this.headerElement.classList.remove('fill-space-horizontal');
            }
        }
    }

    allotedSpaceIsInfinite(child) {
        if (child !== this.namedChildren['body']) {
            return {horizontal: false, vertical: false};
        }

        return this.parent.allotedSpaceIsInfinite(this);
    }

    _computeFillSpacePreferences() {
        return this.namedChildren['body'].getFillSpacePreferences();
    }

    makeBody(){
        return this.renderChildNamed('body');
    }

    makeHeader(){
        return this.renderChildNamed('header');
    }
}

export {Card, Card as default};
