/**
 * Clickable Cell Component
 */
import {Component} from './Component';
import {PropTypes} from './util/PropertyValidator';
import {h} from 'maquette';

/**
 * About Named Children
 * --------------------
 * `content` (single) - The cell that can go inside the clickable
 *        component
 */
class Clickable extends Component {
    constructor(props, ...args){
        super(props, ...args);

        // Bind context to methods
        this.makeContent = this.makeContent.bind(this);
        this.getStyle = this.getStyle.bind(this);
        this._getEvent = this._getEvent.bind(this);
    }

    build(){
        return(
            h('div', {
                id: this.getElementId(),
                class: "cell clickable",
                "data-cell-id": this.props.id,
                "data-cell-type": "Clickable",
                onclick: this._getEvent('onclick'),
                style: this.getStyle()
            }, [
                h('div', {}, [this.makeContent()])
            ]
            )
        );
    }

    getStyle(){
        if(this.props.bold){
            return "cursor:pointer;*cursor:hand;font-weight:bold;";
        } else {
            return "";
        }
    }

    makeContent(){
        return this.renderChildNamed('content');
    }

    _getEvent(eventName) {
        return this.props.events[eventName];
    }
}

Clickable.propTypes = {
    bold: {
        description: "Whether to display label text as bold",
        type: PropTypes.boolean
    },
    events: {
        description: "A dictionary of event names to arbitrary JS code that should fire on that event",
        type: PropTypes.object
    }
};

export {Clickable, Clickable as default};
