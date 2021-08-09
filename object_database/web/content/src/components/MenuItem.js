/**
 * Button Cell Cell
 */

import {makeDomElt as h} from './Cell';
import {ConcreteCell} from './ConcreteCell';

/**
 * About Named Children
 * ---------------------
 * `content` (single) - The cell inside of the button (if any)
 */
class MenuItem extends ConcreteCell {
    constructor(props, ...args){
        super(props, ...args);

        // Bind context to methods
        this.onClick = this.onClick.bind(this);
    }

    _computeFillSpacePreferences() {
        return this.namedChildren['content'].getFillSpacePreferences();
    }

    build() {
        let res = h(
            'div',
            {
                'class': 'allow-child-to-fill-space cell-menu-item',
                onclick: this.onClick
            },
            [this.renderChildNamed('content')]
        );

        this.applySpacePreferencesToClassList(res);

        return res;
    }

    onClick() {
        this.sendMessage({'event': 'click'});
    }
}

export {MenuItem, MenuItem as default};
