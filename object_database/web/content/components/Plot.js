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
                id: this.props.id,
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
        // TODO These are global var defined in page.html
        // we should do something about this.
        var plotDiv = document.getElementById('plot' + this.props.id);
        Plotly.plot(
            plotDiv,
            [],
            {
                margin: {t : 30, l: 30, r: 30, b:30 },
                xaxis: {rangeslider: {visible: false}}
            },
            { scrollZoom: true, dragmode: 'pan', displaylogo: false, displayModeBar: 'hover',
                modeBarButtons: [ ['pan2d'], ['zoom2d'], ['zoomIn2d'], ['zoomOut2d'] ] }
        );
        plotDiv.on('plotly_relayout',
            function(eventdata){
                if (plotDiv.is_server_defined_move === true) {
                    return
                }
                //if we're sending a string, then its a date object, and we want to send
                // a timestamp
                if (typeof(eventdata['xaxis.range[0]']) === 'string') {
                    eventdata = Object.assign({},eventdata);
                    eventdata["xaxis.range[0]"] = Date.parse(eventdata["xaxis.range[0]"]) / 1000.0;
                    eventdata["xaxis.range[1]"] = Date.parse(eventdata["xaxis.range[1]"]) / 1000.0;
                }

                let responseData = {
                    'event':'plot_layout',
                    'target_cell': '__identity__',
                    'data': eventdata
                };
                cellSocket.sendString(JSON.stringify(responseData));
            });
    }
}

export {Plot, Plot as default};
