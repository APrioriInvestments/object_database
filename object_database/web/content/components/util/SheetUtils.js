/**
 * Utility Classes and Methods for
 * Sheet Component
 */

class Point {
    constructor(listOfTwo){
        this._values = [];
        if(listOfTwo){
            this._values[0] = listOfTwo[0];
            this._values[1] = listOfTwo[1];
        }

        // Bind methods
    }

    get x(){
        return this._values[0];
    }

    get y(){
        return this._values[1];
    }

    get quadrant(){
        if (this._values.length !== 2){
            return NaN;
        }
        // Note we put [0, 0] in the first quadrant by convention
        // In general our convention is greed with respect to the
        // quadrant order of 1, 2, 3, 4
        if (this._values[0] >= 0 && this._values[1] >= 0){
            return 1;
        } else if (this._values[0] >= 0 && this._values[1] < 0){
            return 2;
        } else if (this._values[0] < 0 && this._values[1] <= 0){
            return 3;
        } else if (this._values[0] < 0 && this._values[1] > 0){
            return 4;
        }
    }

    set x(val){
        this._values[0] = val;
    }

    set y(val){
        this._values[1] = val;
    }
}


class Frame {
    constructor(origin, corner){
        /* Origin and corner can be any points on the 2d cartensian grid.
         * However, only points in the first quadrant and those where
         * corner.x >= origin.x AND corner.y >= origin.y will lead an non-empty
         * non-zero dimensional frame.
         */
        this.origin = new Point(origin);
        this.corner = new Point(corner);


        // Bind methods
        this.intersect = this.intersect.bind(this);
        this.translate = this.translate.bind(this);
    }

    /* The dimension of the frame. */
    get dim(){
        if (this.corner.quadrant !== 1 || this.corner.quadrant !== 1){
            return new Point([0, 0]);
        }
        let x = this.corner.x - this.origin.x + 1;
        let y = this.corner.y - this.origin.y + 1;
        return new Point([Math.max(0, x), Math.max(0, y)]);
    }

    /* Set the origin */
    set setOrigin(xy){
        this.origin = new Point(xy);
    }

    /* Set the corner */
    set setCorner(xy){
        this.corner = new Point(xy);
    }

    /* Returns an array of relative (to the frame's origin and corner)
     * coordinate pairs.
     */
    get coords() {
        let coords = [];
        if (this.corner.quadrant !== 1 || this.corner.quadrant !== 1){
            return coords;
        }
        for (let x = this.origin.x; x <= this.corner.x; x++){
            for (let y = this.origin.y; y <= this.corner.y; y++){
                coords.push(new Point([x, y]));
            }
        }
        return coords;
    }

    /* I translate myself in the given [x, y] direction */
    translate(xy){
        // this.setOrigin([this.origin.x + x, this.corner.x + x]);
        // this.setCorner([this.origin.y + y, this.corner.y + y]);
        this.origin.x += xy[0];
        this.corner.x += xy[0];
        this.origin.y += xy[1];
        this.corner.y += xy[1];
    }

    /* I return a frame that is the intersection of myself and another. */
    intersect(frame){
        // TODO

    }
}

export {Point, Frame}
