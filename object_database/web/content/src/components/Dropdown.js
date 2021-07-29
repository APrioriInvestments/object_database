/**
 * Dropdown Cell Cell
 */

import {makeDomElt as h} from './Cell';
import {ConcreteCell} from './ConcreteCell';

/**
 * About Named Children
 * --------------------
 * `title` (single) - A Cell that will comprise the title of
 *      the dropdown
 * `dropdownItems` (array) - An array of cells that are
 *      the items in the dropdown
 */
class Dropdown extends ConcreteCell {
    constructor(props, ...args){
        super(props, ...args);

        // Bind context to methods
        this.makeTitle = this.makeTitle.bind(this);
        this.makeItems = this.makeItems.bind(this);
    }

    build(){
        return (
            h('div', {
                id: this.getElementId(),
                "data-cell-id": this.identity,
                "data-cell-type": "Dropdown",
                class: "cell cell-dropdown dropdown btn-group",
            }, [
                h('a', {class: "btn btn-xs btn-outline-secondary"}, [
                    this.makeTitle()
                ]),
                h('button', {
                    class: "btn btn-xs btn-outline-secondary dropdown-toggle dropdown-toggle-split",
                    type: "button",
                    id: `${this.props.targetIdentity}-dropdownMenuButton`,
                    "data-toggle": "dropdown"
                }),
                h('div', {class: "dropdown-menu"}, this.makeItems())
            ])
        );
    }

    handleMessages(messages) {
        messages.forEach(msg => {
            if (msg.action == 'redirect') {
                if (msg.target) {
                    window.open(msg.url, msg.target);
                } else {
                    window.location.href = msg.url;
                }
            }
        });
    }

    makeTitle(){
        return this.renderChildNamed('title');
    }

    makeItems(){
        if (this.namedChildren.dropdownItems) {
            let renderedItems = this.renderChildrenNamed('dropdownItems');

            return renderedItems.map((itemDom, idx) => {
                let clickHandler = (event) => {
                    this.sendMessage({event: 'menu', ix: idx});
                };

                return h('a', {
                    class: "subcell cell-dropdown-item dropdown-item",
                    key: this.index,
                    onclick: clickHandler
                }, [itemDom]);
            });
        } else {
            return [];
        }
    }
}

export {Dropdown, Dropdown as default};
