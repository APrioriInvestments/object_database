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
    }

    build(){
        let bodyClass = "card-body";
        if(this.props.padding){
            bodyClass = `card-body p-${this.props.padding}`;
        }
        let bodyArea = h('div', {
            class: bodyClass
        }, [this.makeBody()]);
        let header = this.makeHeader();
        let headerArea = null;
        if(header){
            headerArea = h('div', {class: "card-header"}, [header]);
        }
        return h('div',
            {
                class: "cell card",
                id: this.getElementId(),
                "data-cell-id": this.identity,
                "data-cell-type": "Card"
            }, [headerArea, bodyArea]);
    }

    makeBody(){
        return this.renderChildNamed('body');
    }

    makeHeader(){
        return this.renderChildNamed('header');
    }
}

export {Card, Card as default};
