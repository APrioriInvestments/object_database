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

    get isNaN() {
        if (this._values.length === 2){
            return false;
        }
        return true;
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
         * corner.x >= origin.x AND corner.y <= origin.y will lead an non-empty
         * non-zero dimensional frame.IE we stick the basic bitmap conventions of
         * origin as top-left and corner as bottom-right.
         */
        this.origin = new Point(origin);
        this.corner = new Point(corner);
        if (origin && corner) {
            if (this.origin.quadrant !== 1 || this.corner.quadrant !== 1){
                throw "Both 'origin' and 'corner' must be of non-negative coordinates"
            }
            if (this.origin.x > this.corner.x || this.origin.y > this.corner.y){
                throw "Origin must be top-left and corner bottom-right"
            }
        }

        // Bind methods
        this.intersect = this.intersect.bind(this);
        this.translate = this.translate.bind(this);
        this._empty = this._empty.bind(this);
    }

    /* The dimension of the frame. */
    get dim(){
        if (this._empty()){
            return new Point([0, 0]);
        }
        let x = this.corner.x - this.origin.x + 1;
        let y = this.corner.y - this.origin.y + 1;
        return new Point([Math.max(0, x), Math.max(0, y)]);
    }

    /* check if the frame is empty. */
    get empty(){
        return this._empty();
    }

    _empty(){
        if (this.origin.isNaN || this.corner.isNaN){
            return true;
        }
        return false;
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

    /* I check whether the point (as Point of tuple of coordinates)
     * or Frame is contained in this.
     */
    contains(other){
        if (other instanceof Array){
            other = Point(other);
        }
        // TODO
        if (other instanceof Point) {
            if (other.x >= this.origin.x && other.x <= this.corner.x
                && other.y >= this.corner.y && other.y <= this.origin.y){
                return true;
            }
        }
    }

    /* I translate myself in the given [x, y] direction */
    translate(xy){
        this.origin.x += xy[0];
        this.corner.x += xy[0];
        this.origin.y += xy[1];
        this.corner.y += xy[1];
        if (this.origin.x > this.corner.x || this.origin.y > this.corner.y){
            throw "Invalid translation: new origin must be top-left and corner bottom-right"
        }
    }

    /* I return a frame that is the intersection of myself and another. */
    intersect(frame){
        if (this.empty || frame.empty){
            return new Frame();
        }

    }
}

export {Point, Frame}
