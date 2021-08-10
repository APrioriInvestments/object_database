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


class LineFigure {
    constructor(xys, lineWidth=1.0, color=null) {
        this.xys = xys;

        if (!(xys instanceof Float32Array)) {
            throw new Error("xys must be a Float32Array");
        }

        if (typeof(lineWidth) != 'number' && !(lineWidth instanceof Float32Array)) {
            throw new Error("lineWidth must be a float or a Float32Array");
        }

        if (!color) {
            this.color = new Float32Array([1.0, 1.0, 1.0, 1.0]);
        } else {
            if (!(color instanceof Float32Array)) {
                throw new Error("color must be a Float32Array");
            }

            if (color.length != 4 && color.length != this.xys.length * 2) {
                throw new Error("color must have either 4 elements, or 4 elements per point");
            }

            this.color = color;
        }

        if (lineWidth instanceof Float32Array) {
            if (this.xys.length != lineWidth.length * 2) {
                throw new Error("lineWidth and xys must have the same total number of points");
            }

            this.lineWidth = lineWidth;
        } else {
            this.lineWidth = new Float32Array(new ArrayBuffer(4 * this.xys.length));

            for (let i = 0; i < this.xys.length; i++) {
                this.lineWidth[i] = lineWidth;
            }
        }

        this.triangleBuffer = null;
        this.directionBuffer = null;
        this.lineWidthBuffer = null;
        this.colorBuffer = null;
        this.pointCount = null;

        this._buildBuffers = this._buildBuffers.bind(this);
    }

