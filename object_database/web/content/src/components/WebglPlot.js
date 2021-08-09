/**
 * Plot Cell Cell
 */

import {ConcreteCell} from './ConcreteCell';
import {makeDomElt as h} from './Cell';


/**
 * About Named Children
 * --------------------
 * `chartUpdater` (single) - The Updater cell
 * `error` (single) - An error cell, if present
 */
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
    }

    _computeFillSpacePreferences() {
        return {horizontal: true, vertical: true};
    }

    build() {
        this.canvas = h(
            'canvas', {style: 'width:100%;height:100%'}, ["Error: no WEBGL available"]
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
        gl.clearColor(0.8, 0.9, 1.0, 1.0);
        gl.clear(gl.COLOR_BUFFER_BIT);

        let currentRotation = [0, 1];
        let aspectRatio = 1.0;
        let currentScale = [1.0, aspectRatio];

        let currentAngle = 0.0;

        let radians = currentAngle * Math.PI / 180.0;
        currentRotation[0] = Math.sin(radians);
        currentRotation[1] = Math.cos(radians);

        gl.useProgram(this.program);

        let uScalingFactor = gl.getUniformLocation(this.program, "uScalingFactor");
        let uGlobalColor = gl.getUniformLocation(this.program, "uGlobalColor");
        let uRotationVector = gl.getUniformLocation(this.program, "uRotationVector");

        gl.uniform2fv(uScalingFactor, currentScale);
        gl.uniform2fv(uRotationVector, currentRotation);
        gl.uniform4fv(uGlobalColor, [0.1, 0.7, 0.2, 1.0]);

        gl.bindBuffer(gl.ARRAY_BUFFER, this.vertexBuffer);

        let aVertexPosition = gl.getAttribLocation(this.program, "aVertexPosition");

        let vertexNumComponents = 2;
        let vertexCount = this.vertexArray.length/vertexNumComponents;

        gl.enableVertexAttribArray(aVertexPosition);
        gl.vertexAttribPointer(
            aVertexPosition,
            vertexNumComponents,
            gl.FLOAT, false, 0, 0
        );

        gl.drawArrays(gl.TRIANGLES, 0, vertexCount);
    }
}

WebglPlot.fragmentShader = `
  #ifdef GL_ES
    precision highp float;
  #endif

  uniform vec4 uGlobalColor;

  void main() {
    gl_FragColor = uGlobalColor;
  }
`

WebglPlot.vertexShader = `
  attribute vec2 aVertexPosition;

  uniform vec2 uScalingFactor;
  uniform vec2 uRotationVector;

  void main() {
    vec2 rotatedPosition = vec2(
      aVertexPosition.x * uRotationVector.y +
            aVertexPosition.y * uRotationVector.x,
      aVertexPosition.y * uRotationVector.y -
            aVertexPosition.x * uRotationVector.x
    );

    gl_Position = vec4(rotatedPosition * uScalingFactor, 0.0, 1.0);
  }
`

export {WebglPlot, WebglPlot as default};
