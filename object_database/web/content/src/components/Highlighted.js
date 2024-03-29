/**
 * Highlighted Cell Cell
 */

import {StylingCell} from './StylingCell';

class Highlighted extends StylingCell {
    constructor(props, ...args){
        super(props, ...args);
    }

    getStyle() {
        if (this.props.color) {
            return "background-color:" + this.props.color;
        }
        return "";
    }

    getClass() {
        return "cell-highlighted";
    }
}

export {
    Highlighted,
    Highlighted as default
};
