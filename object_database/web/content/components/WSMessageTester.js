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
                }, [this.initialText]),
                h("div", {
                    "data-cell-id": this.props.id + "-display",
                    "data-cell-type": "WSTesterDisplayAdditional",
                }, [""])
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
            if (dataInfo.event === "WSTest"){
                let method = dataInfo["method"];
                let newText = null;
                let additionalText = null;
                // if dataInfo has a "method" key we display information about
                // the method run.
                if (method){
                    let methodDict = this._parseMethodString(method);
                    let args = dataInfo["args"];
                    newText = `I just ran ${methodDict.cell}.${methodDict.method} (cellId=${methodDict.id}) with args ${JSON.stringify(args)}`;
                    additionalText = `Method raw string: ${method}`;
                } else {
                    // otherwise we display the raw message that was sent along
                    newText = `I just sent the following message: ${JSON.stringify(dataInfo)}`;
                }
                let display = this.getDOMElement().querySelector("[data-cell-type='WSTesterDisplay']")
                let displayAdditional = this.getDOMElement().querySelector("[data-cell-type='WSTesterDisplayAdditional']")
                display.textContent = newText;
                displayAdditional.textContent = additionalText;

                // send back confirmation of what I receieved
                let responseData = {
                    event: 'WSTestCallback',
                    'target_cell': this.props.id,
                    messageReceived: dataInfo
                };

                cellSocket.sendString(JSON.stringify(responseData));
            }
        })
    }

    /* I parse out some useful information from the method string.*/
    _parseMethodString(method){
        let id = method.match(/id=(\d+)/)[1];
        let cellBoundMethod = method.match(/method ([A-Za-z\.]+) /)[1];
        let cellName = null;
        let methodName = null;
        if (cellBoundMethod){
            cellBoundMethod = cellBoundMethod.split('.');
            cellName = cellBoundMethod[0];
            methodName = cellBoundMethod[1];
        }
        return {id: id, cell: cellName, method: methodName}
    }
}

WSMessageTester.propTypes = {
};

export {WSMessageTester, WSMessageTester as default};
