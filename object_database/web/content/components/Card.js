/**
 * Card Cell Component
 */

import {Component} from './Component';
import {PropTypes} from './util/PropertyValidator';
import {h} from 'maquette';

/**
 * About Named Children
 * `body` (single) - The cell to put in the body of the Card
 * `header` (single) - An optional header cell to put above
 *        body
 */
class Card extends Component {
    constructor(props, ...args){
        super(props, ...args);

        // Bind component methods
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
                id: this.props.id,
                "data-cell-id": this.props.id,
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

Card.propTypes = {
    padding: {
        description: "Padding weight as defined by Boostrap css classes.",
        type: PropTypes.oneOf([PropTypes.number, PropTypes.string])
    }
};

export {Card, Card as default};
