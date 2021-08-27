/**
 * Plot Cell Cell
 */

import {AxisRenderer} from './AxisRenderer';
import {ConcreteCell} from './ConcreteCell';
import {ImageFigure} from './ImageFigure';
import {TextFigure} from './TextFigure';
import {LineFigure} from './LineFigure';
import {PointFigure} from './PointFigure';
import {TrianglesFigure} from './TrianglesFigure';
import {GlRenderer} from './GlRenderer';
import {makeDomElt as h} from './Cell';

class DragHelper {
    constructor(startEvent, callback) {
        this.callback = callback;
        this.isTornDown = false;

        this.onMouseMove = this.onMouseMove.bind(this);
        this.onMouseUp = this.onMouseUp.bind(this);

        this.initialPoint = [startEvent.pageX, startEvent.pageY];
        this.lastPoint = [startEvent.pageX, startEvent.pageY];

        window.addEventListener('mousemove', this.onMouseMove);
        window.addEventListener('mouseup', this.onMouseUp);
    }

    onMouseMove(e) {
        let curPt = [e.pageX, e.pageY];

        if (e.buttons) {
            this.callback("move", this.initialPoint, this.lastPoint, curPt);
            this.lastPoint = curPt;
        } else {
            this.callback("end", this.initialPoint, this.lastPoint, curPt);
            this.teardown();
        }
    }

    onMouseUp(e) {
        let curPt = [e.pageX, e.pageY];
        this.callback("end", this.initialPoint, this.lastPoint, curPt);
        this.teardown();
    }

    teardown() {
        if (this.isTornDown) {
            return;
        }

        this.callback("teardown");

        this.isTornDown = true;
        window.removeEventListener('mousemove', this.onMouseMove)
        window.removeEventListener('mouseup', this.onMouseUp)
    }
}


class Packets {
    constructor(requestPacketFun, onAllPacketsLoaded, onPacketLoadFailed) {
        this.requestPacketFun = requestPacketFun;
        this.onAllPacketsLoaded = onAllPacketsLoaded;
        this.onPacketLoadFailed = onPacketLoadFailed;

        this.packetIdToData = {};
        this.touchedPacketsIds = {};
        this.requestedPacketIds = {};
        this.unreceivedPackets = 0;

        this.walkAndRequest = this.walkAndRequest.bind(this);
        this.resetTouchedPackets = this.resetTouchedPackets.bind(this);
        this.eraseUntouched = this.eraseUntouched.bind(this);
        this.requestPacketId = this.requestPacketId.bind(this);

        this.onPacket = this.onPacket.bind(this);
        this.onFailure = this.onFailure.bind(this);

        this.decode = this.decode.bind(this);
        this.decodeNumberOrFloats = this.decodeNumberOrFloats.bind(this);
        this.decodeFloats = this.decodeFloats.bind(this);
        this.decodeColors = this.decodeColors.bind(this);
    }

    resetTouchedPackets() {
        this.touchedPacketsIds = {};
    }

    // get rid of packets we've seen and return whether all mentioned packets are
    // loaded
    eraseUntouched() {
        let toRemove = [];
        for (var packetId in this.packetIdToData) {
            if (!this.touchedPacketsIds[packetId]) {
                toRemove.push(packetId);
            }
        }

        toRemove.forEach(packetId => {
            console.info("Packet " + packetId + " no longer used.");

            delete this.packetIdToData[packetId];

            if (this.requestedPacketIds[packetId]) {
                delete this.requestedPacketIds[packetId];
            }
        });

        for (var packetId in this.touchedPacketsIds) {
            if (!this.packetIdToData[packetId]) {
                return false;
            }
        }

        return true;
    }

    requestPacketId(packetId) {
        this.touchedPacketsIds[packetId] = true;

        if (this.packetIdToData[packetId] !== undefined) {
            return;
        }

        if (this.requestedPacketIds[packetId]) {
            return;
        }

        console.log("Requesting packet " + packetId);

        this.requestedPacketIds[packetId] = true;
        this.unreceivedPackets += 1;

        this.requestPacketFun(packetId, this.onPacket, this.onFailure);
    }

