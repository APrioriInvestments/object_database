import {makeDomElt as h} from './Cell';

const imageShader = {
fragmentShader: `
  #ifdef GL_ES
    precision highp float;
  #endif

  varying highp vec2 vTextureCoord;

  uniform sampler2D uSampler;

  void main() {
    gl_FragColor = texture2D(uSampler, vTextureCoord.xy);
  }
`,
vertexShader: `
  attribute vec2 aVertexPosition;

  uniform vec2 uScreenSize;
  uniform vec2 uScreenPosition;

  uniform vec2 uImagePosition;
  uniform vec2 uImageSize;

  varying highp vec2 vTextureCoord;

  void main() {
    vec2 vertexPosition = aVertexPosition * uImageSize + uImagePosition;

    vec2 rotatedPosition = vec2(
      (vertexPosition.x - uScreenPosition.x) / uScreenSize.x * 2.0 - 1.0,
      (vertexPosition.y - uScreenPosition.y) / uScreenSize.y * 2.0 - 1.0
    );

    vTextureCoord = aVertexPosition;

    gl_Position = vec4(rotatedPosition, 0.0, 1.0);
  }
`
}

const pointsShader = {
fragmentShader: `
  #ifdef GL_ES
    precision highp float;
  #endif

  varying lowp vec4 vColor;

  void main() {
    gl_FragColor += vColor;
  }
`,
vertexShader: `
  attribute vec4 aVertexPosition;
  attribute vec4 aVertexColor;
  attribute float aPointSize;

  uniform vec2 uScreenSize;
  uniform vec2 uScreenPosition;
  uniform vec2 uScreenPixelSize;

  uniform vec2 uZOffsetPx;
  uniform vec2 uWOffsetPx;

  varying lowp vec4 vColor;

  void main() {
    vColor = aVertexColor;

    vec2 rotatedPosition = vec2(
      (aVertexPosition.x - uScreenPosition.x) / uScreenSize.x * 2.0 - 1.0,
      (aVertexPosition.y - uScreenPosition.y) / uScreenSize.y * 2.0 - 1.0
    );

    rotatedPosition += aVertexPosition.z * (uZOffsetPx * uScreenPixelSize * aPointSize);
    rotatedPosition += aVertexPosition.w * (uWOffsetPx * uScreenPixelSize * aPointSize);

    gl_Position = vec4(rotatedPosition, 0.0, 1.0);
  }
`
}

const trianglesShader = {
fragmentShader: `
  #ifdef GL_ES
    precision highp float;
  #endif

  varying lowp vec4 vColor;

  void main() {
    gl_FragColor += vColor;
  }
`,
vertexShader: `
  attribute vec3 aVertexPosition;
  attribute vec4 aVertexColor;

  uniform vec2 uScreenSize;
  uniform vec2 uScreenPosition;
  uniform vec2 uScreenPixelSize;

  varying lowp vec4 vColor;

  void main() {
    vColor = aVertexColor;

    vec2 rotatedPosition = vec2(
      (aVertexPosition.x - uScreenPosition.x) / uScreenSize.x * 2.0 - 1.0,
      (aVertexPosition.y - uScreenPosition.y) / uScreenSize.y * 2.0 - 1.0
    );

    gl_Position = vec4(rotatedPosition, 0.0, 1.0);
  }
`
}

