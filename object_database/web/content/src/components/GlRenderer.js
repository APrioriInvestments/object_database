

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

    zoomRect(x0ScreenFrac, y0ScreenFrac, x1ScreenFrac, y1ScreenFrac) {
        if (y0ScreenFrac > y1ScreenFrac) {
            [y0ScreenFrac, y1ScreenFrac] = [y1ScreenFrac, y0ScreenFrac];
        }

        if (x0ScreenFrac > x1ScreenFrac) {
            [x0ScreenFrac, x1ScreenFrac] = [x1ScreenFrac, x0ScreenFrac];
        }

        this.screenPosition[0] += x0ScreenFrac * this.screenSize[0];
        this.screenPosition[1] += y0ScreenFrac * this.screenSize[1];

        this.screenSize[0] *= Math.max(0.001, x1ScreenFrac - x0ScreenFrac);
        this.screenSize[1] *= Math.max(0.001, y1ScreenFrac - y0ScreenFrac);
    }

    scrollPixels(xScreenFrac, yScreenFrac) {
        this.screenPosition[0] += xScreenFrac * this.screenSize[0];
        this.screenPosition[1] += yScreenFrac * this.screenSize[1];
    }

    scrollToRectangle(viewRect) {
        this.screenPosition = [viewRect[0], viewRect[1]];
        this.screenSize = [viewRect[2] - viewRect[0], viewRect[3] - viewRect[1]];
    }


    clearViewport(clearColor) {
        let gl = this.gl;

        gl.viewport(0, 0, this.canvas.width, this.canvas.height);
        gl.clearColor(clearColor[0], clearColor[1], clearColor[2], clearColor[3]);
        gl.clear(gl.COLOR_BUFFER_BIT);
        gl.enable(gl.BLEND);
        gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
    }

    drawTriangles(vertexBuffer, directionBuffer, otherDirectionBuffer, linePosBuffer, lineWidthBuffer, colorBuffer, pointCount) {
        if (!vertexBuffer) {
            return;
        }

        let gl = this.gl;

        let currentScale = this.screenSize;

        gl.useProgram(this.program);

        let uScreenSize = gl.getUniformLocation(this.program, "uScreenSize");
        let uScreenPixelSize = gl.getUniformLocation(this.program, "uScreenPixelSize");
        let uScreenPosition = gl.getUniformLocation(this.program, "uScreenPosition");

        gl.uniform2fv(uScreenSize, currentScale);

        let aVertexColor = gl.getAttribLocation(this.program, "aVertexColor");
        let aVertexPosition = gl.getAttribLocation(this.program, "aVertexPosition");
        let aDirection = gl.getAttribLocation(this.program, "aDirection");
        let aOtherDirection = gl.getAttribLocation(this.program, "aOtherDirection");
        let aLineWidth = gl.getAttribLocation(this.program, "aLineWidth");
        let aLinePos = gl.getAttribLocation(this.program, "aLinePos");

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

        gl.bindBuffer(gl.ARRAY_BUFFER, otherDirectionBuffer);
        gl.enableVertexAttribArray(aOtherDirection);
        gl.vertexAttribPointer(
            aOtherDirection,
            2,
            gl.FLOAT, false, 0, 0
        );

        gl.bindBuffer(gl.ARRAY_BUFFER, linePosBuffer);
        gl.enableVertexAttribArray(aLinePos);
        gl.vertexAttribPointer(
            aLinePos,
            1,
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

  varying lowp vec4 vColor;

  void main() {
    gl_FragColor += vColor;
  }
`

GlRenderer.vertexShader = `
  attribute float aLineWidth;
  attribute float aLinePos;
  attribute vec3 aVertexPosition;
  attribute vec2 aDirection;
  attribute vec2 aOtherDirection;
  attribute vec4 aVertexColor;

  uniform vec2 uScreenSize;
  uniform vec2 uScreenPosition;
  uniform vec2 uScreenPixelSize;

  varying lowp vec4 vColor;

  void main() {
    vColor = aVertexColor;

    vec2 directionPx = aDirection / uScreenPixelSize;
    vec2 otherDirectionPx = aOtherDirection / uScreenPixelSize;

    vec2 normal = vec2(-directionPx.y, directionPx.x);

    normal = normalize(normal);

    // figure out the avg direction of the two line segments
    vec2 avgDirection = normalize(normalize(directionPx) + normalize(otherDirectionPx));
    vec2 normedDirection = normalize(directionPx);

    vec2 offset = normal * aVertexPosition.z * aLineWidth;

    float projAmount = - dot(offset, avgDirection) / dot(normedDirection, avgDirection);

    if (aLinePos < .5) {
        projAmount = max(projAmount, 0.0);
    } else {
        projAmount = min(projAmount, 0.0);
    }

    offset += projAmount * normedDirection;

    vec2 rotatedPosition = vec2(
      (aVertexPosition.x - uScreenPosition.x) / uScreenSize.x * 2.0 - 1.0 + offset.x * uScreenPixelSize.x,
      (aVertexPosition.y - uScreenPosition.y) / uScreenSize.y * 2.0 - 1.0 + offset.y * uScreenPixelSize.y
    );

    gl_Position = vec4(rotatedPosition, 0.0, 1.0);
  }
`

export {GlRenderer};