    onPacket(packetId, response) {
        if (!this.requestedPacketIds[packetId]) {
            return;
        }

        this.packetIdToData[packetId] = response;
        delete this.requestedPacketIds[packetId];

        this.unreceivedPackets -= 1;

        if (this.unreceivedPackets == 0) {
            this.onAllPacketsLoaded();
        }
    }

    onFailure(packetId, status, errorText) {
        console.error("Loading " + packetId + " failed: " + errorText);

        this.onPacketLoadFailed(errorText);
    }

    walkAndRequest(jsonRepresentation) {
        if (!jsonRepresentation) {
            return;
        }

        if (Array.isArray(jsonRepresentation)) {
            jsonRepresentation.forEach(this.walkAndRequest);
            return;
        }

        if (typeof(jsonRepresentation) == 'object') {
            if (jsonRepresentation.packetId) {
                this.requestPacketId(jsonRepresentation.packetId);
            } else {
                for (var key in jsonRepresentation) {
                    this.walkAndRequest(jsonRepresentation[key]);
                }
            }
        }
    }

    decodeNumberOrFloats(jsonRepresentation) {
        if (typeof(jsonRepresentation) == 'number') {
            return jsonRepresentation;
        }

        return new Float32Array(this.packetIdToData[jsonRepresentation.packetId]);
    }

    decodeFloats(jsonRepresentation) {
        return new Float32Array(this.packetIdToData[jsonRepresentation.packetId]);
    }

    decodeColors(jsonRepresentation) {
        if (Array.isArray(jsonRepresentation)) {
            if (jsonRepresentation.length != 4) {
                throw new Error("Bad color encoded");
            }

            return new Float32Array(jsonRepresentation);
        }

        let array = new Uint8Array(this.packetIdToData[jsonRepresentation.packetId]);
        let floats = new Float32Array(new ArrayBuffer(4 * array.length));

        for (let i = 0; i < array.length; i++) {
            floats[i] = array[i] / 255.0;
        }

        return floats;
    }

    decodeColorsUint8(jsonRepresentation) {
        if (Array.isArray(jsonRepresentation)) {
            if (jsonRepresentation.length != 4) {
                throw new Error("Bad color encoded");
            }

            return new Float32Array(jsonRepresentation);
        }

        return new Uint8Array(this.packetIdToData[jsonRepresentation.packetId]);
    }

    decode(jsonRepresentation) {
        if (jsonRepresentation.packetId) {
            return this.packetIdToData[jsonRepresentation.packetId];
        }

        return jsonRepresentation;
    }
}


class WebglPlot extends ConcreteCell {
    constructor(props, ...args) {
        super(props, ...args);

        this.installResizeObserver = this.installResizeObserver.bind(this);
        this.loadPacketIfNecessary = this.loadPacketIfNecessary.bind(this);
        this.drawScene = this.drawScene.bind(this);

        this.requestedPacketId = 0;
        this.loadedPacketId = 0;

        this.onMouseDown = this.onMouseDown.bind(this);
        this.onWheel = this.onWheel.bind(this);
        this.onDoubleclick = this.onDoubleclick.bind(this);
        this.onMousemove = this.onMousemove.bind(this);
        this.onMouseleave = this.onMouseleave.bind(this);
        this.onMouseenter = this.onMouseenter.bind(this);

        this.currentDragHelper = null;
        this.hasBuiltLegend = false;

        this.animationFrameRequested = false;
        this.requestAnimationFrame = this.requestAnimationFrame.bind(this);
        this.onPacketLoadFailed = this.onPacketLoadFailed.bind(this);
        this.lineFigureFromJson = this.lineFigureFromJson.bind(this);
        this.renderAxes = this.renderAxes.bind(this);
        this.renderLegend = this.renderLegend.bind(this);
        this.renderMousover = this.renderMousover.bind(this);
        this.sendScrollStateToServer = this.sendScrollStateToServer.bind(this);

        this.imageFigureFromJson = this.imageFigureFromJson.bind(this);
        this.triangleFigureFromJson = this.triangleFigureFromJson.bind(this);
        this.pointFigureFromJson = this.pointFigureFromJson.bind(this);
        this.textFigureFromJson = this.textFigureFromJson.bind(this);
        this.lineFigureFromJson = this.lineFigureFromJson.bind(this);

        this.renderedDefaultViewport = null;

        this.packets = new Packets(
            this.requestPacket,
            this.loadPacketIfNecessary,
            this.onPacketLoadFailed
        );

        this.figures = [];
    }

