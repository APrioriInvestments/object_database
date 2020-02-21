/**
 * Button Cell Component
 */

import {Component} from './Component';
import {PropTypes} from './util/PropertyValidator';
import {h} from 'maquette';

/**
 * About Named Children
 * ---------------------
 * `content` (single) - The cell inside of the button (if any)
 */
class Button extends Component {
    constructor(props, ...args){
        super(props, ...args);

        // Bind context to methods
        this.makeContent = this.makeContent.bind(this);
        this._getEvents = this._getEvent.bind(this);
        this._getHTMLClasses = this._getHTMLClasses.bind(this);
    }

    build(){
        return(
            h('button', {
                id: this.getElementId(),
                "data-cell-id": this.props.id,
                "data-cell-type": "Button",
                class: this._getHTMLClasses(),
                onclick: this._getEvent('onclick')
            }, [this.makeContent()]
             )
        );
    }

    makeContent(){
        return this.renderChildNamed('content');
    }

    _getEvent(eventName) {
        return this.props.events[eventName];
    }

    _getHTMLClasses(){
        let classes = ['btn'];
        if(!this.props.active){
            classes.push(`btn-outline-${this.props.style}`);
        }
        if(this.props.style){
            classes.push(`btn-${this.props.style}`);
        }
        if(this.props.small){
            classes.push('btn-xs');
        }
        return classes.join(" ").trim();
    }
}

Button.propTypes = {
    active: {
        description: "Indicates whether or not the Button is active/deactivated",
        type: PropTypes.boolean
    },
    small: {
        description: "Sets the Button to display as a small button. Defaults to false.",
        type: PropTypes.boolean
    },
    style: {
        description: "A Bootstrap name for the button style.",
        type: PropTypes.oneOf([
            'primary',
            'secondary',
            'success',
            'danger',
            'warning',
            'info',
            'light',
            'dark',
            'link'
        ])
    },

    events: {
        description: "A dictionary of event names to arbitrary JS code that should fire on that event",
        type: PropTypes.object
    }
};

export {Button, Button as default};
