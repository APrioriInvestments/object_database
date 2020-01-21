/**
 * _PlotUpdater Cell Component
 * NOTE: Later refactorings should result in
 * this component becoming obsolete
 */

import {Component} from './Component';
import {h} from 'maquette';

const MAX_INTERVALS = 25;

class _PlotUpdater extends Component {
    constructor(props, ...args){
        super(props, ...args);

        this.runUpdate = this.runUpdate.bind(this);
        this.listenForPlot = this.listenForPlot.bind(this);
        this.lastWidth = -1
        this.lastHeight = -1
        this.lastUpdateTimestamp = 0
        this.lastUpdateData = {}
    }

    componentDidLoad() {
        // If we can find a matching Plot element
        // at this point, we simply update it.
        // Otherwise we need to 'listen' for when
        // it finally comes into the DOM.
        let initialPlotDiv = document.getElementById(`plot${this.props.extraData.plotId}`);
        if(initialPlotDiv){
            this.runUpdate(initialPlotDiv);
        } else {
            this.listenForPlot();
        }
        const ro = new ResizeObserver(entries => {
            for (let entry of entries) {
                if (entry.contentRect.width == this.lastWidth &&
                    entry.contentRect.height == this.lastHeight) {
                    return
                }
                this.lastWidth = entry.contentRect.width;
                this.lastHeight = entry.contentRect.height;
            }

            console.log("Resizing plotly plot to " + this.lastWidth + " x " + this.lastHeight)

            initialPlotDiv.style.width = '100%';
            initialPlotDiv.style.height = '100%';
            Plotly.Plots.resize(initialPlotDiv)
            initialPlotDiv.parentNode.style.width = '100%';
            initialPlotDiv.parentNode.style.height = '100%';
            Plotly.Plots.resize(initialPlotDiv.parentNode)
            let plotDiv = document.getElementById(`plot${this.props.extraData.plotId}`);
            this.runUpdate(initialPlotDiv);
        });
        ro.observe(initialPlotDiv.parentNode.parentNode);
    }

    componentDidUpdate(){
        // Because _PlotUpdater is a separate
        // component for now, we need to call
        // the update method each time the
        // #cellUpdated message comes through for
        // this specific component instance.
        this.componentDidLoad();
    }

    build(){
        return h('div',
            {
                class: "cell",
                id: this.props.id,
                style: "display: none",
                "data-cell-id": this.props.id,
                "data-cell-type": "_PlotUpdater"
            }, []);
    }

    /**
     * In the event that a `_PlotUpdater` has come
     * over the wire *before* its corresponding
     * Plot has come over (which appears to be
     * common), we will set an interval of 50ms
     * and check for the matching Plot in the DOM
     * MAX_INTERVALS times, only calling `runUpdate`
     * once we've found a match.
     */
    listenForPlot(){
        let numChecks = 0;
        let plotChecker = window.setInterval(() => {
            if(numChecks > MAX_INTERVALS){
                window.clearInterval(plotChecker);
                console.error(`Could not find matching Plot ${this.props.extraData.plotId} for _PlotUpdater ${this.props.id}`);
                return;
            }
            let plotDiv = document.getElementById(`plot${this.props.extraData.plotId}`);
            if(plotDiv){
                this.runUpdate(plotDiv);
                window.clearInterval(plotChecker);
            } else {
                numChecks += 1;
            }
        }, 50);
    }

    runUpdate(aDOMElement){
        // TODO These are global var defined in page.html
        // we should do something about this.
        if (this.props.extraData.exceptionOccured) {
            console.log("plot exception occured");
            Plotly.purge(aDOMElement);
        } else {
            aDOMElement.lastUpdateData = this.props.extraData.plotData.map(mapPlotlyData);
            aDOMElement.lastUpdateTimestamp = Date.now()

            var UPDATE_DELAY_MS = 100;

            window.setTimeout(() => {
                if (aDOMElement.lastRelayoutingTimestamp !== undefined) {
                    if (Date.now() - aDOMElement.lastRelayoutingTimestamp < 75) {
                        //the user just scrolled.
                        window.setTimeout(() => {
                            this.runUpdate(aDOMElement)
                        }, 75)

                        return
                    }
                }
                if (Date.now() - aDOMElement.lastUpdateTimestamp >= UPDATE_DELAY_MS) {
                    console.log("Apply an update from " + (Date.now() - aDOMElement.lastUpdateTimestamp) + " ms ago with " + aDOMElement.lastUpdateData[0].y.length + " items")

                    if (aDOMElement.data.length > 0) {
                        aDOMElement.layout.xaxis.autorange = false
                    }

                    console.log(aDOMElement._redrawTimer)

                    Plotly.react(aDOMElement, aDOMElement.lastUpdateData, aDOMElement.layout)
                    aDOMElement.lastUpdateTimestamp = Date.now()
                }
            }, UPDATE_DELAY_MS)
        }
    }
}

export {_PlotUpdater, _PlotUpdater as default};