    requestAnimationFrame() {
        if (this.animationFrameRequested) {
            return;
        }

        this.animationFrameRequested = true;

        window.requestAnimationFrame(() => {
            this.animationFrameRequested = false;

            this.drawScene();
        })
    }

    handleMessages(messages) {
        messages.forEach(msg => {
            if (msg.event == "mouseoverContentsChanged") {
                this.mouseoverContents = msg.contents;
                this.requestAnimationFrame();
            }
        })
    }


    renderMousover() {
        let mouseoverContents = this.mouseoverContents;

        while (this.mouseoverHolderDiv.childNodes.length) {
            this.mouseoverHolderDiv.removeChild(this.mouseoverHolderDiv.firstChild);
        }

        if (mouseoverContents == null) {
            return;
        }

        let x = mouseoverContents.x;
        let y = mouseoverContents.y;

        let xPx = (x - this.renderer.screenPosition[0]) / this.renderer.screenSize[0] * this.canvas.width;
        let yPx = (1.0 - (y - this.renderer.screenPosition[1]) / this.renderer.screenSize[1]) * this.canvas.height;

        let contents = mouseoverContents.contents;

        let styles = [];

        styles.push("left:" + xPx + "px")
        styles.push("top:" + yPx + "px")
        styles.push('position:absolute')

        let rows = contents.map(row => {
            return h('tr', {}, row.map(col => {
                let colElt = null;
                if (col.color) {
                    let c = col.color;

                    colElt = h('div', {
                        'class': 'plot-legend-color',
                        'style': 'background-color:' +
                            `rgba(${c[0]*255},${c[1]*255},${c[2]*255},${c[3]})`
                        },
                        []
                    );
                } else {
                    colElt = col.text;
                }

                return h('td', {}, [colElt])
            }))
        })

        this.mouseoverHolderDiv.appendChild(
            h('div', {'style':
                styles.join(';'),
                'class': 'plot-mouseover'
            }, [
                h('table', {}, rows)
            ])
        )
    }

    // make sure we zero out our legen
    updateSelf(namedChildren, data) {
        this.namedChildren = namedChildren;
        this.props = data;

        // force a rebuild of the legend.
        this.hasBuiltLegend = false;
    }

    renderLegend() {
        // the legend can't change, so don't rebuild it
        if (this.hasBuiltLegend) {
            return;
        }

        this.hasBuiltLegend = true;

        while (this.legendHolderDiv.childNodes.length) {
            this.legendHolderDiv.removeChild(this.legendHolderDiv.firstChild);
        }

        if (!this.props.plotData.legend) {
            return
        }
        let styles = [];
        let legend = this.props.plotData.legend;

        if (legend.position[0] < .5) {
            styles.push("left:" + (legend.position[0] * 100.0) + "%")
        } else {
            styles.push("right:" + ((1.0-legend.position[0]) * 100.0) + "%")
        }

        if (legend.position[1] < .5) {
            styles.push("bottom:" + (legend.position[1] * 100.0) + "%")
        } else {
            styles.push("top:" + ((1.0-legend.position[1]) * 100.0) + "%")
        }
        styles.push('position:absolute')

        let rows = [];

        for (let i = 0; i < legend.seriesNames.length; i++) {
            let c = legend.colors[i];

            rows.push(
                h('tr', {}, [
                    h('td',
                        {},
                        [
                            h('div', {
                            'class': 'plot-legend-color',
                            'style': 'background-color:' +
                                `rgba(${c[0]*255},${c[1]*255},${c[2]*255},${c[3]})`
                            },
                            []
                            )
                        ]
                    ),
                    h('td', {'class': 'plot-legend-label'}, [
                        legend.seriesNames[i]
                    ]),
                ])
            )
        }

        this.legendHolderDiv.appendChild(
            h('div', {'style':
                styles.join(';'),
                'class': 'plot-legend'
            }, [
                h('table', {}, rows)
            ])
        )
    }

