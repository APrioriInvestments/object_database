/**
 * Plot Cell Cell
 */

import {ConcreteCell} from './ConcreteCell';
import {makeDomElt as h} from './Cell';

class DragHelper {
    constructor(startEvent, callback) {
        this.callback = callback;
        this.isTornDown = false;

        this.onMouseMove = this.onMouseMove.bind(this);
        this.onMouseUp = this.onMouseUp.bind(this);

        this.initialPoint = [startEvent.screenX, startEvent.screenY];
        this.lastPoint = [startEvent.screenX, startEvent.screenY];

        window.addEventListener('mousemove', this.onMouseMove);
        window.addEventListener('mouseup', this.onMouseUp);
    }

    onMouseMove(e) {
        let curPt = [e.screenX, e.screenY];
        this.callback("move", this.initialPoint, this.lastPoint, curPt);
        this.lastPoint = curPt;
    }

    onMouseUp(e) {
        let curPt = [e.screenX, e.screenY];
        this.callback("end", this.initialPoint, this.lastPoint, curPt);
        this.teardown();
    }

    teardown() {
        if (this.isTornDown) {
            return;
        }

        this.isTornDown = true;
        window.removeEventListener('mousemove', this.onMouseMove)
        window.removeEventListener('mouseup', this.onMouseUp)
    }
}


class WebglPlot extends ConcreteCell {
    constructor(props, ...args) {
        super(props, ...args);

        this.buildShaderProgram = this.buildShaderProgram.bind(this);
        this.compileShader = this.compileShader.bind(this);
        this.installResizeObserver = this.installResizeObserver.bind(this);
        this.loadPacketIfNecessary = this.loadPacketIfNecessary.bind(this);
        this.onPlotDataReceived = this.onPlotDataReceived.bind(this);

        this.requestedPacketId = 0;
        this.loadedPacketId = 0;

        this.vertexArray = null;
        this.vertexBuffer = null;

        this.onMouseDown = this.onMouseDown.bind(this);
        this.onWheel = this.onWheel.bind(this);

        this.currentDragHelper = null;

        this.screenPosition = [0.0, 0.0];
        this.screenSize = [1.0, 1.0];

        this.scrollPixels = this.scrollPixels.bind(this);

        this.animationFrameRequested = false;
        this.requestAnimationFrame = this.requestAnimationFrame.bind(this);
    }

    requestAnimationFrame() {
        if (this.animationFrameRequested) {
            return;
        }

        this.animationFrameRequested = true;

        window.requestAnimationFrame(() => {
            this.animationFrameRequested = false;
            this.drawScene(this.gl);
        })
    }

    _computeFillSpacePreferences() {
        return {horizontal: true, vertical: true};
    }

    onWheel(e) {
        e.preventDefault();

        let rect = this.canvas.getBoundingClientRect();

        // the point we just scrolled on
        let y = (rect.height - (e.pageY - rect.top)) / rect.height * this.screenSize[1] + this.screenPosition[1];
        let x = (e.pageX - rect.left) / rect.width * this.screenSize[0] + this.screenPosition[0];

        // get the coordinates relative to us
        let screenFracX = (x - this.screenPosition[0]) / this.screenSize[0];
        let screenFracY = (y - this.screenPosition[1]) / this.screenSize[1];

        // we're going to multiply 'screenSize' by this in both dimensions
        let zoomFrac = Math.exp(e.deltaY / 100);

        this.screenPosition[0] += screenFracX * this.screenSize[0] * (1 - zoomFrac);
        this.screenPosition[1] += screenFracY * this.screenSize[1] * (1 - zoomFrac);
        this.screenSize[0] *= zoomFrac;
        this.screenSize[1] *= zoomFrac;

        this.requestAnimationFrame();
    }

    scrollPixels(x, y) {
        this.screenPosition[0] += x / this.canvas.width * this.screenSize[0];
        this.screenPosition[1] += y / this.canvas.height * this.screenSize[1];
    }

    onMouseDown(e) {
        e.preventDefault();

        if (this.currentDragHelper) {
            this.currentDragHelper.teardown();
        }

        this.currentDragHelper = new DragHelper(e,
            (event, startPoint, lastPoint,  curPoint) => {
                this.scrollPixels(-(curPoint[0] - lastPoint[0]), (curPoint[1] - lastPoint[1]));

                this.requestAnimationFrame();

                if (event == 'end') {
                    this.currentDragHelper = null;
                }
            }
        )
    }

    build() {
        this.canvas = h(
            'canvas', {
                style: 'width:100%;height:100%',
                onmousedown: this.onMouseDown,
                onwheel: this.onWheel,
            },
            ["Error: no WEBGL available"]
        );

        this.loadPacketIfNecessary();

        return h('div', {}, [this.canvas]);
    }

    rebuildDomElement() {
        this.loadPacketIfNecessary();
    }

