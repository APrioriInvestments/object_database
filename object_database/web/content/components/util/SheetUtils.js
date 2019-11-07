/**
 * Utility Classes and Methods for
 * Sheet Component
 */

class Point {
    constructor(listOfTwo){
        this._values = [];
        if(listOfTwo){
            if(listOfTwo instanceof Array){
                this._values[0] = listOfTwo[0];
                this._values[1] = listOfTwo[1];
            } else if (listOfTwo instanceof Point){
                this._values[0] = listOfTwo.x;
                this._values[1] = listOfTwo.y;
            }
        }

        // Bind methods
        this.equals = this.equals.bind(this);
        this.toString = this.toString.bind(this);
    }

    get x(){
        return this._values[0];
    }

    get y(){
        return this._values[1];
    }

    get isNaN() {
        let condition = [this._values.length === 2,
            this._values[0] !== null,
            this._values[0] !== undefined,
            this._values[1] !== null,
            this._values[1] !== undefined];
        if (condition.every((item) => {return item === true})){
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

    equals(point){
        if (this._values[0] === point.x && this._values[1] === point.y){
            return true;
        }
        return false;
    }

    toString(){
        if (this.isNaN){
            return "NaN";
        }
        return `${this._values[0]},${this._values[1]}`;
    }
}


class Frame {
    constructor(origin, corner){
        /* Origin and corner can be any points in the first quadrant. Only those where
         * corner.x >= origin.x AND corner.y <= origin.y will lead an non-empty
         * non-zero dimensional frame.IE we stick the basic bitmap conventions of
         * origin as top-left and corner as bottom-right.
         */
        this.origin = new Point(origin);
        this.corner = new Point(corner);
        if (!this.origin.isNaN && !this.corner.isNaN) {
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
        this.coords_slice = this.coords_slice.bind(this);
    }

    /* The "dimension" of the frame.
        * Note: this is really the min dimension of a plan this frame
        * can be embedded in.
        */
    get dim(){
        if (this._empty()){
            return NaN;
        }
        let dim = 0;
        if (this.corner.x - this.origin.x > 0){
            dim += 1;
        }
        if (this.corner.y - this.origin.y > 0){
            dim += 1;
        }
        return dim;
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
        for (let x = this.origin.x; x <= this.corner.x; x++){
            for (let y = this.origin.y; y <= this.corner.y; y++){
                coords.push(new Point([x, y]));
            }
        }
        return coords;
    }

    /* I slice the frame along a given axis at a given rown and return
     * corresponding coordinates. For example, Frame([0, 0], [10, 10]).slice(5, "y")
     * will return a list [[5, 0], ... [5, 10]]
     */
    coords_slice(index, axis) {
        let coords = [];
        if (axis === "y"){
            if (index > this.corner.x || index < this.origin.x){
                throw "Index out of range"
            }
            for(let y = this.origin.y; y <= this.corner.y; y++){
                coords.push(new Point(index, y));
            }
        } else if (axis === "x"){
            for(let x = this.origin.x; x <= this.corner.x; x++){
                coords.push(new Point(x, index));
            }
        }
        return coords;
    }

    /* I check whether the point (as Point, tuple of coordinates, or
     * string representaiton of tuple of coordinates)
     * or Frame is contained in this.
     */
    contains(other){
        if (other instanceof String || typeof(other) === "string") {
            other = new Point(other.split(',').map((item) => {return parseInt(item)}));
        } else if (other instanceof Array){
            other = new Point(other);
        }
        if (other instanceof Point) {
            return (other.x >= this.origin.x && other.x <= this.corner.x
                && other.y <= this.corner.y && other.y >= this.origin.y)
        } else if (other instanceof Frame) {
            return this.contains(other.origin) && this.contains(other.corner)
        }
        throw "You must pass a length 2 array, a Point, or a Frame"
    }

    /* I check whether this frame matches this. */
    equals(frame){
        if (this.origin.equals(frame.origin) && this.corner.equals(frame.corner)){
            return true;
        }
        return false;
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
        if (this.contains(frame.origin)){
            if (this.contains(frame.corner)){
                return frame;
            } else {
                return new Frame(frame.origin, this.corner);
            }
        } else if (frame.contains(this.origin)){
            if (frame.contains(this.corner)){
                return this;
            } else {
                return new Frame(this.origin, frame.corner);
            }
        }
        return new Frame();
    }
}


class DataFrame extends Frame {
    constructor(origin, corner){
        /* Origin and corner can be any points in the first quadrant. Only those where
         * corner.x >= origin.x AND corner.y <= origin.y will lead an non-empty
         * non-zero dimensional frame. IE we stick the basic bitmap conventions of
         * origin as top-left and corner as bottom-right.
         */
        super(origin, corner);

        this.store = {};

        // bind context methods
        this.load = this.load.bind(this);
    }

    /* I load an array of arrays of data. Data coordinates (keys) are
     * defined by the 'origin' point where data.length corresponds to
     * the y axis (offset by origin.y) and data[N] corresponds to the
     * x-axis (offset by origin.x)
     */
    load(data, origin){
        if (origin instanceof Array){
            origin = new Point(origin);
        }
        if (origin.y > this.corner.y || origin.x > this.corner.x){
            throw "Origin is outside of frame."
        }
        // check to make sure we are not out of the frame
        if (data.length + origin.y - 1> this.corner.y){
            throw "Data + origin surpass frame y-dimension."
        }
        // iterate over the data and update the store; make sure to offset the
        // coordintates properly
        for (let y = 0; y < data.length; y++){
            let x_slice = data[y];
            for (let x = 0; x < x_slice.length; x++){
                if (x + origin.x > this.corner.x){
                    throw "Data + origin surpass frame x-dimension."
                }
                let coord = [x + origin.x, y + origin.y];
                coord = coord.toString();
                this.store[coord] = x_slice[x];
            }
        }
    }

    /* I retrieve the corresponding frame.store value. */
    get(coordinate){
        if (!this.contains(coordinate)){
            throw "Coordinate not in frame."
        }
        if (coordinate instanceof Array || coordinate instanceof Point){
            coordinate = coordinate.toString();
        }
        return this.store[coordinate];
    }
}


export {Point, Frame, DataFrame}