    renderAxes() {
        if (!this.props.plotData) {
            [this.leftAxis, this.topAxis, this.bottomAxis, this.rightAxis].forEach(
                axis => {
                    axis.style.width = "0px";
                    axis.style.height = "0px";
                }
            );
        } else {
            // do him first so we know how big he is
            new AxisRenderer('top', this.topAxis, this.topAxisLegend, this.props.plotData, this.renderer, 0).render();
            new AxisRenderer('bottom', this.bottomAxis, this.bottomAxisLegend, this.props.plotData, this.renderer, 0).render();

            // because of how the dom is structured, the left/right axes need to know how far to offset themselves.
            let ht = this.topAxis.clientHeight + this.topAxisLegend.clientHeight;
            new AxisRenderer('left', this.leftAxis, this.leftAxisLegend, this.props.plotData, this.renderer, ht).render();
            new AxisRenderer('right', this.rightAxis, this.rightAxisLegend, this.props.plotData, this.renderer, ht).render();
        }
    }

    onPacketLoadFailed(error) {
        console.error("TODO: set the screen to an error display");
    }

    drawScene() {
        if (!this.props.plotData) {
            return;
        }

        this.renderAxes();
        this.renderLegend();
        this.renderMousover();


        let arraysEqual = (x, y) => {
            if (!x && !y) {
                return true;
            }
            if (!x || !y) {
                return false;
            }

            if (x.length != y.length) {
                return false;
            }

            for (let i = 0; i < x.length; i++) {
                if (x[i] != y[i]) {
                    return false;
                }
            }
            return true;
        }

        if (!arraysEqual(this.props.plotData.defaultViewport, this.renderedDefaultViewport)) {
            this.renderer.scrollToRectangle(this.props.plotData.defaultViewport);
            this.renderedDefaultViewport = this.props.plotData.defaultViewport;
        }

        while (this.textLayer.childNodes.length) {
            this.textLayer.removeChild(this.textLayer.firstChild);
        }

        this.renderer.clearViewport()

        if (this.props.plotData.backgroundColor) {
            let c = this.props.plotData.backgroundColor;
            this.backgroundColorDiv.style.backgroundColor = `rgba(${c[0]*255},${c[1]*255},${c[2]*255},${c[3]})`
        } else {
            this.backgroundColorDiv.style.backgroundColor = null;
        }

        this.figures.forEach(figure => {
            figure.drawSelf(this.renderer)
        })
    }

    _computeFillSpacePreferences() {
        return {horizontal: true, vertical: true};
    }

    onWheel(e) {
        e.preventDefault();

        let rect = this.canvas.getBoundingClientRect();

        let xFrac = (e.pageX - rect.left) / rect.width;
        let yFrac = (rect.height - (e.pageY - rect.top)) / rect.height;

        this.renderer.zoom(xFrac, yFrac, Math.exp(e.deltaY / 100))

        this.requestAnimationFrame();
    }

    onDoubleclick(e) {
        if (this.renderedDefaultViewport) {
            this.renderer.scrollToRectangle(this.renderedDefaultViewport);
            this.requestAnimationFrame();
            this.sendScrollStateToServer();
        }
    }

    onMousemove(e) {
        if (this.currentDragHelper) {
            return;
        }

        let rect = this.canvas.getBoundingClientRect();

        let xFrac = (e.pageX - rect.left) / rect.width;
        let yFrac = (rect.height - (e.pageY - rect.top)) / rect.height;

        let x = this.renderer.screenPosition[0] + this.renderer.screenSize[0] * xFrac;
        let y = this.renderer.screenPosition[1] + this.renderer.screenSize[1] * yFrac;

        this.sendMessage({'event': 'mousemove', 'x': x, 'y': y})
    }

    onMouseenter(e) {
        if (this.currentDragHelper) {
            return;
        }

        let rect = this.canvas.getBoundingClientRect();

        let xFrac = (e.pageX - rect.left) / rect.width;
        let yFrac = (rect.height - (e.pageY - rect.top)) / rect.height;

        let x = this.renderer.screenPosition[0] + this.renderer.screenSize[0] * xFrac;
        let y = this.renderer.screenPosition[1] + this.renderer.screenSize[1] * yFrac;

        this.sendMessage({'event': 'mouseenter', 'x': x, 'y': y})
    }