const linesShader = {
fragmentShader: `
  #ifdef GL_ES
    precision highp float;
  #endif

  varying lowp vec4 vColor;

  void main() {
    gl_FragColor += vColor;
  }
`,
vertexShader: `
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

    vec2 directionPx = aDirection / uScreenSize / uScreenPixelSize;
    vec2 otherDirectionPx = aOtherDirection / uScreenSize / uScreenPixelSize;

    vec2 normal = normalize(vec2(-directionPx.y, directionPx.x));

    // figure out the avg direction of the two line segments
    vec2 avgDirection = normalize(normalize(directionPx) + normalize(otherDirectionPx));
    vec2 normedDirection = normalize(directionPx);

    vec2 offset = normal * aVertexPosition.z * aLineWidth;

    float projAmount = - dot(offset, avgDirection) / dot(normedDirection, avgDirection);

    if (aLinePos < .5) {
        projAmount = min(max(projAmount, 0.0), length(directionPx));
    } else {
        projAmount = max(min(projAmount, 0.0), -length(directionPx));
    }

    offset += projAmount * normedDirection;

    vec2 rotatedPosition = vec2(
      (aVertexPosition.x - uScreenPosition.x) / uScreenSize.x * 2.0 - 1.0 + offset.x * uScreenPixelSize.x,
      (aVertexPosition.y - uScreenPosition.y) / uScreenSize.y * 2.0 - 1.0 + offset.y * uScreenPixelSize.y
    );

    gl_Position = vec4(rotatedPosition, 0.0, 1.0);
  }
`
}

class GlRenderer {
    constructor() {
        this.webgl_canvas = h(
            'canvas', {
                style: 'width:100px;height:100px;position:absolute;top:0;left:0;opacity:0.0'
            }
        );

        this.gl = this.webgl_canvas.getContext("webgl", {antialias: true});

        this.linesProgram = this.buildShaderProgram(this.gl, linesShader);
        this.trianglesProgram = this.buildShaderProgram(this.gl, trianglesShader);
        this.pointsProgram = this.buildShaderProgram(this.gl, pointsShader);
        this.imageProgram = this.buildShaderProgram(this.gl, imageShader);

        // where in object coordinates the current draw rect is
        this.screenPosition = null;
        this.screenSize = null;
        this.width = null;
        this.height = null;

        this.sizeToCanvas = this.sizeToCanvas.bind(this);
        this.copyToCanvas = this.copyToCanvas.bind(this);
        this.isContextLost = this.isContextLost.bind(this);
        this.buildShaderProgram = this.buildShaderProgram.bind(this);
        this.compileShader = this.compileShader.bind(this);
        this.clearViewport = this.clearViewport.bind(this);
        this.drawLines = this.drawLines.bind(this);
        this.drawTriangles = this.drawTriangles.bind(this);
        this.drawPoints = this.drawPoints.bind(this);
        this.drawImage = this.drawImage.bind(this);
    }

