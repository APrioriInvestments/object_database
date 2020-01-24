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
        this.recursivelyUnpackNumpyArrays = this.recursivelyUnpackNumpyArrays.bind(this);
        this.unpackHexFloats = this.unpackHexFloats.bind(this);
        this.hexcharToInt = this.hexcharToInt.bind(this);
        this.mergeObjects = this.mergeObjects.bind(this);
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

    recursivelyUnpackNumpyArrays(elt) {
        if (typeof(elt) === "string") {
            if (elt.startsWith("__hexencoded__")) {
                return this.unpackHexFloats(elt.substr(14))
            }
            return elt
        }

        if (Array.isArray(elt)) {
            return elt.map(this.recursivelyUnpackNumpyArrays)
        }

        if (elt === null) {
            return elt
        }

        if (typeof(elt) === "object") {
            var newElt = {}

            Object.keys(elt).forEach((key) => {
                newElt[key] = this.recursivelyUnpackNumpyArrays(elt[key])
            })

            return newElt;
        }

        return elt
    }

    hexcharToInt(x) {
        if (x>=97) return x - 97 + 10
        return x - 48
    }

    unpackHexFloats(x) {
        if (typeof x != "string") {
            return x
        }
        var buf = new ArrayBuffer(x.length/2);
        var bufView = new Uint8Array(buf);

        for (var i=0, strLen=x.length/2; i < strLen; i+=1) {
            bufView[i] = (
                this.hexcharToInt(x.charCodeAt(i*2)) * 16 +
                this.hexcharToInt(x.charCodeAt(i*2+1))
            )
        }
        return new Float64Array(buf)
    }

    mergeObjects(target, source) {
        Object.keys(source).forEach((key) => {
            if (target[key] === undefined) {
                target[key] = source[key]
            }
            else if (typeof(target[key]) == "object") {
                if (typeof(source[key]) == "object") {
                    this.mergeObjects(target[key], source[key])
                } else {
                    target[key] = source[key]
                }
            } else {
                target[key] = source[key]
            }
        })
    }

    runUpdate(aDOMElement){
        // TODO These are global var defined in page.html
        // we should do something about this.
        if (this.props.extraData.exceptionOccured) {
            console.log("plot exception occured");
            Plotly.purge(aDOMElement);
        } else {
            aDOMElement.lastUpdateData = this.props.extraData.plotData
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
                    var traces = aDOMElement.lastUpdateData[0]
                    var layout = aDOMElement.lastUpdateData[1]

                    traces = this.recursivelyUnpackNumpyArrays(traces);

                    traces.map((trace) => {
                        if (trace.timestamp !== undefined) {
                            trace.x = Array.from(trace.timestamp).map(ts => new Date(ts * 1000))
                        }
                    })

                    var layoutToUse = {}

                    if (aDOMElement.data.length > 0) {
                        layoutToUse = {
                            'xaxis': {'range': aDOMElement.layout.xaxis.range, 'autorange': false},
                            'yaxis': {'range': aDOMElement.layout.yaxis.range}
                        }

                        if (aDOMElement.layout.yaxis2 !== undefined) {
                            layoutToUse.yaxis2 = {'range': aDOMElement.layout.yaxis2.range}
                        }
                    }

                    // merge the layout data from the user
                    this.mergeObjects(layoutToUse, layout)

                    Plotly.react(aDOMElement, traces, layoutToUse)
                    aDOMElement.lastUpdateTimestamp = Date.now()
                }
            }, UPDATE_DELAY_MS)
        }
    }
}

export {_PlotUpdater, _PlotUpdater as default};