    onMouseleave(e) {
        if (this.currentDragHelper) {
            return;
        }

        let rect = this.canvas.getBoundingClientRect();

        let xFrac = (e.pageX - rect.left) / rect.width;
        let yFrac = (rect.height - (e.pageY - rect.top)) / rect.height;

        let x = this.renderer.screenPosition[0] + this.renderer.screenSize[0] * xFrac;
        let y = this.renderer.screenPosition[1] + this.renderer.screenSize[1] * yFrac;

        this.sendMessage({'event': 'mouseleave', 'x': x, 'y': y})
    }

    onMouseDown(e) {
        e.preventDefault();

        if (this.currentDragHelper) {
            this.currentDragHelper.teardown();
        }

        if (e.ctrlKey) {
            // we are panning
            this.currentDragHelper = new DragHelper(e,
                (event, startPoint, lastPoint,  curPoint) => {
                    if (event == "teardown") {
                        return;
                    }

                    this.renderer.scrollPixels(
                        -(curPoint[0] - lastPoint[0]) / this.canvas.width,
                        (curPoint[1] - lastPoint[1]) / this.canvas.height
                    );

                    this.requestAnimationFrame();
                    this.sendScrollStateToServer();

                    if (event == 'end') {
                        this.currentDragHelper = null;
                    }
                }
            );
        } else {
            // we are selecting a zoom region
            let hasMoved = false;

            this.currentDragHelper = new DragHelper(e,
                (event, startPoint, lastPoint,  curPoint) => {
                    if (event == "teardown") {
                        this.currentDragHelper = null;
                        return;
                    }

                    let curRect = this.canvas.getBoundingClientRect();

                    if (Math.abs(startPoint[0] - curPoint[0]) + Math.abs(startPoint[1] - curPoint[1]) > 10) {
                        hasMoved = true;
                    }

                    if (!hasMoved) {
                        return;
                    }

                    if (event == "teardown" || event == "end") {
                        this.dragDiv.setAttribute("style", "height:0px; width: 0px; display: none");

                        if (event == "end") {
                            let x0 = startPoint[0] - curRect.left;
                            let y0 = this.canvas.height - (startPoint[1] - curRect.top);

                            let x1 = curPoint[0] - curRect.left;
                            let y1 = this.canvas.height - (curPoint[1] - curRect.top);

                            this.renderer.zoomRect(
                                x0 / this.canvas.width,
                                y0 / this.canvas.height,
                                x1 / this.canvas.width,
                                y1 / this.canvas.height
                            )

                            this.requestAnimationFrame();
                            this.sendScrollStateToServer();
                        }
                    } else {
                        let [x0, y0] = startPoint;
                        let [x1, y1] = curPoint;

                        if (x0 > x1) {
                            [x0, x1] = [x1, x0];
                        }
                        if (y0 > y1) {
                            [y0, y1] = [y1, y0];
                        }

                        x0 -= curRect.left;
                        y0 -= curRect.top;
                        x1 -= curRect.left;
                        y1 -= curRect.top;

                        this.dragDiv.setAttribute("style",
                            "height:" + (y1 - y0) + "px;" +
                            "width:" + (x1 - x0) + "px;" +
                            "left:" + x0 + "px;" +
                            "top:" + y0 + "px;" +
                            "position:absolute;"
                        )
                    }
                }
            );
        }
    }