    _buildBuffers(renderer) {
        if (this.triangleBuffer) {
            renderer.gl.deleteBuffer(this.triangleBuffer);
            this.triangleBuffer = null;
        }

        if (this.directionBuffer) {
            renderer.gl.deleteBuffer(this.directionBuffer);
            this.directionBuffer = null;
        }

        if (this.colorBuffer) {
            renderer.gl.deleteBuffer(this.colorBuffer);
            this.colorBuffer = null;
        }

        if (this.lineWidthBuffer) {
            renderer.gl.deleteBuffer(this.lineWidthBuffer);
            this.lineWidthBuffer = null;
        }

        let segmentCount = this.xys.length / 2;
        let pointCount = segmentCount * 4;

        let outTriangles = new Float32Array(new ArrayBuffer(4 * pointCount * 3));
        let outDirection = new Float32Array(new ArrayBuffer(4 * pointCount * 2));
        let outColors = new Float32Array(new ArrayBuffer(4 * pointCount * 4));
        let outLineWidth = new Float32Array(new ArrayBuffer(4 * pointCount));

        let curPoint = 0;

        let colorStride = 4;
        if (this.color.length == 4) {
            colorStride = 0;
        }

        for (let segmentIx = 0; segmentIx < segmentCount; segmentIx += 1) {
            let x0 = this.xys[segmentIx * 2 + 0];
            let y0 = this.xys[segmentIx * 2 + 1];

            let x1 = this.xys[segmentIx * 2 + 2];
            let y1 = this.xys[segmentIx * 2 + 3];

            // write the lower left point
            outTriangles[curPoint * 3 + 0] = x0;
            outTriangles[curPoint * 3 + 1] = y0;
            outTriangles[curPoint * 3 + 2] = -1.0;
            outDirection[curPoint * 2 + 0] = x1 - x0;
            outDirection[curPoint * 2 + 1] = y1 - y0;
            outLineWidth[curPoint] = this.lineWidth[segmentIx];
            outColors[curPoint * 4 + 0] = this.color[segmentIx * colorStride + 0];
            outColors[curPoint * 4 + 1] = this.color[segmentIx * colorStride + 1];
            outColors[curPoint * 4 + 2] = this.color[segmentIx * colorStride + 2];
            outColors[curPoint * 4 + 3] = this.color[segmentIx * colorStride + 3];
            curPoint += 1;

            // upper left point
            outTriangles[curPoint * 3 + 0] = x0;
            outTriangles[curPoint * 3 + 1] = y0;
            outTriangles[curPoint * 3 + 2] = 1.0;
            outDirection[curPoint * 2 + 0] = x1 - x0;
            outDirection[curPoint * 2 + 1] = y1 - y0;
            outLineWidth[curPoint] = this.lineWidth[segmentIx];
            outColors[curPoint * 4 + 0] = this.color[segmentIx * colorStride + 0];
            outColors[curPoint * 4 + 1] = this.color[segmentIx * colorStride + 1];
            outColors[curPoint * 4 + 2] = this.color[segmentIx * colorStride + 2];
            outColors[curPoint * 4 + 3] = this.color[segmentIx * colorStride + 3];
            curPoint += 1;

            // write the lower right point
            outTriangles[curPoint * 3 + 0] = x1;
            outTriangles[curPoint * 3 + 1] = y1;
            outTriangles[curPoint * 3 + 2] = -1.0;
            outDirection[curPoint * 2 + 0] = x1 - x0;
            outDirection[curPoint * 2 + 1] = y1 - y0;
            outLineWidth[curPoint] = this.lineWidth[segmentIx + 1];
            outColors[curPoint * 4 + 0] = this.color[(segmentIx + 1) * colorStride + 0];
            outColors[curPoint * 4 + 1] = this.color[(segmentIx + 1) * colorStride + 1];
            outColors[curPoint * 4 + 2] = this.color[(segmentIx + 1) * colorStride + 2];
            outColors[curPoint * 4 + 3] = this.color[(segmentIx + 1) * colorStride + 3];
            curPoint += 1;

            // write the upper right point
            outTriangles[curPoint * 3 + 0] = x1;
            outTriangles[curPoint * 3 + 1] = y1;
            outTriangles[curPoint * 3 + 2] = 1.0;
            outDirection[curPoint * 2 + 0] = x1 - x0;
            outDirection[curPoint * 2 + 1] = y1 - y0;
            outLineWidth[curPoint] = this.lineWidth[segmentIx + 1];
            outColors[curPoint * 4 + 0] = this.color[(segmentIx + 1) * colorStride + 0];
            outColors[curPoint * 4 + 1] = this.color[(segmentIx + 1) * colorStride + 1];
            outColors[curPoint * 4 + 2] = this.color[(segmentIx + 1) * colorStride + 2];
            outColors[curPoint * 4 + 3] = this.color[(segmentIx + 1) * colorStride + 3];
            curPoint += 1;
        }

        // // rgbs are all the same
        // for (let i = 0; i < curPoint; i++) {
        //     outColors[i * 4 + 0] = .1;
        //     outColors[i * 4 + 1] = .7;
        //     outColors[i * 4 + 2] = .2;
        // }

        if (curPoint != pointCount) {
            console.error("POINT COUNT WRONG")
            throw new Error("Triangles didn't add up");
        }

        let gl = renderer.gl;

        this.triangleBuffer = gl.createBuffer();
        gl.bindBuffer(gl.ARRAY_BUFFER, this.triangleBuffer);
        gl.bufferData(gl.ARRAY_BUFFER, outTriangles, gl.STATIC_DRAW);

        this.directionBuffer = gl.createBuffer();
        gl.bindBuffer(gl.ARRAY_BUFFER, this.directionBuffer);
        gl.bufferData(gl.ARRAY_BUFFER, outDirection, gl.STATIC_DRAW);

        this.lineWidthBuffer = gl.createBuffer();
        gl.bindBuffer(gl.ARRAY_BUFFER, this.lineWidthBuffer);
        gl.bufferData(gl.ARRAY_BUFFER, outLineWidth, gl.STATIC_DRAW);

        this.colorBuffer = gl.createBuffer();
        gl.bindBuffer(gl.ARRAY_BUFFER, this.colorBuffer);
        gl.bufferData(gl.ARRAY_BUFFER, outColors, gl.STATIC_DRAW);

        this.pointCount = pointCount;
    }

    clear(renderer) {
        let gl = renderer.gl;

        if (this.colorBuffer) {
            gl.deleteBuffer(this.colorBuffer);
            this.colorBuffer = null;
        }

        if (this.triangleBuffer) {
            gl.deleteBuffer(this.triangleBuffer);
            this.triangleBuffer = null;
        }

        if (this.lineWidthBuffer) {
            gl.deleteBuffer(this.lineWidthBuffer);
            this.lineWidthBuffer = null;
        }

        if (this.directionBuffer) {
            gl.deleteBuffer(this.directionBuffer);
            this.directionBuffer = null;
        }
    }

