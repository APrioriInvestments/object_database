/**
 * Badge Cell Cell
 */
import {makeDomElt as h} from './Cell';
import {ConcreteCell} from './ConcreteCell';

/**
 * About Named Children
 * --------------------
 * `inner` - The concent cell of the Badge
 */
class Badge extends ConcreteCell {
    constructor(props, ...args){
        super(props, ...args);

        // Bind Cell methods
        this.makeInner = this.makeInner.bind(this);
    }

    build() {
        return(
            h('span', {
                class: `cell badge badge-${this.props.badgeStyle}`,
                id: this.getElementId(),
                "data-cell-id": this.identity,
                "data-cell-type": "Badge"
            }, [this.renderChildNamed('inner')])
        );
    }
}

export {Badge, Badge as default};
