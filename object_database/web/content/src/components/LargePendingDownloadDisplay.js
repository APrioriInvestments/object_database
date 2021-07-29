/**
 * LargePendingDownloadDisplay Cell Cell
 */

import {makeDomElt as h} from './Cell';
import {ConcreteCell} from './ConcreteCell';


class LargePendingDownloadDisplay extends ConcreteCell {
    constructor(props, ...args){
        super(props, ...args);
    }

    build(){
        return (
            h('div', {
                id: 'object_database_large_pending_download_text',
                "data-cell-id": this.identity,
                "data-cell-type": "LargePendingDownloadDisplay",
                class: "cell"
            })
        );
    }
}

export {LargePendingDownloadDisplay, LargePendingDownloadDisplay as default};
