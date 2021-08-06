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
        this.clearVisibleDropdown = this.clearVisibleDropdown.bind(this);
        this.computeDropdownStyleFromTogglePosition = this.computeDropdownStyleFromTogglePosition.bind(this);

        this.visibleDropdownMenu = null;
        this.openDropdownMenu = null;

        this.dropdownClicked = this.dropdownClicked.bind(this);
        this.onKeyDown = this.onKeyDown.bind(this);
    }

    onKeyDown(event) {
        if (event.which == 27) {
            this.clearVisibleDropdown();
            event.preventDefault();
            event.stopPropagation();
        }
    }

    clearVisibleDropdown() {
        if (this.visibleDropdownMenu) {
            this.visibleDropdownMenu.remove();

            this.visibleDropdownMenu = null;
            this.openDropdownMenu = null;
            this.dropdownBackdrop = null;
        }
    }

    cellWillUnload() {
        this.clearVisibleDropdown();
    }

    computeDropdownStyleFromTogglePosition() {
        let curBoundingRect = this.dropdownToggle.getBoundingClientRect();
        let totalBoundingRect = document.body.getBoundingClientRect();

        let styles = [];

        styles.push('position: absolute');

        if (curBoundingRect.right > totalBoundingRect.width * .66) {
            styles.push(`right:${totalBoundingRect.right - curBoundingRect.right}px`);
        } else {
            styles.push(`left:${curBoundingRect.left}px`);
        }

        if (curBoundingRect.top > totalBoundingRect.height * .66) {
            styles.push(`bottom:${totalBoundingRect.bottom - curBoundingRect.top}px`);

            let maxHeight = Math.min(
                (totalBoundingRect.height - curBoundingRect.top) - 10,
                totalBoundingRect.height / 2
            );
            styles.push(`max-height:${maxHeight}px`);

        } else {
            styles.push(`top:${curBoundingRect.bottom}px`);

            let maxHeight = Math.min(
                (totalBoundingRect.height - curBoundingRect.bottom) - 10,
                totalBoundingRect.height / 2
            );
            styles.push(`max-height:${maxHeight}px`);
        }

        return styles.join(";");
    }

    dropdownClicked() {
        this.clearVisibleDropdown();

        // open the dropdown
        let style = this.computeDropdownStyleFromTogglePosition();

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

        this.openDropdownMenu = h('div', {
            'class': 'cell-open-dropdown-menu',
            'style': style
            },
            this.makeItems()
        );

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
                this.openDropdownMenu.setAttribute('style', this.computeDropdownStyleFromTogglePosition())
            }
        });

        observer.observe(this.domElement);
        observer.observe(this.dropdownBackdrop);
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
                    this.makeTitle()
                ]),
                this.dropdownToggle
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
                    this.clearVisibleDropdown();
                };

                return h('a', {
                    class: "cell-dropdown-item",
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
