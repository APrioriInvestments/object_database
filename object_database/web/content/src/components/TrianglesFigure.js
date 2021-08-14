

class TrianglesFigure {
    constructor(xs, ys, color) {
        this.xs = xs;
        this.ys = ys;

        if (!(xs instanceof Float32Array)) {
            throw new Error("xys must be a Float32Array");
        }

        if (!(ys instanceof Float32Array)) {
            throw new Error("ys must be a Float32Array");
        }

        if (xs.length != ys.length) {
            throw new Error("xs and ys must have same length");
        }

        if (!(color instanceof Float32Array)) {
            throw new Error("color must be a Float32Array");
        }

        if (color.length != this.xs.length * 4) {
            throw new Error("color must have 4 elements per point");
        }

        this.color = color;

        this.triangleBuffer = null;
        this.colorBuffer = null;
        this.pointCount = null;

        this._buildBuffers = this._buildBuffers.bind(this);
    }

    _buildBuffers(renderer) {
        this.clear(renderer);

        let pointCount = this.xs.length / 3;

        let outTriangles = new Float32Array(new ArrayBuffer(4 * pointCount * 6));

        for (let i = 0; i < this.xs.length; i++) {
            outTriangles[i * 2] = this.xs[i];
            outTriangles[i * 2 + 1] = this.ys[i];
        }

        let gl = renderer.gl;

        this.triangleBuffer = gl.createBuffer();
        gl.bindBuffer(gl.ARRAY_BUFFER, this.triangleBuffer);
        gl.bufferData(gl.ARRAY_BUFFER, outTriangles, gl.STATIC_DRAW);

        this.colorBuffer = gl.createBuffer();
        gl.bindBuffer(gl.ARRAY_BUFFER, this.colorBuffer);
        gl.bufferData(gl.ARRAY_BUFFER, this.color, gl.STATIC_DRAW);

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
    }

    drawSelf(renderer) {
        if (!this.triangleBuffer) {
            let t0 = Date.now();
            this._buildBuffers(renderer);
            if (Date.now() - t0 > 100) {
                console.warn("Took " + (Date.now() - t0) + " to build our triangles.")
            }
        }

        renderer.drawTriangles(
            this.triangleBuffer,
            this.colorBuffer,
            this.pointCount
        );
    }
}

export {TrianglesFigure};
