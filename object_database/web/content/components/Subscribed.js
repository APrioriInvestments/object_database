/**
 * Subscribed Cell Component
 * -------------------------
 */
import {Component, render} from './Component';
import {PropTypes} from './util/PropertyValidator';
import {h} from 'maquette';


/**
 * About Named Children
 * ---------------------
 * `content` (single) - The Subscribed content
 */
class Subscribed extends Component {
    constructor(props, ...args){
        super(props, ...args);
        this.isSubscribed = true;

        // Bind component methods
        this.renderContent = this.renderContent.bind(this);
    }

    build(){
        if(this.contentIsEmpty){
            // There is no content to display,
            // so we render the placeholder
            // that will not be displayed in
            // layouts
            console.log(`Building ${this.props.id} using placeholder`);
            return(
                h('div', {
                    id: this.props.id,
                    'data-cell-id': this.props.id,
                    'data-cell-type': "Subscribed",
                    'class': 'cell subscribed',
                    'style': 'display:none;'
                }, [])
             );
        } else {
            console.log(`Building ${this.props.id} using child content`);
            // There is valid child content,
            // so we render that by proxy
            // with a reference data attribute
            let velement = this.renderContent();
            velement.properties['data-subscribed-to'] = this.props.id;
            return velement;
        }
    }

    getDOMElement(){
        // Override the normal behavior.
        // Here we return the element that is
        // being subscribed to, if present.
        // Otherwise we return the placeholder
        // element.
        let subscribedTo = `[data-subscribed-to="${this.props.id}"]`;
        let subscribedToEl = document.querySelector(subscribedTo);
        if(subscribedToEl){
            return subscribedToEl;
        } else {
            return document.querySelector(`[data-cell-id="${this.props.id}"]`);
        }
    }

    renderContent(){
        // Return the rendered velement of
        // the child content, if present.
        let content = this.props.namedChildren.content;
        if(content){
            content.numRenders += 1;
            return content.render();
        } else {
            return null;
        }
    }

    get contentIsEmpty(){
        // Return true only if the
        // child content is undefined, null,
        // or otherwise empty.
        if(this.props.namedChildren.content){
            return false;
        }
        return true;
    }
}

export {
    Subscribed,
    Subscribed as default
};
