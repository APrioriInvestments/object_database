/**
 * _NavTab Cell Cell
 * NOTE: This should probably just be
 * rolled into the Nav Cell somehow,
 * or included in its module as a private
 * subCell.
 */

import {makeDomElt as h} from './Cell';
import {ConcreteCell} from './ConcreteCell';

/**
 * About Named Children
 * --------------------
 * `child` (single) - The cell inside of the navigation tab
 */
class _NavTab extends ConcreteCell {
    constructor(props, ...args){
        super(props, ...args);

        // Bind context to methods
        this.makeChild = this.makeChild.bind(this);
        this.clickHandler = this.clickHandler.bind(this);
        this.innerElement = null;
    }

    build(){
        let innerClass = "nav-link";
        if(this.props.isActive){
            innerClass += " active";
        }

        this.innerElement = h('a', {
            class: innerClass,
            role: "tab",
            onclick: this.clickHandler
        }, [this.makeChild()]);

        return (
            h('li', {
                id: this.getElementId(),
                class: "nav-item",
                "data-cell-id": this.identity,
                "data-cell-type": "_NavTab"
            }, [this.innerElement])
        );
    }

    rebuildDomElement() {
        if (this.props.isActive) {
            this.innerElement.classList.add('active')
        } else {
            this.innerElement.classList.remove('active')
        }
    }

    makeChild(){
        return this.renderChildNamed('child');
    }

    clickHandler(event){
        this.sendMessage({})
    }
}

export {_NavTab, _NavTab as default};
