/**
 * Plot Cell Component
 */

import {Component} from './Component';
import {h} from 'maquette';

/**
 * About Named Children
 * --------------------
 * `chartUpdater` (single) - The Updater cell
 * `error` (single) - An error cell, if present
 */
class Plot extends Component {
    constructor(props, ...args){
        super(props, ...args);

        // Cache the created DOM node
        // for later use
        this._cachedDOMNode = null;

        // Bind component methods
        this.setupPlot = this.setupPlot.bind(this);
        this.makeChartUpdater = this.makeChartUpdater.bind(this);
        this.makeError = this.makeError.bind(this);
    }

    componentDidLoad() {
        this.setupPlot();
        this._cachedDOMNode = this.getDOMElement();
    }

    componentDidUpdate(){
        let placeholder = document.getElementById(`placeholder-${this.props.id}`);
        if(placeholder){
            placeholder.replaceWith(this._cachedDOMNode);
        } else {
            throw new Error(`Could not find replacement element for ${this.name}[${this.props.id}]`);
        }
    }

    build(){
        if(this.hasRenderedBefore){
            return h('div', {
                class: 'cell-placeholder',
                id: `placeholder-${this.props.id}`
            }, []);
        }
        return (
            h('div', {
                id: this.getElementId(),
                "data-cell-id": this.props.id,
                "data-cell-type": "Plot",
                class: "cell"
            }, [
                h('div', {id: `plot${this.props.id}`}),
                this.makeChartUpdater(),
                this.makeError()
            ])
        );
    }

    makeChartUpdater(){
        return this.renderChildNamed('chartUpdater');
    }

    makeError(){
        return this.renderChildNamed('error');
    }


    setupPlot(){
        console.log("calling plot setup")
        // TODO These are global var defined in page.html
        // we should do something about this.
        var ownId = this.props.id;

        var plotDiv = document.getElementById('plot' + this.props.id);
        Plotly.react(
            plotDiv,
            [],
            {
                margin: {t : 30, l: 30, r: 30, b:30 },
                xaxis: {rangeslider: {visible: false}},
            },
            { scrollZoom: true, dragmode: 'pan', displaylogo: false, displayModeBar: 'hover',
                modeBarButtons: [ ['pan2d'], ['zoom2d'], ['zoomIn2d'], ['zoomOut2d'] ],
                //responsive: true
            }
        );
        var onRelayout = function() {
            if (plotDiv.is_server_defined_move === true) {
                return
            }

            if (plotDiv.data.length == 0) {
                return
            }

            plotDiv.lastUpdateTimestamp = Date.now()

            var axes = {
                'xaxis.range[0]': plotDiv.layout.xaxis.range[0],
                'xaxis.range[1]': plotDiv.layout.xaxis.range[1],
                'yaxis.range[0]': plotDiv.layout.yaxis.range[0],
                'yaxis.range[1]': plotDiv.layout.yaxis.range[1],
            }

            //if we're sending a string, then its a date object, and we want to send
            // a timestamp
            if (typeof(axes['xaxis.range[0]']) === 'string') {
                axes = Object.assign({},axes);
                axes["xaxis.range[0]"] = Date.parse(axes["xaxis.range[0]"]) / 1000.0;
                axes["xaxis.range[1]"] = Date.parse(axes["xaxis.range[1]"]) / 1000.0;
            }

            let responseData = {
                'event':'plot_layout',
                'target_cell': ownId,
                'data': axes
            };
            cellSocket.sendString(JSON.stringify(responseData));
        }

        var onRelayouting = function() {
            plotDiv.lastRelayoutingTimestamp = Date.now();
        }

        plotDiv.on('plotly_relayout', onRelayout);
        plotDiv.on('plotly_relayouting', onRelayouting);
        plotDiv.on('plotly_doubleclick', onRelayout);
    }
}

export {Plot, Plot as default};
