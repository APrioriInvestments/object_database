/**
 * SubscribedSequence Cell Component
 */

import {Component, render} from './Component';
import {PropTypes} from './util/PropertyValidator';
import {h} from 'maquette';

/**
 * About Named Replacements
 * ------------------------
 * `elements` (array) - An array of Cells that are subscribed
 */
class SubscribedSequence extends Component {
    constructor(props, ...args){
        super(props, ...args);

        // Bind context to methods
        this.makeClass = this.makeClass.bind(this);
        this.makeChildren = this.makeChildren.bind(this);
    }

    build(){
        return h('div',
            {
                class: this.makeClass(),
                id: this.getElementId(),
                "data-cell-id": this.props.id,
                "data-cell-type": "SubscribedSequence"
            }, this.makeChildren()
        );
    }

    makeChildren(){
        let elements = this.props.namedChildren["elements"];
        return elements.map(childComponent => {
            let hyperscript = render(childComponent);
            let childComponentName = childComponent.constructor.name;
            if(childComponent.props.flexChild == true && this.props.flexParent){
                hyperscript.properties.class += " flex-child";
            }
            return hyperscript;
        });
    }

    makeClass() {
        let classes = [
            "cell",
            "sequence",
            "subscribed-sequence"
        ];
        if(this.props.orientation == 'horizontal'){
            classes.push("sequence-horizontal");
        } else {
            classes.push("sequence-vertical");
        }
        if(this.props.flexParent){
            classes.push("flex-parent");
        }
        if(this.props.flexChild){
            classes.push("flex-child");
        }
        return classes.join(" ");
    }
}

SubscribedSequence.propTypes = {
    orientation: {
        description: "Whether it's a vertical or horizontal sequence",
        type: PropTypes.oneOf(['vertical', 'horizontal'])
    }
};

export {SubscribedSequence, SubscribedSequence as default};
