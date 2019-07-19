/**
 * Sequence Cell Component
 */

import {Component} from './Component';
import {PropTypes} from './util/PropertyValidator';
import {h} from 'maquette';

/**
 * About Named Children
 * --------------------
 * `elements` (array) - A list of Cells that are in the
 *    sequence.
 */
class Sequence extends Component {
    constructor(props, ...args){
        super(props, ...args);

        // Bind component methods
        //this.makeStyle = this.makeStyle.bind(this);
        this.makeClasses = this.makeClasses.bind(this);
        this.makeElements = this.makeElements.bind(this);
    }

    build(){
        return (
            h('div', {
                id: this.props.id,
                class: this.makeClasses(),
                "data-cell-id": this.props.id,
                "data-cell-type": "Sequence",
                //style: this.makeStyle()
            }, this.makeElements())
        );
    }

    makeElements(){
        let elements = this.props.namedChildren['elements'];
        return elements.map(childComponent => {
            let hyperscript = render(childComponent);
            if(childComponent.props.flexChild == true && this.props.flexParent){
                hyperscript.properties.class += " flex-child";
            }
            return hyperscript;
        });
    }

    makeClasses(){
        let classes = ["cell sequence sequence-vertical"];
        if(this.props.flexParent){
            classes.push("flex-parent");
        }
        if (this.props.margin){
            classes.push(`child-margin-${this.props.margin}`);
        }
        return classes.join(" ");
    }

    makeClasses(){
        let classes = ["cell sequence sequence-vertical"];
        if(this.props.overflow){
            classes.push("overflow");
        }
        return classes.join(" ");
    }

    /*makeStyle(){
        // Note: the server side uses "split" (axis) to denote the direction
        let direction = "row";
        if (this.props.split == "horizontal"){
            direction = "column";
        }
        let overflow = ""
        if (this.props.overflow) {
            overflow = "overflow:auto"
        }
        return `width:100%;height:100%;display:inline-flex;flex-direction:${direction};${overflow}`;
        }*/
}

Sequence.propTypes = {
    split: {
        description: "Horizontal/vertical layout of the children.",
        type: PropTypes.string
    },
    overflow: {
        description: "Overflow-auto.",
        type: PropTypes.boolean
    }
};

export {Sequence, Sequence as default};