    drawSelf(renderer) {
        if (!this.triangleBuffer) {
            let t0 = Date.now();
            this._buildBuffers(renderer);
            console.log("Took " + (Date.now() - t0) + " to build our triangles.")
        }

        renderer.drawTriangles(
            this.triangleBuffer,
            this.directionBuffer,
            this.lineWidthBuffer,
            this.colorBuffer,
            this.pointCount
        );
    }
}


class GlRenderer {
    constructor(canvas) {
        this.canvas = canvas;
        this.gl = this.canvas.getContext("webgl", {antialias: true});

        this.program = this.buildShaderProgram(this.gl);

        // where in object coordinates the current draw rect is
        this.screenPosition = [0.0, 0.0];
        this.screenSize = [1.0, 1.0];

        this.scrollPixels = this.scrollPixels.bind(this);
        this.zoom = this.zoom.bind(this);
        this.buildShaderProgram = this.buildShaderProgram.bind(this);
        this.compileShader = this.compileShader.bind(this);
        this.clearViewport = this.clearViewport.bind(this);
        this.drawTriangles = this.drawTriangles.bind(this);
    }

    buildShaderProgram(gl) {
        let program = gl.createProgram();

        let vertexShader = this.compileShader(gl, gl.VERTEX_SHADER, GlRenderer.vertexShader);
        let fragmentShader = this.compileShader(gl, gl.FRAGMENT_SHADER, GlRenderer.fragmentShader);

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

    zoom(xScreenFrac, yScreenFrac, zoomFrac) {
        this.screenPosition[0] += xScreenFrac * this.screenSize[0] * (1 - zoomFrac);
        this.screenPosition[1] += yScreenFrac * this.screenSize[1] * (1 - zoomFrac);
        this.screenSize[0] *= zoomFrac;
        this.screenSize[1] *= zoomFrac;
    }

    scrollPixels(xScreenFrac, yScreenFrac) {
        this.screenPosition[0] += xScreenFrac * this.screenSize[0];
        this.screenPosition[1] += yScreenFrac * this.screenSize[1];
    }

    clearViewport() {
        let gl = this.gl;

        gl.viewport(0, 0, this.canvas.width, this.canvas.height);
        gl.clearColor(0.0, 0.0, 0.0, 1.0);
        gl.clear(gl.COLOR_BUFFER_BIT);
        gl.enable(gl.BLEND);
        gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
    }

    drawTriangles(vertexBuffer, directionBuffer, lineWidthBuffer, colorBuffer, pointCount) {
        if (!vertexBuffer) {
            return;
        }

        let gl = this.gl;

        let currentScale = this.screenSize;

        gl.useProgram(this.program);

        let uScreenSize = gl.getUniformLocation(this.program, "uScreenSize");
        let uScreenPixelSize = gl.getUniformLocation(this.program, "uScreenPixelSize");
        let uGlobalColor = gl.getUniformLocation(this.program, "uGlobalColor");
        let uScreenPosition = gl.getUniformLocation(this.program, "uScreenPosition");

        gl.uniform2fv(uScreenSize, currentScale);
        gl.uniform4fv(uGlobalColor, [0.1, 0.7, 0.2, 1.0]);

        let aVertexColor = gl.getAttribLocation(this.program, "aVertexColor");
        let aVertexPosition = gl.getAttribLocation(this.program, "aVertexPosition");
        let aDirection = gl.getAttribLocation(this.program, "aDirection");
        let aLineWidth = gl.getAttribLocation(this.program, "aLineWidth");

        gl.bindBuffer(gl.ARRAY_BUFFER, vertexBuffer);
        gl.enableVertexAttribArray(aVertexPosition);
        gl.vertexAttribPointer(
            aVertexPosition,
            3,
            gl.FLOAT, false, 0, 0
        );

        gl.bindBuffer(gl.ARRAY_BUFFER, directionBuffer);
        gl.enableVertexAttribArray(aDirection);
        gl.vertexAttribPointer(
            aDirection,
            2,
            gl.FLOAT, false, 0, 0
        );

        gl.bindBuffer(gl.ARRAY_BUFFER, lineWidthBuffer);
        gl.enableVertexAttribArray(aLineWidth);
        gl.vertexAttribPointer(
            aLineWidth,
            1,
            gl.FLOAT, false, 0, 0
        );

        gl.bindBuffer(gl.ARRAY_BUFFER, colorBuffer);
        gl.enableVertexAttribArray(aVertexColor);
        gl.vertexAttribPointer(
            aVertexColor,
            4,
            gl.FLOAT, false, 0, 0
        );

        gl.uniform2fv(uScreenPixelSize, [1.0 / this.canvas.width, 1.0 / this.canvas.height]);
        gl.uniform2fv(uScreenPosition, this.screenPosition);
        gl.drawArrays(gl.TRIANGLE_STRIP, 0, pointCount);
    }
}

GlRenderer.fragmentShader = `
  #ifdef GL_ES
    precision highp float;
  #endif

  uniform vec4 uGlobalColor;

  varying lowp vec4 vColor;

  void main() {
    gl_FragColor += vColor;
  }
`

GlRenderer.vertexShader = `
  attribute float aLineWidth;
  attribute vec3 aVertexPosition;
  attribute vec2 aDirection;
  attribute vec4 aVertexColor;

  uniform vec2 uScreenSize;
  uniform vec2 uScreenPosition;
  uniform vec2 uScreenPixelSize;

  varying lowp vec4 vColor;

  void main() {
    vec2 directionPx = aDirection / uScreenPixelSize;

    vec3 normal = vec3(-directionPx.y, directionPx.x, 0.0000001);

    normal = normalize(normal) * aLineWidth;

    normal.xy *= uScreenPixelSize;

    vec2 rotatedPosition = vec2(
      (aVertexPosition.x - uScreenPosition.x) / uScreenSize.x * 2.0 - 1.0 + (aVertexPosition.z * normal.x),
      (aVertexPosition.y - uScreenPosition.y) / uScreenSize.y * 2.0 - 1.0 + (aVertexPosition.z * normal.y)
    );

    gl_Position = vec4(rotatedPosition, 0.0, 1.0);
    vColor = aVertexColor;
  }
`



class WebglPlot extends ConcreteCell {
    constructor(props, ...args) {
        super(props, ...args);

        this.installResizeObserver = this.installResizeObserver.bind(this);
        this.loadPacketIfNecessary = this.loadPacketIfNecessary.bind(this);
        this.onPlotDataReceived = this.onPlotDataReceived.bind(this);
        this.drawScene = this.drawScene.bind(this);

        this.requestedPacketId = 0;
        this.loadedPacketId = 0;

        this.onMouseDown = this.onMouseDown.bind(this);
        this.onWheel = this.onWheel.bind(this);

        this.currentDragHelper = null;

        this.animationFrameRequested = false;
        this.requestAnimationFrame = this.requestAnimationFrame.bind(this);

        this.lines = null;
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

    drawScene() {
        this.renderer.clearViewport()

        if (this.lines) {
            this.lines.drawSelf(this.renderer)
        }
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

        let x = xFrac * this.renderer.screenSize[0] + this.renderer.screenPosition[0];
        let y = yFrac * this.renderer.screenSize[1] + this.renderer.screenPosition[1];

        this.lines2 = new LineFigure(
            new Float32Array([x - 0.001, y - 0.001, x + 0.001, y + 0.001]),
            10
        )

        this.requestAnimationFrame();
    }

    onMouseDown(e) {
        e.preventDefault();

        if (this.currentDragHelper) {
            this.currentDragHelper.teardown();
        }

        this.currentDragHelper = new DragHelper(e,
            (event, startPoint, lastPoint,  curPoint) => {
                this.renderer.scrollPixels(
                    -(curPoint[0] - lastPoint[0]) / this.canvas.width,
                    (curPoint[1] - lastPoint[1]) / this.canvas.height
                );

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
        this.lines = new LineFigure(
            new Float32Array(plotData)
        );

        this.requestAnimationFrame();
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

        observer.observe(this.domElement);
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
