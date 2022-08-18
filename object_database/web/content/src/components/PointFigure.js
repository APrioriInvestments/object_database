

class PointFigure {
    constructor(xs, ys, pointSize=1.0, color=null, shape=null) {
        this.xs = xs;
        this.ys = ys;

        if (!shape) {
            this.shape = "circle";
        } else {
            this.shape = shape;
        }

        if (!(xs instanceof Float32Array)) {
            throw new Error("xys must be a Float32Array");
        }

        if (!(ys instanceof Float32Array)) {
            throw new Error("ys must be a Float32Array");
        }

        if (xs.length != ys.length) {
            throw new Error("xs and ys must have same length");
        }

        if (typeof(pointSize) != 'number' && !(pointSize instanceof Float32Array)) {
            throw new Error("pointSize must be a float or a Float32Array");
        }

        if (!color) {
            this.color = new Float32Array([1.0, 1.0, 1.0, 1.0]);
        } else {
            if (!(color instanceof Float32Array)) {
                throw new Error("color must be a Float32Array");
            }

            if (color.length != 4 && color.length != this.xs.length * 4) {
                throw new Error("color must have either 4 elements, or 4 elements per point");
            }

            this.color = color;
        }

        if (pointSize instanceof Float32Array) {
            if (this.xs.length != pointSize.length) {
                throw new Error("pointSize and xs must have the same total number of points");
            }

            this.pointSize = pointSize;
        } else {
            this.pointSize = new Float32Array(new ArrayBuffer(4 * this.xs.length));

            for (let i = 0; i < this.xs.length; i++) {
                this.pointSize[i] = pointSize;
            }
        }

        this.triangleBuffer = null;
        this.pointSizeBuffer = null;
        this.colorBuffer = null;
        this.pointCount = null;

        this._buildBuffers = this._buildBuffers.bind(this);
    }

    _buildBuffers(renderer) {
        this.clear(renderer);

        let pointCount = this.xs.length;

        let outTriangles = new Float32Array(new ArrayBuffer(4 * pointCount * 4 * 3));
        let outColors = new Float32Array(new ArrayBuffer(4 * pointCount * 4 * 3));
        let outSizes = new Float32Array(new ArrayBuffer(4 * pointCount * 3));

        let curPoint = 0;

        let colorStride = 4;
        if (this.color.length == 4) {
            colorStride = 0;
        }

        for (let pointIx = 0; pointIx < pointCount; pointIx += 1) {
            let x0 = this.xs[pointIx];
            let y0 = this.ys[pointIx];

            outTriangles[curPoint * 4 + 0] = x0;
            outTriangles[curPoint * 4 + 1] = y0;
            outTriangles[curPoint * 4 + 2] = 0.0;
            outTriangles[curPoint * 4 + 3] = 0.0;
            outColors[curPoint * 4 + 0] = this.color[pointIx * colorStride + 0];
            outColors[curPoint * 4 + 1] = this.color[pointIx * colorStride + 1];
            outColors[curPoint * 4 + 2] = this.color[pointIx * colorStride + 2];
            outColors[curPoint * 4 + 3] = this.color[pointIx * colorStride + 3];
            outSizes[curPoint] = this.pointSize[pointIx];
            curPoint += 1;

            outTriangles[curPoint * 4 + 0] = x0;
            outTriangles[curPoint * 4 + 1] = y0;
            outTriangles[curPoint * 4 + 2] = 1.0;
            outTriangles[curPoint * 4 + 3] = 0.0;
            outColors[curPoint * 4 + 0] = this.color[pointIx * colorStride + 0];
            outColors[curPoint * 4 + 1] = this.color[pointIx * colorStride + 1];
            outColors[curPoint * 4 + 2] = this.color[pointIx * colorStride + 2];
            outColors[curPoint * 4 + 3] = this.color[pointIx * colorStride + 3];
            outSizes[curPoint] = this.pointSize[pointIx];
            curPoint += 1;

            outTriangles[curPoint * 4 + 0] = x0;
            outTriangles[curPoint * 4 + 1] = y0;
            outTriangles[curPoint * 4 + 2] = 0.0;
            outTriangles[curPoint * 4 + 3] = 1.0;
            outColors[curPoint * 4 + 0] = this.color[pointIx * colorStride + 0];
            outColors[curPoint * 4 + 1] = this.color[pointIx * colorStride + 1];
            outColors[curPoint * 4 + 2] = this.color[pointIx * colorStride + 2];
            outColors[curPoint * 4 + 3] = this.color[pointIx * colorStride + 3];
            outSizes[curPoint] = this.pointSize[pointIx];
            curPoint += 1;
        }

        if (curPoint != pointCount * 3) {
            console.error("POINT COUNT WRONG")
            throw new Error("Triangles didn't add up");
        }

        let gl = renderer.gl;

        this.triangleBuffer = gl.createBuffer();
        gl.bindBuffer(gl.ARRAY_BUFFER, this.triangleBuffer);
        gl.bufferData(gl.ARRAY_BUFFER, outTriangles, gl.STATIC_DRAW);

        this.colorBuffer = gl.createBuffer();
        gl.bindBuffer(gl.ARRAY_BUFFER, this.colorBuffer);
        gl.bufferData(gl.ARRAY_BUFFER, outColors, gl.STATIC_DRAW);

        this.pointSizeBuffer = gl.createBuffer();
        gl.bindBuffer(gl.ARRAY_BUFFER, this.pointSizeBuffer);
        gl.bufferData(gl.ARRAY_BUFFER, outSizes, gl.STATIC_DRAW);

        this.pointCount = pointCount;
    }

    clear(renderer) {
        let gl = renderer.gl;

        if (this.colorBuffer) {
            if (!gl.isContextLost()) {
                gl.deleteBuffer(this.colorBuffer);
            }
            this.colorBuffer = null;
        }

        if (this.triangleBuffer) {
            if (!gl.isContextLost()) {
                gl.deleteBuffer(this.triangleBuffer);
            }
            this.triangleBuffer = null;
        }

        if (this.pointSizeBuffer) {
            if (!gl.isContextLost()) {
                gl.deleteBuffer(this.pointSizeBuffer);
            }
            this.pointSizeBuffer = null;
        }
    }

    drawSelf(renderer) {
        if (!this.triangleBuffer) {
            let t0 = Date.now();
            this._buildBuffers(renderer);
            if (Date.now() - t0 > 100) {
                console.warn("Took " + (Date.now() - t0) + " to build our triangles.")
            }
        }

        renderer.drawPoints(
            this.triangleBuffer,
            this.pointSizeBuffer,
            this.colorBuffer,
            this.pointCount,
            this.shape
        );
    }
}

export {PointFigure};
