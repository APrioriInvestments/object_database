/**
 * LoadContentsFromUrl Cell Component
 */

import {Component} from './Component';
import {h} from 'maquette';

class LoadContentsFromUrl extends Component {
    constructor(props, ...args){
        super(props, ...args);
    }

    build(){
        return(
            h('div', {
                id: this.getElementId(),
                "data-cell-id": this.props.id,
                "data-cell-type": "LoadContentsFromUrl",
            }, [h('div', {id: this.props['loadTargetId']}, [])]
            )
        );
    }

}

export {LoadContentsFromUrl, LoadContentsFromUrl as default};