    buildShaderProgram(gl, shaderCode) {
        let program = gl.createProgram();

        let vertexShader = this.compileShader(gl, gl.VERTEX_SHADER, shaderCode.vertexShader);
        let fragmentShader = this.compileShader(gl, gl.FRAGMENT_SHADER, shaderCode.fragmentShader);

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

    sizeToCanvas(canvas, screenPosition, screenSize) {
        this.screenPosition = screenPosition;
        this.screenSize = screenSize;
        this.width = canvas.width;
        this.height = canvas.height;

        let width = canvas.width;
        let height = canvas.height;
        let maxWidth = Math.max(this.webgl_canvas.width, width);
        let maxHeight = Math.max(this.webgl_canvas.height, height);

        if (this.webgl_canvas.width != maxWidth || this.webgl_canvas.height != maxHeight) {
            this.webgl_canvas.width = maxWidth;
            this.webgl_canvas.height = maxHeight;
        }
    }

    copyToCanvas(canvas) {
        let ctx = canvas.getContext('2d');
        ctx.globalCompositeOperation = 'copy';

        ctx.drawImage(
            this.webgl_canvas,
            0, this.webgl_canvas.height - canvas.height, canvas.width, canvas.height,   // src rect
            0, 0, canvas.width, canvas.height
        );
    }

    isContextLost() {
        return this.gl.isContextLost();
    }

    clearViewport() {
        let gl = this.gl;

        gl.viewport(0, 0, this.width, this.height);
        gl.clearColor(0, 0, 0, 0);
        gl.clear(gl.COLOR_BUFFER_BIT);
        gl.enable(gl.BLEND);
        gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
    }

    drawImage(vertexBuffer, texture, position) {
        if (!vertexBuffer) {
            return;
        }

        let gl = this.gl;

        let program = this.imageProgram;

        gl.useProgram(program);

        let uScreenSize = gl.getUniformLocation(program, "uScreenSize");
        let uScreenPosition = gl.getUniformLocation(program, "uScreenPosition");

        let uImagePosition = gl.getUniformLocation(program, "uImagePosition");
        let uImageSize = gl.getUniformLocation(program, "uImageSize");
        let uSampler = gl.getUniformLocation(program, 'uSampler');


        gl.uniform2fv(uScreenSize, this.screenSize);
        gl.uniform2fv(uScreenPosition, this.screenPosition);

        gl.uniform2fv(uImagePosition, [position[0], position[1]]);
        gl.uniform2fv(uImageSize, [position[2] - position[0], position[3] - position[1]]);

        let aVertexPosition = gl.getAttribLocation(program, "aVertexPosition");

        gl.bindBuffer(gl.ARRAY_BUFFER, vertexBuffer);
        gl.enableVertexAttribArray(aVertexPosition);
        gl.vertexAttribPointer(
            aVertexPosition,
            2,
            gl.FLOAT, false, 0, 0
        );


        gl.activeTexture(gl.TEXTURE0);

        // Bind the texture to texture unit 0
        gl.bindTexture(gl.TEXTURE_2D, texture);

        // Tell the shader we bound the texture to texture unit 0
        gl.uniform1i(uSampler, 0);

        gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
    }

    drawTriangles(vertexBuffer, colorBuffer, pointCount) {
        if (!vertexBuffer) {
            return;
        }

        let gl = this.gl;

        let currentScale = this.screenSize;

        let program = this.trianglesProgram;

        gl.useProgram(program);

        let uScreenSize = gl.getUniformLocation(program, "uScreenSize");
        let uScreenPixelSize = gl.getUniformLocation(program, "uScreenPixelSize");
        let uScreenPosition = gl.getUniformLocation(program, "uScreenPosition");

        gl.uniform2fv(uScreenSize, currentScale);

        let aVertexColor = gl.getAttribLocation(program, "aVertexColor");
        let aVertexPosition = gl.getAttribLocation(program, "aVertexPosition");

        gl.bindBuffer(gl.ARRAY_BUFFER, vertexBuffer);
        gl.enableVertexAttribArray(aVertexPosition);
        gl.vertexAttribPointer(
            aVertexPosition,
            2,
            gl.FLOAT, false, 0, 0
        );

        gl.bindBuffer(gl.ARRAY_BUFFER, colorBuffer);
        gl.enableVertexAttribArray(aVertexColor);
        gl.vertexAttribPointer(
            aVertexColor,
            4,
            gl.FLOAT, false, 0, 0
        );

        gl.uniform2fv(uScreenPixelSize, [1.0 / this.width, 1.0 / this.height]);
        gl.uniform2fv(uScreenPosition, this.screenPosition);

        gl.drawArrays(gl.TRIANGLES, 0, pointCount * 3);
    }

    drawLines(vertexBuffer, directionBuffer, otherDirectionBuffer, linePosBuffer, lineWidthBuffer, colorBuffer, pointCount) {
        if (!vertexBuffer) {
            return;
        }

        let gl = this.gl;

        let currentScale = this.screenSize;

        let program = this.linesProgram;

        gl.useProgram(program);

        let uScreenSize = gl.getUniformLocation(program, "uScreenSize");
        let uScreenPixelSize = gl.getUniformLocation(program, "uScreenPixelSize");
        let uScreenPosition = gl.getUniformLocation(program, "uScreenPosition");

        gl.uniform2fv(uScreenSize, currentScale);

        let aVertexColor = gl.getAttribLocation(program, "aVertexColor");
        let aVertexPosition = gl.getAttribLocation(program, "aVertexPosition");
        let aDirection = gl.getAttribLocation(program, "aDirection");
        let aOtherDirection = gl.getAttribLocation(program, "aOtherDirection");
        let aLineWidth = gl.getAttribLocation(program, "aLineWidth");
        let aLinePos = gl.getAttribLocation(program, "aLinePos");

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

        gl.uniform2fv(uScreenPixelSize, [1.0 / this.width, 1.0 / this.height]);
        gl.uniform2fv(uScreenPosition, this.screenPosition);

        gl.drawArrays(gl.TRIANGLE_STRIP, 0, pointCount);
    }

    drawPoints(vertexBuffer, pointSizeBuffer, colorBuffer, pointCount, shape) {
        if (!vertexBuffer) {
            return;
        }

        let gl = this.gl;

        let currentScale = this.screenSize;

        let program = this.pointsProgram;

        gl.useProgram(program);

        let uScreenSize = gl.getUniformLocation(program, "uScreenSize");
        let uScreenPixelSize = gl.getUniformLocation(program, "uScreenPixelSize");
        let uScreenPosition = gl.getUniformLocation(program, "uScreenPosition");
        let uZOffsetPx = gl.getUniformLocation(program, "uZOffsetPx");
        let uWOffsetPx = gl.getUniformLocation(program, "uWOffsetPx");

        gl.uniform2fv(uScreenSize, currentScale);

        let aVertexColor = gl.getAttribLocation(program, "aVertexColor");
        let aVertexPosition = gl.getAttribLocation(program, "aVertexPosition");
        let aPointSize = gl.getAttribLocation(program, "aPointSize");

        gl.bindBuffer(gl.ARRAY_BUFFER, vertexBuffer);
        gl.enableVertexAttribArray(aVertexPosition);
        gl.vertexAttribPointer(
            aVertexPosition,
            4,
            gl.FLOAT, false, 0, 0
        );

        gl.bindBuffer(gl.ARRAY_BUFFER, pointSizeBuffer);
        gl.enableVertexAttribArray(aPointSize);
        gl.vertexAttribPointer(
            aPointSize,
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

        gl.uniform2fv(uScreenPixelSize, [1.0 / this.width, 1.0 / this.height]);
        gl.uniform2fv(uScreenPosition, this.screenPosition);

        if (shape == "circle") {
            let segmentCount = 16;
            for (let i = 0; i < segmentCount; i++) {
                gl.uniform2fv(
                    uZOffsetPx,
                    [Math.cos(2.0 * Math.PI * i / segmentCount), Math.sin(2.0 * Math.PI * i / segmentCount)]
                )
                gl.uniform2fv(
                    uWOffsetPx,
                    [Math.cos(2.0 * Math.PI * (i + 1) / segmentCount),
                     Math.sin(2.0 * Math.PI * (i + 1) / segmentCount)]
                )
                gl.drawArrays(gl.TRIANGLES, 0, pointCount * 3);
            }
        } else {
            let width = 1;
            let height = 1;

            if (shape == "square") {
                // all set
            } else if (shape == "vertical_tick") {
                width = .2;
            } else if (shape == "horizontal_tick") {
                height = .2;
            }

            gl.uniform2fv(uZOffsetPx, [width, height])
            gl.uniform2fv(uWOffsetPx, [width, -height])
            gl.drawArrays(gl.TRIANGLES, 0, pointCount * 3);

            gl.uniform2fv(uZOffsetPx, [width, -height])
            gl.uniform2fv(uWOffsetPx, [-width,-height])
            gl.drawArrays(gl.TRIANGLES, 0, pointCount * 3);

            gl.uniform2fv(uZOffsetPx, [-width, -height])
            gl.uniform2fv(uWOffsetPx, [-width, height])
            gl.drawArrays(gl.TRIANGLES, 0, pointCount * 3);

            gl.uniform2fv(uZOffsetPx, [-width, height])
            gl.uniform2fv(uWOffsetPx, [width, height])
            gl.drawArrays(gl.TRIANGLES, 0, pointCount * 3);
        }
    }
}


export {GlRenderer};
