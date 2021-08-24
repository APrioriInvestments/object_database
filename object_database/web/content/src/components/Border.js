/**
 * Padding Cell Cell
 */

import {makeDomElt as h} from './Cell';
import {StylingCell} from './StylingCell';

class Border extends StylingCell {
    constructor(props, ...args){
        super(props, ...args);
    }

    getStyle() {
        let s = [];

        if (this.props.left) {
            s.push(`border-left:${this.props.left}`)
        }
        if (this.props.right) {
            s.push(`border-right:${this.props.right}`)
        }
        if (this.props.bottom) {
            s.push(`border-bottom:${this.props.bottom}`)
        }
        if (this.props.top) {
            s.push(`border-top:${this.props.top}`)
        }
        if (this.props.radius) {
            s.push(`border-radius:${this.props.radius}`)
        }
        if (this.props.backgroundColor) {
            s.push(`background-color:${this.props.backgroundColor}`)
        }

        return s.join(';')
    }
}

export {Border, Border as default};
