/**
 * Plot Cell Cell
 */

import {Cell} from './Cell';
import {makeDomElt as h} from './Cell';

/**
 * About Named Children
 * --------------------
 * `chartUpdater` (single) - The Updater cell
 * `error` (single) - An error cell, if present
 */
class Plot extends Cell {
    constructor(props, ...args){
        super(props, ...args);

        // Bind Cell methods
        this.setupPlot = this.setupPlot.bind(this);
        this.setErrorMessage = this.setErrorMessage.bind(this);
        this.recursivelyUnpackNumpyArrays = this.recursivelyUnpackNumpyArrays.bind(this);
        this.unpackHexEncodedArray = this.unpackHexEncodedArray.bind(this);
        this.hexcharToInt = this.hexcharToInt.bind(this);
        this.mergeObjects = this.mergeObjects.bind(this);
        this.installResizeObserver = this.installResizeObserver.bind(this);
        this.updatePlotState = this.updatePlotState.bind(this);
        this.updatePlotTraces = this.updatePlotTraces.bind(this);

        this.lastUpdateTimestamp = 0;
        this.lastUpdateData = {};

        this.plotDivIsActive = false;
        this.plotDiv = null;
        this.errorDiv = null;
        this.domElement = null;

        this.lastWidth = -1
        this.lastHeight = -1
    }

    handleMessages(message) {
        if (message.event == "updateXYRange") {
            let low = message.lowTimestamp;
            let high = message.highTimestamp;

            let plotDiv = this.plotDiv;
            let newLayout = plotDiv.layout;

            if (typeof(newLayout.xaxis.range[0]) === 'string') {
                let formatDate = function(d) {
                    return (d.getYear() + 1900) +
                            "-" + ("00" + (d.getMonth() + 1)).substr(-2) +
                            "-" + ("00" + d.getDate()).substr(-2) +
                            " " + ("00" + d.getHours()).substr(-2) +
                            ":" + ("00" + d.getMinutes()).substr(-2) +
                            ":" + ("00" + d.getSeconds()).substr(-2) +
                            "." + ("000000" + d.getMilliseconds()).substr(-3)
                };

                newLayout.xaxis.range[0] = formatDate(new Date(low * 1000));
                newLayout.xaxis.range[1] = formatDate(new Date(high * 1000));
                newLayout.xaxis.autorange = false;
            } else {
                newLayout.xaxis.range[0] = {low};
                newLayout.xaxis.range[1] = {high};
                newLayout.xaxis.autorange = false;
            }

            plotDiv.is_server_defined_move = true;
            Plotly.react(plotDiv, plotDiv.data, newLayout);
            plotDiv.is_server_defined_move = false;

            console.log("cells.Plot: range for 'plot' is now " +
                plotDiv.layout.xaxis.range[0] + " to " + plotDiv.layout.xaxis.range[1])
        }
    }

    buildDomElement() {
        if (this.domElement !== null) {
            return this.domElement;
        }

        this.plotDiv = h('div', {style: 'position:absolute'});
        this.errorDiv = h('div', {style: 'display:none'});

        this.domElement = (
            h('div', {
                id: this.getElementId(),
                "data-cell-id": this.identity,
                "data-cell-type": "Plot",
                class: "cell flex-child",
                style: 'height:100%;width:100%'
            }, [
                this.plotDiv,
                this.errorDiv,
            ])
        );

        return this.addCanonicalTags(this.domElement);
    }

    onFirstInstalled() {
        this.updatePlotState(true);
        this.installResizeObserver();
    }

    cellWillUnload() {
        if (this.plotDivIsActive) {
            Plotly.purge(this.plotDiv);
            this.plotDivIsActive = false;
        }
    }

    rebuildDomElement() {
        this.updatePlotState(false);
    }

    // cause the plotDiv to become a plotly.Plot
    setupPlot(){
        if (this.plotDivIsActive) {
            throw new Error("Plot already active.");
        }

        var plotDiv = this.plotDiv;

        Plotly.react(
            plotDiv,
            [],
            {
                margin: {t : 30, l: 30, r: 30, b:30 },
                xaxis: {rangeslider: {visible: false}},
                // setting this causes the uistate to persist across updates
                // which are mostly caused by us zooming. This fixes the problem
                // where we zoom and the plot state resets (e.g. series turned off/on etc)
                uirevision: 'true'
            },
            { scrollZoom: true, dragmode: 'pan', displaylogo: false, displayModeBar: 'hover',
                modeBarButtons: [ ['pan2d'], ['zoom2d'], ['zoomIn2d'], ['zoomOut2d'] ],
                //responsive: true
            }
        );

        var onRelayout = () => {
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
                axes = Object.assign({}, axes);
                axes["xaxis.range[0]"] = Date.parse(axes["xaxis.range[0]"]) / 1000.0;
                axes["xaxis.range[1]"] = Date.parse(axes["xaxis.range[1]"]) / 1000.0;
            }

            let responseData = {
                'event':'plot_layout',
                'target_cell': this.identity,
                'data': axes
            };

            this.sendMessage({event: 'plot_layout', data: axes});
        }

        var onRelayouting = function() {
            plotDiv.lastRelayoutingTimestamp = Date.now();
        }

        plotDiv.on('plotly_relayout', onRelayout);
        plotDiv.on('plotly_relayouting', onRelayouting);
        plotDiv.on('plotly_doubleclick', onRelayout);

