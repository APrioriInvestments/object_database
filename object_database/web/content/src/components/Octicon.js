/**
 * Octicon Cell Cell
 */


import {makeDomElt as h} from './Cell';
import {ConcreteCell} from './ConcreteCell';

class Octicon extends ConcreteCell {
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
                id: this.getElementId(),
                "data-cell-id": this.identity,
                "data-cell-type": "Octicon",
                "aria-hidden": true,
                "title": (this.props.hoverText || ''),
                style: this.style
            })
        );
    }

    _getHTMLClasses(){
        let classes = ["cell", "octicon"];
        this.props.octiconClasses.forEach(name => {
            classes.push(name);
        });
        return classes.join(" ");
    }
}

export {Octicon, Octicon as default};
