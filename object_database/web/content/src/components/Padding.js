/**
 * Padding Cell Cell
 */

import {makeDomElt as h} from './Cell';
import {StylingCell} from './StylingCell';

class Padding extends StylingCell {
    constructor(props, ...args){
        super(props, ...args);
    }

    getStyle() {
        let s = [];

        if (this.props.left) {
            s.push(`padding-left:${this.props.left}px`)
        }
        if (this.props.right) {
            s.push(`padding-right:${this.props.right}px`)
        }
        if (this.props.bottom) {
            s.push(`padding-bottom:${this.props.bottom}px`)
        }
        if (this.props.top) {
            s.push(`padding-top:${this.props.top}px`)
        }

        return s.join(';')
    }
}

export {Padding, Padding as default};
