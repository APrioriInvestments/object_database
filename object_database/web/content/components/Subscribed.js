/**
 * Subscribed Cell Component
 * -------------------------
 */
import {Component} from './Component';
import {h} from 'maquette';


/**
 * About Named Children
 * ---------------------
 * `content` (single) - The Subscribed content
 */
class Subscribed extends Component {
    constructor(props, ...args){
        super(props, ...args);
    }

    build(){
        return(
            h('div', {
                id: this.props.id,
                'data-cell-id': this.props.id,
                'data-cell-type': "Subscribed",
                'class': 'cell subscribed'
            }, [this.renderChildNamed('content')])
        );
    }
}

export {
    Subscribed,
    Subscribed as default
};
