/**
 * Popover Cell Cell
 */

import {makeDomElt as h} from './Cell';
import {DropdownBase} from './Dropdown';

/**
 * About Named Children
 * --------------------
 * `content` (single) - The content of the popover
 * `detail` (single) - Detail of the popover
 * `title` (single) - The title for the popover
 */
class Popover extends DropdownBase {
    constructor(props, ...args){
        super(props, ...args);
    }

    build(){
        this.clearVisibleDropdown();

        this.dropdownToggle = h('div',
            {
                class: "btn btn-xs",
                "data-cell-type": 'Popover',
                onclick: this.dropdownClicked
            },
            [
                this.renderChildNamed('content')
            ]
        );

        return this.dropdownToggle;
    }

    onDropdownOpened() {
        this.sendMessage({open_state: true});
    }

    onDropdownClosed() {
        this.sendMessage({open_state: false});
    }

    makeOpenDropdownMenu(styleAndOpenAbove) {
        let children = [];

        if (this.namedChildren.title) {
            children.push(
                h("div", {class: "cell-popover-title"}, [this.renderChildNamed('title')])
            );
        }

        if (this.namedChildren.detail) {
            children.push(
                h("div", {class: "cell-popover-detail"}, [
                    h("div", {style: "width: " + this.props.width + "px"}, [
                        this.renderChildNamed('detail')
                    ])
                ])
            );
        }

        let openMenu = h("div",
            {'class': 'cell-open-popover'},
            children
        );

        let arrowOnRight = styleAndOpenAbove.isAnchoredOnRightSide;

        if (styleAndOpenAbove.isOpenAbove) {
            return h("div", {}, [
                openMenu,
                h("div", {class: 'cell-popover-arrow-holder' + (arrowOnRight ? "-right" : "")}, [
                    h("div", {class: 'cell-popover-down-arrow'}, []),
                    h("div", {class: 'cell-popover-down-arrow-small'}, [])
                ])
            ]);
        } else {
            return h("div", {}, [
                h("div", {class: 'cell-popover-arrow-holder' + (arrowOnRight ? "-right" : "")}, [
                    h("div", {class: 'cell-popover-up-arrow'}, []),
                    h("div", {class: 'cell-popover-up-arrow-small'}, [])
                ]),
                openMenu,
            ]);
        }

    }
}

export {Popover, Popover as default};
