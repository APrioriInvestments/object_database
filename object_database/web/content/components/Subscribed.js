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
        return([
            h('div', {
                id: this.props.id,
                'data-cell-id': this.props.id,
                'data-cell-type': "Subscribed",
                'class': 'cell subscribed',
                'style': 'display:none;'
            }, []),
            this.renderContent()
        ]);
    }

    render(){
        // Override default behavior to that
        // we render each element in the array
        // that was built
        let built = this.build();
        let subVElement = built[0];
        let contentVElement = built[1];

        // See if the Subscribed itself
        // has a parent that is Subscribed
        if(this.parent && this.parent.isSubsribed){
            contentVElement.properties['data-subscribed-to'] = this.props.id.toString();
        }

        // All component that have a flexChild
        // property should add that class to their
        // root displayed hyperscript css
        if(this.props.flexChild){
            contentVElement.properties.class += " flex-child";
        }

        // Here we would add any custom inline styles,
        // but this should not really happen to Subscribeds.

        // Add any custom queryTag that should be added as
        // a data-attribute
        if(this.props.queryTag){
            subVElement.properties['data-tag'] = this.props.queryTag.toString();
        }

        return [contentVElement, subVElement];
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
}

export {
    Subscribed,
    Subscribed as default
};
