/**
 * Badge Cell Component
 */
import {Component} from './Component';
import {h} from 'maquette';

/**
 * About Replacements
 * ------------------
 * Badge has a single replacement:
 * * `child`
 */

/**
 * About Named Children
 * --------------------
 * `inner` - The concent cell of the Badge
 */
class Badge extends Component {
    constructor(props, ...args){
        super(props, ...args);

        // Bind component methods
        this.makeInner = this.makeInner.bind(this);
    }

    build(){
        return(
            h('span', {
                class: `cell badge badge-${this.props.badgeStyle}`,
                id: this.props.id,
                "data-cell-id": this.props.id,
                "data-cell-type": "Badge"
            }, [this.makeInner()])
        );
    }

    makeInner(){
        return this.renderChildNamed('inner');
    }
}

export {Badge, Badge as default};
