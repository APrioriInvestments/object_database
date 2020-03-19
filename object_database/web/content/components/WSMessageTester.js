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

        this.initialText = "Click the button to run the method."

        // Bind context to methods
        this.makeContent = this.makeContent.bind(this);
        this.handleClick = this.handleClick.bind(this);
    }

    build(){
        return(
            h("div", {
                id: this.getElementId(),
                "data-cell-id": this.props.id,
                "data-cell-type": "WSTestter",
            }, [
                h('button', {
                    "data-cell-id": this.props.id + "-button",
                    "data-cell-type": "WSTesterButton",
                    class: "btn btn-primary",
                    onclick: this.handleClick
                }, [this.makeContent()]
                ),
                h("div", {
                    "data-cell-id": this.props.id + "-display",
                    "data-cell-type": "WSTesterDisplay",
                }, [this.initialText])
            ])
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

    /* I handle incoming WS message data updating.
     */
    _updateData(dataInfos, projector) {
        dataInfos.map((dataInfo) => {
            if (dataInfo.message === "WSTest"){
                let method = dataInfo["method"];
                let args = dataInfo["args"];
                let newText = "I just ran " + method + " with " + JSON.stringify(args);
                let display = this.getDOMElement().querySelector("[data-cell-type='WSTesterDisplay']")
                display.textContent = newText;
            }
        })
    }
}

WSMessageTester.propTypes = {
};

export {WSMessageTester, WSMessageTester as default};
