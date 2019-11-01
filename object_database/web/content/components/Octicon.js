/**
 * Octicon Cell Component
 */

import {Component} from './Component';
import {PropTypes} from './util/PropertyValidator';
import {h} from 'maquette';

class Octicon extends Component {
    constructor(props, ...args){
        super(props, ...args);
        this.style = "";
        if (this.props.color !== null) {
            this.style = "color:" + this.props.color;
        }

        // Bind context to methods
        this._getHTMLClasses = this._getHTMLClasses.bind(this);
    }

    build(){
        return(
            h('span', {
                class: this._getHTMLClasses(),
                id: this.props.id,
                "data-cell-id": this.props.id,
                "data-cell-type": "Octicon",
                "aria-hidden": true,
                style: this.style
            })
        );
    }

    _getHTMLClasses(){
        let classes = ["cell", "octicon"];
        let octiconTypeClass = `octicon-${this.props.octiconType}`;
        classes.push(octiconTypeClass);
        return classes.join(" ");
    }
}

Octicon.propTypes = {
    octiconType: {
        type: PropTypes.string,
        description: "The name of the octicon to display"
    },
    color: {
        description: "Color of the Octicon",
        type: PropTypes.oneOf([PropTypes.string])
    }
};


export {Octicon, Octicon as default};
