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
            return(
                h('div', {
                    id: this.getElementId(),
                    'data-cell-id': this.props.id,
                    'data-cell-type': "Subscribed",
                    'class': 'cell subscribed',
                    'style': 'display:none;'
                }, [])
             );
        } else {
            // There is valid child content,
            // so we render that by proxy
            // with a reference data attribute
            let velement = this.renderChildNamed('content');
            return velement;
        }
    }

    getDOMElement(){
        // Override the normal behavior.
        // We need to find where the insert
        // any changed content. This can be one
        // of several DOM elements, based on
        // nested Subscribeds and which "thing"
        // (placeholder or content) a given
        // Subscribed is currently displaying.
        // Order of search is as follows:
        // 1. Look for this component's
        // placeholder element and return if present;
        // 2. Look for this component's direct
        // subscribed-to element, and return if present;
        // 3. Get the top SubscribedChain ancestor
        // and call its getDOMElement, which should
        // return something.
        // 4. Throw error.
        let placeholder = document.querySelector(`[data-cell-id="${this.props.id}"]`);
        if(placeholder){
            return placeholder;
        }
        let subscribedToEl = document.querySelector(`[data-subscribed-to="${this.props.id}"]`);
        if(subscribedToEl){
            return subscribedToEl;
        }
        let topAncestor = this.getTopSubscribedAncestor();
        if(topAncestor){
            return topAncestor.getDOMElement();
        }
        throw new Error(`Could not find Element for Subscribed(${this.props.id})`);
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
