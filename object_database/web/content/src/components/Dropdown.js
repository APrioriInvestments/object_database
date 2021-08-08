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
class DropdownBase extends ConcreteCell {
    constructor(props, ...args){
        super(props, ...args);

        // Bind context to methods
        this.makeOpenDropdownMenu = this.makeOpenDropdownMenu.bind(this);
        this.clearVisibleDropdown = this.clearVisibleDropdown.bind(this);
        this.computeDropdownStyleFromTogglePosition = this.computeDropdownStyleFromTogglePosition.bind(this);

        // subclasses should populate this with the thing that we want to hang the
        // floating menu on
        this.dropdownToggle = null;

        // the parent div containing the dropdown menu
        this.visibleDropdownMenu = null;

        // the child div containing the actual menu itself
        this.openDropdownMenu = null;

        // the div that floats behind the dropdown to catch extra clicks.
        this.dropdownBackdrop = null;

        this.dropdownClicked = this.dropdownClicked.bind(this);
        this.onKeyDown = this.onKeyDown.bind(this);

        this.onDropdownClosed = this.onDropdownClosed.bind(this);
        this.onDropdownOpened = this.onDropdownOpened.bind(this);
    }

    onDropdownOpened() {

    }

    onDropdownClosed() {

    }

    onKeyDown(event) {
        // subclasses can override to collect keystrokes
    }

    clearVisibleDropdown() {
        if (this.visibleDropdownMenu) {
            this.visibleDropdownMenu.remove();

            this.visibleDropdownMenu = null;
            this.openDropdownMenu = null;
            this.dropdownBackdrop = null;

            this.onDropdownClosed();
        }
    }

    cellWillUnload() {
        this.clearVisibleDropdown();
    }

    computeDropdownStyleFromTogglePosition() {
        let curBoundingRect = this.dropdownToggle.getBoundingClientRect();
        let totalBoundingRect = document.getElementById("page_root").getBoundingClientRect();

        let styles = [];

        styles.push('position: absolute');
        styles.push('z-index: 10');

        if (curBoundingRect.right > totalBoundingRect.width * .66) {
            styles.push(`right:${totalBoundingRect.right - curBoundingRect.right}px`);
        } else {
            styles.push(`left:${curBoundingRect.left}px`);
        }

        let isOpenAbove = false;

        if (curBoundingRect.top > totalBoundingRect.height * .66) {
            // place the floating div above us
            styles.push(`bottom:${totalBoundingRect.bottom - curBoundingRect.top}px`);

            let maxHeight = Math.min(
                curBoundingRect.top - 10,
                totalBoundingRect.height / 2
            );
            styles.push(`max-height:${maxHeight}px`);
            isOpenAbove = true;
        } else {
            styles.push(`top:${curBoundingRect.bottom}px`);

            let maxHeight = Math.min(
                (totalBoundingRect.height - curBoundingRect.bottom) - 10,
                totalBoundingRect.height / 2
            );
            styles.push(`max-height:${maxHeight}px`);
        }

        return {style: styles.join(";"), isOpenAbove: isOpenAbove}
    }

    dropdownClicked() {
        this.clearVisibleDropdown();
        this.onDropdownOpened();

        // open the dropdown
        let styleAndOpenAbove = this.computeDropdownStyleFromTogglePosition();

        this.dropdownBackdrop = h('div', {
            'class': 'cell-dropdown-backdrop',
            onclick: this.clearVisibleDropdown,
        });

        this.dropdownBackdrop.addEventListener(
            'keydown',
            this.onKeyDown,
            {'capture': true}
        );

        this.dropdownBackdrop.setAttribute('tabindex', 0);

        this.openDropdownMenu = this.makeOpenDropdownMenu(styleAndOpenAbove);

        this.visibleDropdownMenu = h('div',
            {},
            [
                this.dropdownBackdrop,
                this.openDropdownMenu,
            ]
        );

        document.body.appendChild(this.visibleDropdownMenu);

        this.dropdownBackdrop.focus();

        // install a resize observer to update our position if we change while the menu is open
        let observer = new ResizeObserver(entries => {
            if (this.openDropdownMenu) {
                let styleAndOpenAbove = this.computeDropdownStyleFromTogglePosition();

                this.openDropdownMenu.setAttribute('style', styleAndOpenAbove.style);
            }
        });

        observer.observe(this.domElement);
        observer.observe(this.dropdownBackdrop);
    }
}


class Dropdown extends DropdownBase {
    constructor(props, ...args){
        super(props, ...args);
    }

    onKeyDown(event) {
        if (event.which == 27) {
            this.clearVisibleDropdown();
            event.preventDefault();
            event.stopPropagation();
        }
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

    build(){
        // if the dropdown exists already, just remove it
        this.clearVisibleDropdown();

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
                    this.renderChildNamed('title')
                ]),
                this.dropdownToggle
            ])
        );
    }

    onDropdownOpened() {
        this.dropdownToggle.classList.add('active');
    }

    onDropdownClosed() {
        this.dropdownToggle.classList.remove('active');
    }

    makeOpenDropdownMenu(styleAndOpenAbove) {
        let items = [];

        if (this.namedChildren.dropdownItems) {
            let renderedItems = this.renderChildrenNamed('dropdownItems');

            items = renderedItems.map((itemDom, idx) => {
                let clickHandler = (event) => {
                    this.sendMessage({event: 'menu', ix: idx});
                    this.clearVisibleDropdown();
                };

                return h('a', {
                    class: "cell-dropdown-item",
                    key: this.index,
                    onclick: clickHandler
                }, [itemDom]);
            });
        }

        return h('div', {
            'class': 'cell-open-dropdown-menu',
            'style': styleAndOpenAbove.style
            },
            items
        );
    }

}

export {Dropdown, DropdownBase, Dropdown as default};
