/**
 * Subscribed Cell Component
 */

import {Component} from './Component';
import {h} from 'maquette';

/**
 * About Named Children
 * --------------------
 * `content` (single) - The underlying Cell that is subscribed
 */
class Subscribed extends Component {
    constructor(props, ...args){
        super(props, ...args);

        // Responds true
        this.isSubscribed = true;
        this.previoudChildId = null;

        // Bind component methods
        this.makeContent = this.makeContent.bind(this);
    }

    build(){
        let velement = this.makeContent();
        velement.properties['data-subscribed-to'] = this.props.id;
        return velement;
    }

    getDOMElement(){
        // Sometimes you can have a Subscribed in another Subscribed,
        // which can really throw off the whole "non-display"
        // rendering process. So, as long as the parent of this
        // instance isn't a Subscribed, we do a basic lookup.
        // Otherwise, call the same method on the parent.
        let el = document.querySelector(`[data-subscribed-to="${this.props.id}"]`);
        if(el){
            return el;
        } else if(this.parent && this.parent.name == "Subscribed"){
            return this.parent.getDOMElement();
        }
        return null;
    }

    getDOMElement(){
        // Sometimes you can have a Subscribed in another Subscribed,
        // which can really throw off the whole "non-display"
        // rendering process. So, as long as the parent of this
        // instance isn't a Subscribed, we do a basic lookup.
        // Otherwise, call the same method on the parent.
        let el = document.querySelector(`[data-subscribed-to="${this.props.id}"]`);
        if(el){
            return el;
        } else if(this.parent && this.parent.name == "Subscribed"){
            return this.parent.getDOMElement();
        }
        return null;
    }

    makeContent(){
        return this.renderChildNamed('content');
    }
}

export {Subscribed, Subscribed as default};