    build() {
        this.errorDiv = h('div', 
            {
                'style': 'position:absolute;height:100%;width:100%;top:0;left:0;pointer-events:none',
                'class': 'allow-child-to-fill-space'
            },
            [this.renderChildNamed('errorCell')]
        );

        this.dragDiv = h(
            'div', {
                style: 'width:0px;height:0px;display:none;pointer-events:none',
                class: "plot-zoom-handle"
            }, []
        );

        this.legendHolderDiv = h(
            'div', {'style': 'width:calc(100.0% - 20px);height:calc(100.0% - 20px);top:10px;left:10px;position:absolute;pointer-events:none;'}, []
        )

        this.mouseoverHolderDiv = h(
            'div', {'style': 'width:100%;height:100%;top:0;left:0;position:absolute;pointer-events: none;'}, []
        )

        this.canvas = h(
            'canvas', {
                style: 'width:100%;height:100%;position:absolute;top:0;left:0',
                onmousedown: this.onMouseDown,
                onwheel: this.onWheel,
                ondblclick: this.onDoubleclick,
                onmousemove: this.onMousemove,
                onmouseleave: this.onMouseleave,
                onmouseenter: this.onMouseenter
            },
            ["Error: no WEBGL available"]
        );

        this.canvasHolder = h(
            'div',
            {'style': 'width:100%;flex:1;z-index:0;position:relative;top:0;left:0'},
            [
            this.canvas,
            this.dragDiv,
            this.legendHolderDiv,
            this.mouseoverHolderDiv
            ]
        );

        this.leftAxisLegend = h('div', {style:'height:100%;pointer-events:none'}, []);
        this.rightAxisLegend = h('div', {style:'height:100%;pointer-events:none'}, []);
        this.topAxisLegend = h('div', {style:'width:100%;pointer-events:none'}, []);
        this.bottomAxisLegend = h('div', {style:'width:100%;pointer-events:none'}, []);

        this.leftAxis = h('div', {style:'z-index:1;width:0px;height:100%;position:relative;top:0;left:0;pointer-events:none'}, []);
        this.rightAxis = h('div', {style:'z-index:1;width:0px;height:100%;position:relative;top:0;left:0;pointer-events:none'}, []);
        this.topAxis = h('div', {style:'z-index:1;width:100%;height:0px;position:relative;top:0;left:0;pointer-events:none'}, []);
        this.bottomAxis = h('div', {style:'z-index:1;width:100%;height:0px;position:relative;top:0;left:0;pointer-events:none'}, []);

        this.leftAxisLegendHolder = h('div', {style:'height:100%;flex:0;pointer-events:none'}, [this.leftAxisLegend]);
        this.leftAxisHolder = h('div', {style:'height:100%;flex:0;pointer-events:none'}, [this.leftAxis]);

        this.rightAxisLegendHolder = h('div', {style:'height:100%;flex:0;pointer-events:none'}, [this.rightAxisLegend]);
        this.rightAxisHolder = h('div', {style:'height:100%;flex:0;pointer-events:none'}, [this.rightAxis]);

        this.topAxisLegendHolder = h('div', {style:'width:100%;flex:0;pointer-events:none'}, [this.topAxisLegend]);
        this.topAxisHolder = h('div', {style:'width:100%;flex:0;pointer-events:none'}, [this.topAxis]);

        this.bottomAxisLegendHolder = h('div', {style:'width:100%;flex:0;pointer-events:none'}, [this.bottomAxisLegend]);
        this.bottomAxisHolder = h('div', {style:'width:100%;flex:0;pointer-events:none'}, [this.bottomAxis]);

        this.canvasAndUDAxesHolder = h('div',
            {'style': 'flex:1;display:flex;flex-direction:column;width:100%'},
            [
                this.topAxisLegendHolder,
                this.topAxisHolder,
                this.canvasHolder,
                this.bottomAxisHolder,
                this.bottomAxisLegendHolder
            ]
        )

        this.canvasAndLRAxesHolder = h('div',
            {'style': 'overflow:hidden;display:flex;flex-direction:row;width:100%;height:100%'},
            [
                this.leftAxisLegendHolder,
                this.leftAxisHolder,
                this.canvasAndUDAxesHolder,
                this.rightAxisHolder,
                this.rightAxisLegendHolder
            ]
        )

        this.textLayer = h(
            'div', {'style': 'width:100%;height:100%;top:0;left:0;position:absolute;pointer-events: none;'}, []
        )

        this.backgroundColorDiv = h('div', {'style': 'position:absolute;top:0;left:0;width:100%;height:100%;pointer-events:none'}, []);

        this.loadPacketIfNecessary();

        return h('div', {'style':'position:relative;top:0;left:0'}, [
            this.backgroundColorDiv,
            this.canvasAndLRAxesHolder,
            this.textLayer,
            this.errorDiv
        ]);
    }

