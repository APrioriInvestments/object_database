

class ImageFigure {
    constructor(position, pixelsWide, imageData) {
        this.position = position;
        this.pixelsWide = pixelsWide;
        this.imageData = imageData;

        this.texture = null;

        this.triangleBuffer = null;

        this._buildBuffers = this._buildBuffers.bind(this);
    }

    _buildBuffers(renderer) {
        this.clear(renderer);

        let gl = renderer.gl;

        this.texture = gl.createTexture();
        gl.bindTexture(gl.TEXTURE_2D, this.texture);

        gl.texImage2D(
            gl.TEXTURE_2D,
            0,
            gl.RGBA,
            this.pixelsWide,
            this.imageData.length / 4 / this.pixelsWide,
            0,
            gl.RGBA,
            gl.UNSIGNED_BYTE,
            this.imageData
        );
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);

        this.triangleBuffer = gl.createBuffer();
        gl.bindBuffer(gl.ARRAY_BUFFER, this.triangleBuffer);
        gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([0.0, 0.0, 0.0, 1.0, 1.0, 0.0, 1.0, 1.0]), gl.STATIC_DRAW);
    }

    clear(renderer) {
        let gl = renderer.gl;

        if (this.texture) {
            gl.deleteTexture(this.texture);
            this.texture = null;
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

        renderer.drawImage(
            this.triangleBuffer,
            this.texture,
            this.position
        );
    }
}

export {ImageFigure};
