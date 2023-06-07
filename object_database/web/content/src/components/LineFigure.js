

class LineFigure {
    constructor(xs, ys, lineWidth=1.0, color=null) {
        this.xs = xs;
        this.ys = ys;

        if (!(xs instanceof Float64Array)) {
            throw new Error("xys must be a Float64Array");
        }

        if (!(ys instanceof Float64Array)) {
            throw new Error("ys must be a Float64Array");
        }

        if (xs.length != ys.length) {
            throw new Error("xs and ys must have same length");
        }

        if (typeof(lineWidth) != 'number' && !(lineWidth instanceof Float64Array)) {
            throw new Error("lineWidth must be a float or a Float64Array");
        }

        if (!color) {
            this.color = new Float64Array([1.0, 1.0, 1.0, 1.0]);
        } else {
            if (!(color instanceof Float64Array)) {
                throw new Error("color must be a Float64Array");
            }

            if (color.length != 4 && color.length != this.xs.length * 4) {
                throw new Error("color must have either 4 elements, or 4 elements per point");
            }

            this.color = color;
        }

        if (lineWidth instanceof Float64Array) {
            if (this.xs.length != lineWidth.length) {
                throw new Error("lineWidth and xs must have the same total number of points");
            }

            this.lineWidth = lineWidth;
        } else {
            this.lineWidth = new Float64Array(new ArrayBuffer(8 * this.xs.length));

            for (let i = 0; i < this.xs.length; i++) {
                this.lineWidth[i] = lineWidth;
            }
        }

        this.triangleBuffer = null;
        this.directionBuffer = null;
        this.linePosBuffer = null;
        this.otherDirectionBuffer = null;
        this.lineWidthBuffer = null;
        this.colorBuffer = null;
        this.pointCount = null;

        this._buildBuffers = this._buildBuffers.bind(this);
    }