        this.plotDivIsActive = true;
    }

    setErrorMessage(error) {
        let newErrorDiv = h('div', {
            class: "alert alert-primary traceback"
            }, [error]
        );

        this.errorDiv.replaceWith(newErrorDiv);
        this.errorDiv = newErrorDiv;

        if (this.plotDivIsActive) {
            this.plotDiv.style = "display:none";
            this.plotDivIsActive = false;
            Plotly.purge(this.plotDiv);
        }
    }

    updatePlotState(immediately) {
        if (this.props.error) {
            this.setErrorMessage(this.props.error);
        } else {
            if (!this.plotDivIsActive) {
                this.setupPlot();
            }

            // reset the error div
            let newErrorDiv = h('div', {style: 'display:none'});
            this.errorDiv.replaceWith(newErrorDiv);
            this.errorDiv = newErrorDiv;

            // update the plot div itself
            this.lastUpdateData = this.props.plotData
            this.lastUpdateTimestamp = Date.now()

            if (immediately) {
                this.updatePlotTraces();
            } else {
                var UPDATE_DELAY_MS = 100;

                window.setTimeout(() => {
                    // don't do anything if the plot div no longer is on the screen
                    if (!this.plotDivIsActive) {
                        return;
                    }

                    if (this.plotDiv.lastRelayoutingTimestamp !== undefined) {
                        if (Date.now() - this.plotDiv.lastRelayoutingTimestamp < 75) {
                            //the user just scrolled.
                            window.setTimeout(() => { this.runUpdate(this.plotDiv)}, 75);
                            return
                        }
                    }
                    if (Date.now() - this.lastUpdateTimestamp >= UPDATE_DELAY_MS) {
                        this.updatePlotTraces();
                    }
                }, UPDATE_DELAY_MS)
            }
        }
    }

    updatePlotTraces() {
        try {
            var traces = this.lastUpdateData[0]
            var layout = this.lastUpdateData[1]

            traces = this.recursivelyUnpackNumpyArrays(traces);

            traces.map((trace) => {
                if (trace.timestamp !== undefined) {
                    trace.x = Array.from(trace.timestamp).map(ts => new Date(ts * 1000))
                }
            })

            var layoutToUse = {}

            if (this.plotDiv.data.length > 0) {
                layoutToUse = {
                    xaxis: {'range': this.plotDiv.layout.xaxis.range, 'autorange': false},
                    yaxis: {'range': this.plotDiv.layout.yaxis.range},
                    uirevision: 'true'
                }

                if (this.plotDiv.layout.yaxis2 !== undefined) {
                    layoutToUse.yaxis2 = {'range': this.plotDiv.layout.yaxis2.range}
                }
            }

            // merge the layout data from the user
            this.mergeObjects(layoutToUse, layout)

            Plotly.react(this.plotDiv, traces, layoutToUse)

            this.lastUpdateTimestamp = Date.now()
        } catch (e) {
            this.setErrorMessage("Internal Cells Error: " + e.toString());
        }
    }

    recursivelyUnpackNumpyArrays(elt) {
        if (typeof(elt) === "string") {
            if (elt.startsWith("__hexencoded_")) {
                return this.unpackHexEncodedArray(elt.substr(13, 3), elt.substr(18))
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

    unpackHexEncodedArray(arrayType, arrayData) {
        if (typeof arrayData != "string") {
            return arrayData
        }
        var buf = new ArrayBuffer(arrayData.length/2);
        var bufView = new Uint8Array(buf);

        for (var i=0, strLen=arrayData.length/2; i < strLen; i+=1) {
            bufView[i] = (
                this.hexcharToInt(arrayData.charCodeAt(i*2)) * 16 +
                this.hexcharToInt(arrayData.charCodeAt(i*2+1))
            )
        }
        if (arrayType == "f64") {
            return new Float64Array(buf)
        }
        if (arrayType == "f32") {
            return new Float32Array(buf)
        }
        if (arrayType == "s64") {
            return new BigInt64Array(buf)
        }
        if (arrayType == "s32") {
            return new Int32Array(buf)
        }
        if (arrayType == "s16") {
            return new Int16Array(buf)
        }
        if (arrayType == "s08") {
            return new Int8Array(buf)
        }
        if (arrayType == "u64") {
            return new BigUint64Array(buf)
        }
        if (arrayType == "u32") {
            return new Uint32Array(buf)
        }
        if (arrayType == "u16") {
            return new Uint16Array(buf)
        }
        if (arrayType == "u08") {
            return new Uint8Array(buf)
        }
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

    installResizeObserver() {
        let observer = new ResizeObserver(entries => {
            for (let entry of entries) {
                if (entry.contentRect.width == this.lastWidth &&
                    entry.contentRect.height == this.lastHeight) {
                    return
                }

                this.lastWidth = entry.contentRect.width;
                this.lastHeight = entry.contentRect.height;
            }

            console.log("Resizing plotly plot to " + this.lastWidth + " x " + this.lastHeight)

            // update the plot size, but don't let the plot get too small, or allow the aspect ratio
            // to get beyond 1/3 in either direction

            let newHeight = Math.max(this.lastHeight, 200);
            let newWidth = Math.max(this.lastWidth, 200);

            if (newWidth > newHeight * 3) {
                newWidth = newHeight * 3;
            }

            if (newHeight > newWidth * 3) {
                newHeight = newWidth * 3;
            }

            if (this.plotDivIsActive) {
                Plotly.relayout(this.plotDiv, {width: newWidth, height: newHeight});
            }
        });

        observer.observe(this.plotDiv.parentNode);
    }
}

export {Plot, Plot as default};
