/**
 * Dropdown Cell Component
 */

import {Component, render} from './Component';
import {h} from 'maquette';

/**
 * About Named Children
 * --------------------
 * `title` (single) - A Cell that will comprise the title of
 *      the dropdown
 * `dropdownItems` (array) - An array of cells that are
 *      the items in the dropdown
 */
class Dropdown extends Component {
    constructor(props, ...args){
        super(props, ...args);

        // Bind context to methods
        this.makeTitle = this.makeTitle.bind(this);
        this.makeItems = this.makeItems.bind(this);
    }

    build(){
        return (
            h('div', {
                id: this.props.id,
                "data-cell-id": this.props.id,
                "data-cell-type": "Dropdown",
                class: "btn-group"
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

    makeTitle(){
        return this.renderChildNamed('title');
    }

    makeItems(){
        if(this.props.namedChildren.dropdownItems){
            return this.props.namedChildren.dropdownItems.map((itemComponent, idx) => {
                // TODO: Clean up instantiation and rendering
                return render(new DropdownItem({
                    id: `${this.props.id}-item-${idx}`,
                    index: idx,
                    childSubstitute: element,
                    targetIdentity: this.props.targetIdentity,
                    dropdownItemInfo: this.props.dropdownItemInfo
                }).render();
            });
        } else {
            if(this.props.namedChildren.dropdownItems){
                return this.props.namedChildren.dropdownItems.map((itemComponent, idx) => {
                    // TODO: Clean up instantiation and rendering
                    return render(new DropdownItem({
                        id: `${this.props.id}-item-${idx}`,
                        index: idx,
                        childSubstitute: itemComponent.render(),
                        targetIdentity: this.props.targetIdentity,
                        dropdownItemInfo: this.props.dropdownItemInfo
                    }));
                });
            } else {
                return [];
            }
        }
    }
}

Dropdown.propTypes = {
    targetIdentity: {
        description: "Cell id of the target that will be sent to server when click is fired",
        type: PropTypes.oneOf([PropTypes.number, PropTypes.string])
    },

    dropdownItemInfo: {
        description: "A dictionary mapping index keys to actions that should be taken for each menu item when selected. Examples include 'callback' to trigger callbacks",
        type: PropTypes.object
    }
};


/**
 * A private subcomponent for each
 * Dropdown menu item. We need this
 * because of how callbacks are handled
 * and because the Cells version doesn't
 * already implement this kind as a separate
 * entity.
 */
class DropdownItem extends Component {
    constructor(props, ...args){
        super(props, ...args);

        // Bind context to methods
        this.clickHandler = this.clickHandler.bind(this);
    }

    build(){
        return (
            h('a', {
                class: "subcell cell-dropdown-item dropdown-item",
                key: this.props.index,
                onclick: this.clickHandler
            }, [this.props.childSubstitute])
        );
    }

    clickHandler(event){
        // This is super hacky because of the
        // current Cell implementation.
        // This whole component structure should be heavily refactored
        // once the Cells side of things starts to change.
        let whatToDo = this.props.dropdownItemInfo[this.props.index.toString()];
        if(whatToDo == 'callback'){
            let responseData = {
                event: "menu",
                ix: this.props.index,
                target_cell: this.props.targetIdentity
            };
            cellSocket.sendString(JSON.stringify(responseData));
        } else {
            window.location.href = whatToDo;
        }
    }
}

DropdownItem.propTypes = {
    targetIdentity: {
        description: "Cell id of the target that will be sent to server when click is fired",
        type: PropTypes.oneOf([PropTypes.number, PropTypes.string])
    },

    dropdownItemInfo: {
        description: "A dictionary mapping index keys to actions that should be taken for each menu item when selected. Examples include 'callback' to trigger callbacks",
        type: PropTypes.object
    },

    index: {
        description: "The index of this item in its parent Dropdown menu",
        type: PropTypes.number,
        isRequired: true
    },

    childSubstitute: {
        description: "A maquette velement representing the menu item to display",
        type: PropTypes.object
    }
};

export {Dropdown, Dropdown as default};