    sendScrollStateToServer() {
        this.sendMessage({
            'event': 'scrollState',
            'position': this.renderer.screenPosition,
            'size': this.renderer.screenSize
        });
    }

    rebuildDomElement() {
        this.loadPacketIfNecessary();
    }

    loadPacketIfNecessary() {
        // this.props.plotData is a structure with {packetId: int} inside in various places
        // we need to walk the json and find out if we have any packets we have yet to request
        // and clear out any ones that are not represented here
        this.packets.resetTouchedPackets();
        this.packets.walkAndRequest(this.props.plotData);

        if (this.packets.eraseUntouched()) {
            // we can rebuild our plot now
            this.figures = [];

            if (this.props.plotData) {
                this.props.plotData.figures.forEach(figureJson => {
                    if (figureJson.type == 'LineFigure') {
                        this.figures.push(
                            this.lineFigureFromJson(figureJson)
                        );
                    }
                    if (figureJson.type == 'PointFigure') {
                        this.figures.push(
                            this.pointFigureFromJson(figureJson)
                        );
                    }
                    if (figureJson.type == 'TrianglesFigure') {
                        this.figures.push(
                            this.triangleFigureFromJson(figureJson)
                        );
                    }
                    if (figureJson.type == 'ImageFigure') {
                        this.figures.push(
                            this.imageFigureFromJson(figureJson)
                        );
                    }
                    if (figureJson.type == 'TextFigure') {
                        this.figures.push(
                            this.textFigureFromJson(figureJson)
                        );
                    }
                });
            }

            this.requestAnimationFrame();
        }
    }

    textFigureFromJson(figureJson) {
        let xs = this.packets.decodeFloats(figureJson.x);
        let ys = this.packets.decodeFloats(figureJson.y);

        let label = figureJson.label;
        let offsets = this.packets.decodeFloats(figureJson.offsets);
        let fractionPositions = this.packets.decodeFloats(figureJson.fractionPositions);
        let sizes = this.packets.decodeFloats(figureJson.sizes);
        let color = this.packets.decodeColors(figureJson.colors);

        return new TextFigure(
            xs,
            ys,
            label,
            color,
            offsets,
            fractionPositions,
            sizes,
            this.textLayer
        );
    }

    lineFigureFromJson(figureJson) {
        let xs = this.packets.decodeFloats(figureJson.x);
        let ys = this.packets.decodeFloats(figureJson.y);

        let lineWidth = this.packets.decodeNumberOrFloats(figureJson.lineWidth);
        let color = this.packets.decodeColors(figureJson.color);

        return new LineFigure(
            xs,
            ys,
            lineWidth,
            color
        );
    }

    pointFigureFromJson(figureJson) {
        let xs = this.packets.decodeFloats(figureJson.x);
        let ys = this.packets.decodeFloats(figureJson.y);

        let pointSize = this.packets.decodeNumberOrFloats(figureJson.pointSize);
        let color = this.packets.decodeColors(figureJson.color);

        return new PointFigure(
            xs,
            ys,
            pointSize,
            color
        );
    }

    triangleFigureFromJson(figureJson) {
        let xs = this.packets.decodeFloats(figureJson.x);
        let ys = this.packets.decodeFloats(figureJson.y);
        let color = this.packets.decodeColors(figureJson.color);

        return new TrianglesFigure(
            xs,
            ys,
            color
        );
    }

    imageFigureFromJson(figureJson) {
        return new ImageFigure(
            figureJson.position,
            figureJson.pixelsWide,
            this.packets.decodeColorsUint8(figureJson.colors)
        )
    }

    cellWillUnload() {
        try {
            // release opengl memory
            this.renderer.gl.getExtension('WEBGL_lose_context').loseContext();
        } catch(e) {
            console.error(e);
        }
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

            this.canvas.width = this.lastWidth;
            this.canvas.height = this.lastHeight;

            this.drawScene();
        });

        observer.observe(this.canvasHolder);
    }

    onFirstInstalled() {
        this.canvas.width = this.canvas.clientWidth;
        this.canvas.height = this.canvas.clientHeight;

        this.renderer = new GlRenderer(this.canvas);

        this.installResizeObserver();
        this.requestAnimationFrame();
    }
}

export {WebglPlot, WebglPlot as default};
