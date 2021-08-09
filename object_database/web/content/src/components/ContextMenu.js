/**
 * AsyncDropdown Cell Cell
 */

import {makeDomElt as h} from './Cell';
import {DropdownBase} from './Dropdown';

class ContextMenu extends DropdownBase {
    constructor(props, ...args){
        super(props, ...args);
    }

    _computeFillSpacePreferences() {
        return this.namedChildren['wrappedCell'].getFillSpacePreferences();
    }

    build(){
        // if the dropdown exists already, just remove it
        this.clearVisibleDropdown();

        this.dropdownToggle = h(
            'div',
            {'style': 'position:relative;width:0;height:0;left=0;top=0'},
            []
        );

        this.innerDiv = (
            h('div', {
                id: this.getElementId(),
                "data-cell-id": this.identity,
                "data-cell-type": "ContextMenu",
                'class': 'cell allow-child-to-fill-space',
                oncontextmenu: (e) => {
                    e.preventDefault();

                    // place the 'dropdownToggle' where we clicked
                    let top = e.pageY - this.innerDiv.getBoundingClientRect().top;
                    let left = e.pageX - this.innerDiv.getBoundingClientRect().left;
                    this.dropdownToggle.setAttribute(
                        'style',
                        'position:relative;width:0;height:0;left:' + left + 'px;top:' + top + "px"
                    )

                    // and then open the toggle
                    this.dropdownClicked(e);
                }
            }, [
                this.dropdownToggle,
                this.renderChildNamed('wrappedCell')
            ])
        );

        let res = h(
            'div',
            {'class': 'cell allow-child-to-fill-space'},
            [this.innerDiv]
        );

        this.applySpacePreferencesToClassList(this.innerDiv);
        this.applySpacePreferencesToClassList(res);

        return res;
    }

    onDropdownOpened() {
        this.sendMessage({open_state: true});
    }

    onDropdownClosed() {
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

    handleMessages(messages) {
        messages.forEach(msg => {
            if (msg.action == 'force-close') {
                this.clearVisibleDropdown();
            }
        });
    }
}

export {ContextMenu, ContextMenu as default};
