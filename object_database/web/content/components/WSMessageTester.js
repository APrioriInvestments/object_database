/**
 * Button Cell Component
 */

import {Component} from './Component';
import {PropTypes} from './util/PropertyValidator';
import {h} from 'maquette';

/**
 * About Named Children
 * ---------------------
 * `content` (single) - The cell inside of the button (if any)
 */
class WSMessageTester extends Component {
    constructor(props, ...args){
        super(props, ...args);

        // Bind context to methods
        this.makeContent = this.makeContent.bind(this);
        this.handleClick = this.handleClick.bind(this);
    }

    build(){
        return(
            h('button', {
                id: this.getElementId(),
                "data-cell-id": this.props.id,
                "data-cell-type": "Button",
                class: "btn btn-primary",
                onclick: this.handleClick
            }, [this.makeContent()]
             )
        );
    }

    makeContent(){
        return this.renderChildNamed('content');
    }

    handleClick(){
        let responseData = {
            event: 'click',
            'target_cell': this.props.id,
        };

        cellSocket.sendString(JSON.stringify(responseData));
    }
}

WSMessageTester.propTypes = {
};

export {WSMessageTester, WSMessageTester as default};
