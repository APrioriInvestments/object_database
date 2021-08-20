/**
 * AsyncDropdown Cell Cell
 */

import {makeDomElt as h} from './Cell';
import {DropdownBase} from './Dropdown';

class DropdownDrawer extends DropdownBase {
    constructor(props, ...args){
        super(props, ...args);
    }

    build(){
        // if the dropdown exists already, just remove it
        this.clearVisibleDropdown();

        if (this.props.withoutButtonStyling) {
            this.dropdownToggle = (
                h('div', {
                    id: this.getElementId(),
                    "data-cell-id": this.identity,
                    "data-cell-type": "Dropdown",
                    class: "cell cell-dropdown dropdown",
                    style: 'display:inline-block',
                    onclick: this.dropdownClicked
                }, [
                    this.renderChildNamed('menu')
                ])
            );

            return this.dropdownToggle;

        } else {
            this.dropdownToggle = h('button', {
                class: "btn btn-xs btn-outline-secondary dropdown-toggle dropdown-toggle-split",
                type: "button",
                onclick: this.dropdownClicked
            });

            return (
                h('div', {
                    id: this.getElementId(),
                    "data-cell-id": this.identity,
                    "data-cell-type": "Dropdown",
                    class: "cell cell-dropdown dropdown btn-group",
                }, [
                    h('a', {class: "btn btn-xs btn-outline-secondary"}, [
                        this.renderChildNamed('menu')
                    ]),
                    this.dropdownToggle
                ])
            );
        }
    }

    onDropdownOpened() {
        this.dropdownToggle.classList.add('active');
        this.sendMessage({open_state: true});
    }

    onDropdownClosed() {
        this.dropdownToggle.classList.remove('active');
        this.sendMessage({open_state: false});
    }

    makeOpenDropdownMenu(styleAndOpenAbove) {
        return h('div', {
            'class': 'cell-open-dropdown-drawer',
            'style': styleAndOpenAbove.style
            },
            [this.renderChildNamed('content')]
        );
    }
}

export {DropdownDrawer, DropdownDrawer as default};