    _buildBuffers(renderer) {
        this.clear(renderer);

        let segmentCount = this.xs.length;
        let pointCount = segmentCount * 4;

        let outTriangles = new Float64Array(new ArrayBuffer(8 * pointCount * 3));
        let outDirection = new Float64Array(new ArrayBuffer(8 * pointCount * 2));
        let outOtherDirection = new Float64Array(new ArrayBuffer(8 * pointCount * 2));
        let outLinePos = new Float64Array(new ArrayBuffer(8 * pointCount));
        let outColors = new Float64Array(new ArrayBuffer(8 * pointCount * 4));
        let outLineWidth = new Float64Array(new ArrayBuffer(8 * pointCount));

        let curPoint = 0;

        let colorStride = 4;
        if (this.color.length == 4) {
            colorStride = 0;
        }

        for (let segmentIx = 0; segmentIx < segmentCount; segmentIx += 1) {
            let x0 = this.xs[segmentIx + 0];
            let y0 = this.ys[segmentIx + 0];

            let x1 = this.xs[segmentIx + 1];
            let y1 = this.ys[segmentIx + 1];

            // compute the prior line segment. If we go off the end, pretend the prior segment
            // was a mirror of our segment
            let xprev = segmentIx > 0 ? this.xs[segmentIx - 1] : x0 - (x1 - x0);
            let yprev = segmentIx > 0 ? this.ys[segmentIx - 1] : y0 - (y1 - y0);

            // compute the next segment, adding a mirror if we go off the end
            let xnext = segmentIx + 1 < segmentCount ? this.xs[segmentIx + 2] : x1 + (x1 - x0);
            let ynext = segmentIx + 1 < segmentCount ? this.ys[segmentIx + 2] : y1 + (y1 - y0);

            // write the lower left point
            outLinePos[curPoint] = 0.0;
            outTriangles[curPoint * 3 + 0] = x0;
            outTriangles[curPoint * 3 + 1] = y0;
            outTriangles[curPoint * 3 + 2] = -1.0;
            outDirection[curPoint * 2 + 0] = x1 - x0;
            outDirection[curPoint * 2 + 1] = y1 - y0;
            outOtherDirection[curPoint * 2 + 0] = x0 - xprev;
            outOtherDirection[curPoint * 2 + 1] = y0 - yprev;
            outLineWidth[curPoint] = this.lineWidth[segmentIx];
            outColors[curPoint * 4 + 0] = this.color[segmentIx * colorStride + 0];
            outColors[curPoint * 4 + 1] = this.color[segmentIx * colorStride + 1];
            outColors[curPoint * 4 + 2] = this.color[segmentIx * colorStride + 2];
            outColors[curPoint * 4 + 3] = this.color[segmentIx * colorStride + 3];
            curPoint += 1;

            // upper left point
            outLinePos[curPoint] = 0.0;
            outTriangles[curPoint * 3 + 0] = x0;
            outTriangles[curPoint * 3 + 1] = y0;
            outTriangles[curPoint * 3 + 2] = 1.0;
            outDirection[curPoint * 2 + 0] = x1 - x0;
            outDirection[curPoint * 2 + 1] = y1 - y0;
            outOtherDirection[curPoint * 2 + 0] = x0 - xprev;
            outOtherDirection[curPoint * 2 + 1] = y0 - yprev;
            outLineWidth[curPoint] = this.lineWidth[segmentIx];
            outColors[curPoint * 4 + 0] = this.color[segmentIx * colorStride + 0];
            outColors[curPoint * 4 + 1] = this.color[segmentIx * colorStride + 1];
            outColors[curPoint * 4 + 2] = this.color[segmentIx * colorStride + 2];
            outColors[curPoint * 4 + 3] = this.color[segmentIx * colorStride + 3];
            curPoint += 1;

            // write the lower right point
            outLinePos[curPoint] = 1.0;
            outTriangles[curPoint * 3 + 0] = x1;
            outTriangles[curPoint * 3 + 1] = y1;
            outTriangles[curPoint * 3 + 2] = -1.0;
            outDirection[curPoint * 2 + 0] = x1 - x0;
            outDirection[curPoint * 2 + 1] = y1 - y0;
            outOtherDirection[curPoint * 2 + 0] = xnext - x1;
            outOtherDirection[curPoint * 2 + 1] = ynext - y1;
            outLineWidth[curPoint] = this.lineWidth[segmentIx + 1];
            outColors[curPoint * 4 + 0] = this.color[(segmentIx + 1) * colorStride + 0];
            outColors[curPoint * 4 + 1] = this.color[(segmentIx + 1) * colorStride + 1];
            outColors[curPoint * 4 + 2] = this.color[(segmentIx + 1) * colorStride + 2];
            outColors[curPoint * 4 + 3] = this.color[(segmentIx + 1) * colorStride + 3];
            curPoint += 1;

            // write the upper right point
            outLinePos[curPoint] = 1.0;
            outTriangles[curPoint * 3 + 0] = x1;
            outTriangles[curPoint * 3 + 1] = y1;
            outTriangles[curPoint * 3 + 2] = 1.0;
            outDirection[curPoint * 2 + 0] = x1 - x0;
            outDirection[curPoint * 2 + 1] = y1 - y0;
            outOtherDirection[curPoint * 2 + 0] = xnext - x1;
            outOtherDirection[curPoint * 2 + 1] = ynext - y1;
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

        this.otherDirectionBuffer = gl.createBuffer();
        gl.bindBuffer(gl.ARRAY_BUFFER, this.otherDirectionBuffer);
        gl.bufferData(gl.ARRAY_BUFFER, outOtherDirection, gl.STATIC_DRAW);

        this.linePosBuffer = gl.createBuffer();
        gl.bindBuffer(gl.ARRAY_BUFFER, this.linePosBuffer);
        gl.bufferData(gl.ARRAY_BUFFER, outLinePos, gl.STATIC_DRAW);

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

        if (this.lineWidthBuffer) {
            if (!gl.isContextLost()) {
                gl.deleteBuffer(this.lineWidthBuffer);
            }
            this.lineWidthBuffer = null;
        }

        if (this.directionBuffer) {
            if (!gl.isContextLost()) {
                gl.deleteBuffer(this.directionBuffer);
            }
            this.directionBuffer = null;
        }

        if (this.otherDirectionBuffer) {
            if (!gl.isContextLost()) {
                gl.deleteBuffer(this.otherDirectionBuffer);
            }
            this.otherDirectionBuffer = null;
        }

        if (this.linePosBuffer) {
            if (!gl.isContextLost()) {
                gl.deleteBuffer(this.linePosBuffer);
            }
            this.linePosBuffer = null;
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

        renderer.drawLines(
            this.triangleBuffer,
            this.directionBuffer,
            this.otherDirectionBuffer,
            this.linePosBuffer,
            this.lineWidthBuffer,
            this.colorBuffer,
            this.pointCount
        );
    }
}

export {LineFigure};