    loadPacketIfNecessary() {
        if (this.props.packetId && this.props.packetId > this.requestedPacketId) {
            this.requestPacket(this.props.packetId, this.onPlotDataReceived, null);
            this.requestedPacketId = this.props.packetId;
            this.packetRequestedAt = Date.now();
        }
    }

    onPlotDataReceived(packetId, plotData) {
        if (this.loadedPacketId >= packetId) {
            return;
        }

        console.log("Packet " + packetId + " received in "
            + (Date.now() - this.packetRequestedAt) + " milliseconds.");

        this.loadedPacketId = packetId;
        this.vertexArray = new Float32Array(plotData);

        // clear our existing buffer
        if (this.vertexBuffer) {
            this.gl.deleteBuffer(this.vertexBuffer);
            this.vertexBuffer = null;
        }

        this.vertexBuffer = this.gl.createBuffer();
        this.gl.bindBuffer(this.gl.ARRAY_BUFFER, this.vertexBuffer);
        this.gl.bufferData(this.gl.ARRAY_BUFFER, this.vertexArray, this.gl.STATIC_DRAW);

        this.drawScene(this.gl);

        console.log("Packet " + packetId + " received and rendered in "
            + (Date.now() - this.packetRequestedAt) + " milliseconds.");
    }

    cellWillUnload() {
        try {
            // release opengl memory
            this.gl.getExtension('WEBGL_lose_context').loseContext();
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

            this.drawScene(this.gl);
        });

        observer.observe(this.domElement);
    }

    onFirstInstalled() {
        this.canvas.width = this.canvas.clientWidth;
        this.canvas.height = this.canvas.clientHeight;

        this.gl = this.canvas.getContext("webgl", {antialias: true});

        this.program = this.buildShaderProgram(this.gl);

        this.drawScene(this.gl);

        this.installResizeObserver();
    }

    buildShaderProgram(gl) {
        let program = gl.createProgram();

        let vertexShader = this.compileShader(gl, gl.VERTEX_SHADER, WebglPlot.vertexShader);
        let fragmentShader = this.compileShader(gl, gl.FRAGMENT_SHADER, WebglPlot.fragmentShader);

        gl.attachShader(program, vertexShader);
        gl.attachShader(program, fragmentShader);
        gl.linkProgram(program);

        if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
            console.error("Error linking shader program:");
            console.error(gl.getProgramInfoLog(program));
        }

        return program;
    }

    compileShader(gl, type, code) {
        let shader = gl.createShader(type);

        gl.shaderSource(shader, code);
        gl.compileShader(shader);

        if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
            console.error(`Error compiling ${type === gl.VERTEX_SHADER ? "vertex" : "fragment"} shader:`);
            console.error(gl.getShaderInfoLog(shader));
        }

        return shader;
    }

    drawScene(gl) {
        if (!this.vertexArray) {
            return;
        }

        gl.viewport(0, 0, this.canvas.width, this.canvas.height);
        gl.clearColor(0.0, 0.0, 0.0, 1.0);
        gl.clear(gl.COLOR_BUFFER_BIT);

        let currentScale = this.screenSize;

        gl.useProgram(this.program);

        let uScreenSize = gl.getUniformLocation(this.program, "uScreenSize");
        let uGlobalColor = gl.getUniformLocation(this.program, "uGlobalColor");
        let uScreenPosition = gl.getUniformLocation(this.program, "uScreenPosition");

        gl.uniform2fv(uScreenSize, currentScale);
        gl.uniform4fv(uGlobalColor, [0.1, 0.7, 0.2, 1.0]);

        gl.enable(gl.BLEND);
        gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);

        let aVertexPosition = gl.getAttribLocation(this.program, "aVertexPosition");

        let vertexNumComponents = 2;

        gl.bindBuffer(gl.ARRAY_BUFFER, this.vertexBuffer);
        gl.enableVertexAttribArray(aVertexPosition);
        gl.vertexAttribPointer(
            aVertexPosition,
            vertexNumComponents,
            gl.FLOAT, false, 0, 0
        );

        gl.uniform2fv(uScreenPosition, this.screenPosition);
        gl.drawArrays(gl.TRIANGLES, 0, this.vertexArray.length/vertexNumComponents);
    }
}

WebglPlot.fragmentShader = `
  #ifdef GL_ES
    precision highp float;
  #endif

  uniform vec4 uGlobalColor;

  void main() {
    gl_FragColor += uGlobalColor;
  }
`

WebglPlot.vertexShader = `
  attribute vec2 aVertexPosition;

  uniform vec2 uScreenSize;
  uniform vec2 uScreenPosition;

  void main() {
    vec2 rotatedPosition = vec2(
      (aVertexPosition.x - uScreenPosition.x) / uScreenSize.x * 2.0 - 1.0,
      (aVertexPosition.y - uScreenPosition.y) / uScreenSize.y * 2.0 - 1.0
    );

    gl_Position = vec4(rotatedPosition, 0.0, 1.0);
  }
`

export {WebglPlot, WebglPlot as default};
