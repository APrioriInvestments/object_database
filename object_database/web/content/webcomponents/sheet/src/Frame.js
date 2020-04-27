/**
 * APSheet Frame Class
 * ---------------------------
 * A Frame is a simple representation of
 * a rectangle based upon Points.
 * A Frame holds two primary points:
 *    - origin: the topleft corner
 *    - corner: the bottomright corner
 * These two points are enough to make
 * calculations about other features of the Frame.
 */
import {Point, isCoordinate} from './Point.js';

const validateGeometry = (origin, corner) => {
    if(origin.x > corner.x || origin.y > corner.y){
        throw "Origin must be top-left and corner must be bottom-right";
    }
};

class Frame {
    constructor(origin, corner){
        this.origin = new Point(origin);
        this.corner = new Point(corner);
        validateGeometry(this.origin, this.corner);

        this.isFrame = true;
        this.isEmpty = false;

        // Bind instance methods
        this.contains = this.contains.bind(this);
        this.equals = this.equals.bind(this);
        this.translate = this.translate.bind(this);
        this.intersection = this.intersection.bind(this);
        this.union = this.union.bind(this);
        this.copy = this.copy.bind(this);
        this.forEachPoint = this.forEachPoint.bind(this);
        this.forEachCoordinate = this.forEachCoordinate.bind(this);
        this.mapEachPoint = this.mapEachPoint.bind(this);
        this.mapEachCoordinate = this.mapEachCoordinate.bind(this);
        this.forEachCoordinateRow = this.forEachCoordinateRow.bind(this);
        this.forEachPointRow = this.forEachPointRow.bind(this);
    }

    /**
     * Checks whether or not the current
     * instance circumscribes or contains
     * the provided argument. Argument can
     * be a Point, Array, or another Frame.
     * @param {Array|Point|Frame} aPointOrFrame - The
     * object to check for inclusion in the Frame
     * @returns {boolean}
     */
    contains(aPointOrFrame){
        if(this.isEmpty){
            return false;
        }
        if(aPointOrFrame.isPoint){
            let validX = (aPointOrFrame.x >= this.origin.x && aPointOrFrame.x <= this.corner.x);
            let validY = (aPointOrFrame.y >= this.origin.y && aPointOrFrame.y <= this.corner.y);
            return (validX && validY);
        } else if(aPointOrFrame.isFrame){
            return (this.contains(aPointOrFrame.origin) && this.contains(aPointOrFrame.corner));
        } else if(isCoordinate(aPointOrFrame)){
            let validX = aPointOrFrame[0] >= this.origin.x && aPointOrFrame[0] <= this.corner.x;
            let validY = aPointOrFrame[1] >= this.origin.y && aPointOrFrame[1] <= this.corner.y;
            return validX && validY;
        }
        return false;
    }

    /**
     * Returns true if the Frame given in
     * the argument has the same origin and
     * corner values as this instance.
     * @param {Frame} otherFrame - The other Frame
     * to compare this instance to
     * @returns {boolean}
     */
    equals(otherFrame){
        if(this.isEmpty && otherFrame.isEmpty){
            return true;
        } else if(this.isEmpty || otherFrame.isEmpty){
            return false;
        }
        return (this.origin.equals(otherFrame.origin)
                && this.corner.equals(otherFrame.corner));
    }

    /**
     * Given a Point, this method translates
     * the origin and corner of the current
     * Frame instance. If the inPlace argument
     * is false, we return a new translated
     * Frame instance instead of modifying the
     * current instance.
     * @param {Point} translationPoint - A Point
     * representing how each of the x,y dimensions
     * will be translated
     * @param {boolean} inPlace - Whether or not to
     * modify the current instance or return a new
     * Frame instance.
     * @returns {Frame}
     */
    translate(translationPoint, inPlace=true){
        if(this.isEmpty){
            if(inPlace){
                return this;
            }
            return this.constructor.newEmpty();
        }
        if(inPlace){
            let newFrame = new Frame(this.origin, this.corner);
            newFrame.translate(translationPoint, false);
            return newFrame;
        }
        this.corner.x += translationPoint.x;
        this.corner.y += translationPoint.y;
        this.origin.x += translationPoint.x;
        this.origin.y += translationPoint.y;
        return this;
    }

    /**
     * Returns a new Frame that represents the
     * intersection of the current instance and
     * the Frame passed in as an argument.
     * If there is no valid intersection, it
     * returns a new empty Frame.
     * @param {Frame} otherFrame - A Frame to
     * compare for intersectionality
     * @returns {Frame} - A new Frame instance
     * that represents the intersection of myself
     * and the passed-in Frame. Will be an empty
     * Frame if there is no intersection
     */
    intersection(otherFrame){
        if(this.isEmpty || otherFrame.isEmpty){
            return this.constructor.newEmpty();
        }

        if(this.contains(otherFrame)){
            /*
             * TTTTTTTT
             * TTOOOTTT
             * TTOOOTTT
             * TTOOOTTT
             * TTTTTTTT
             */
            return new Frame(otherFrame.origin, otherFrame.corner);
        }

        if(otherFrame.contains(this)){
            /*
             * OOOOOOOO
             * OOTTTOOO
             * OOTTTOOO
             * OOTTTOOO
             * OOOOOOOO
             */
            return new Frame(this.origin, this.corner);
        }

        if(this.contains(otherFrame.origin) && otherFrame.contains(this.corner)){
            /*
              * TTTTTT
              * TTTOOOOOO
              * TTTOOOOOO
              * TTTOOOOOO
              *    OOOOOO
              */
            return new Frame(otherFrame.origin, this.corner);
        }

        if(otherFrame.contains(this.origin) && this.contains(otherFrame.corner)){
            /*
              * OOOOOO
              * OOOOOO
              * OOOTTTTTT
              * OOOTTTTTT
              *    TTTTTT
              *    TTTTTT
              */
            return new Frame(this.origin, otherFrame.corner);
        }

        // If we get here, we possibly have a more complex
        // intersection (at top right, bottom left, etc).
        // We create a union frame and then get the min and
        // max for all intersection points
        let unionFrame = this.union(otherFrame);
        let intersectPoints = unionFrame.points.filter(aPoint => {
            return (this.contains(aPoint) && otherFrame.contains(aPoint));
        });
        if(intersectPoints.length > 0){
            let xVals = intersectPoints.map(aPoint => {
                return aPoint.x;
            });
            let yVals = intersectPoints.map(aPoint => {
                return aPoint.y;
            });
            let newOrigin = new Point([
                Math.min(...xVals),
                Math.min(...yVals)
            ]);
            let newCorner = new Point([
                Math.max(...xVals),
                Math.max(...yVals)
            ]);
            return new Frame(newOrigin, newCorner);
        }

        return this.constructor.newEmpty();
    }

    /**
     * Returns a new Frame instance that
     * encloses the total areas of both
     * this frame and the incoming frame
     * @param {Frame} otherFrame - A Frame
     * instance that will be used to compute
     * the union between it and myself
     * @returns {Frame} - A new Frame instance
     * representing the enclosure of myself and
     * the passed in Frame.
     */
    union(otherFrame){
        let cornerX;
        let cornerY;
        let originX;
        let originY;

        let newOrigin = new Point([
            Math.min(this.origin.x, otherFrame.origin.x),
            Math.min(this.origin.y, otherFrame.origin.y)
        ]);

        let newCorner = new Point([
            Math.max(this.corner.x, otherFrame.corner.x),
            Math.max(this.corner.y, otherFrame.corner.y)
        ]);

        return new Frame(newOrigin, newCorner);
    }

    /**
     * Run the specified callback with each Point
     * in the Frame's total collection of points.
     * @param {function} callback - The function
     * to call over each point.
     */
    forEachPoint(callback){
        if(this.isEmpty){
            return;
        }
        for(let x = this.origin.x; x <= this.corner.x; x++){
            for(let y = this.origin.y; y <= this.corner.y; y++){
                callback(new Point([x,y]));
            }
        }
    }

    /**
     * Accumulate the result of the specified callback
     * in an array that we return for each Point
     * in the Frame's total collection of points.
     * @param {function} callback - The function to
     * call whose return value will be accumulated
     * in a result array.
     * @returns {Array} An accumulated array of
     * objects.
     */
    mapEachPoint(callback){
        let result = [];
        this.forEachPoint(point => {
            result.push(callback(point));
        });
        return result;
    }

    /**
     * Call the incoming callback function
     * for each Coordinate created from the
     * Frame's total collection of Points.
     * @param {function} callback - The function
     * to call on each coordinate array
     */
    forEachCoordinate(callback){
        if(this.isEmpty){
            return;
        }
        for(let x = this.origin.x; x <= this.corner.x; x++){
            for(let y = this.origin.y; y <= this.corner.y; y++){
                callback([x, y]);
            }
        }
    }

    /**
     * Accumulate the result of the specified callback
     * in an array as it is applied to each coordinate
     * in the frame's total collection of points.
     * @param {function} callback - The function to call
     * whose return value will be accumulated in the
     * result array.
     * @returns {Array} The resulting array of mapped return
     * valued from the callback
     */
    mapEachCoordinate(callback){
        let result = [];
        this.mapEachCoordinate(coordinate => {
            result.push(callback(coordinate));
        });
        return result;
    }

    /**
     * I loop through each "row" of Coordinates inside
     * myself and call the passed-in callback
     * with the array of Coordinates and the row
     * index as the two aarguments.
     * @param {function} callback - A function whose
     * arguments will be an array of Coordinates and
     * the row index
     */
    forEachCoordinateRow(callback){
        if(this.isEmpty){
            return;
        }
        for(let y = this.origin.y; y <= this.corner.y; y++){
            let row = [];
            for(let x = this.origin.x; x <= this.corner.x; x++){
                row.push([x,y]);
            }
            callback(row, y);
        }
    }

    /**
     * I loop through each "row" of Points inside
     * myself and call the passed-in callback
     * with the array of Points and the row
     * index as the two aarguments.
     * @param {function} callback - A function whose
     * arguments will be an array of Points and
     * the row index
     */
    forEachPointRow(callback){
        this.forEachCoordinateRow((row, rowIndex) => {
            let pointRow = row.map(col => {
                return new Point(col);
            });
            callback(pointRow, rowIndex);
        });
    }

    /**
     * Returns an array of Points that are
     * mapped to all Points contained within
     * the Frame.
     * The order is from the x dimension first.
     * @returns {[Point]} - An array of Points
     */
    get points(){
        let points = [];
        if(!this.isEmpty){
            for(let x = this.origin.x; x <= this.corner.x; x++){
                for(let y = this.origin.y; y <= this.corner.y; y++){
                    points.push(new Point([x, y]));
                }
            }
        }
        return points;
    }

    /**
     * Returns an array of Coordinate pairs
     * that are mapped to all points contained
     * within this Frame.
     * The order is from the x dimension first.
     * @returns {[Array]} - An array of coordinate
     * pairs
     */
    get coordinates(){
        let coordinates = [];
        if(!this.isEmpty){
            for(let x = this.origin.x; x <= this.corner.x; x++){
                for(let y = this.origin.y; y <= this.corner.y; y++){
                    coordinates.push([x, y]);
                }
            }
        }
        return coordinates;
    }

    /**
     * Returns a Point corresponding
     * to the size in dimensions, x
     * being width and y being height.
     * Will return Point(0,0) for empty
     * Frames.
     * @returns {Point} - A Point representing
     * my size
     */
    get size(){
        if(this.isEmpty){
            return new Point([0,0]);
        }
        let x = (this.corner.x) - this.origin.x;
        let y = (this.corner.y) - this.origin.y;
        return new Point([x,y]);
    }

    /**
     * Return the number of dimensions for
     * the current Frame.
     * Note that a Frame with identical
     * origin and corner is not necessarily
     * 'empty' (0-dimensional), as it can
     * contain a single point (cell) which
     * is actually 1 dimensional.
     * @returns {number} - A number representing
     * my total number of dimensions
     */
    get dimensions(){
        if(this.isEmpty){
            return 0;
        }
        if(this.origin.equals(this.corner)){
            return 1;
        }
        return 2;
    }

    /**
     * Returns the total number of contained
     * Points/coordinates given the current
     * origin and corner values.
     * @returns {number} - A number representing
     * my total number of contained Points
     */
    get area(){
        if(this.isEmpty){
            return 0;
        }
        let maxX = (this.corner.x - this.origin.x) + 1;
        let maxY = (this.corner.y - this.origin.y) + 1;
        return maxX * maxY;
    }

    /* Convenience Getters */
    get left(){
        return this.origin.x;
    }

    get right(){
        return this.corner.x;
    }

    get top(){
        return this.origin.y;
    }

    get bottom(){
        return this.corner.y;
    }

    get topLeft(){
        return new Point(this.origin);
    }

    get topRight(){
        return new Point([
            this.corner.x,
            this.origin.y
        ]);
    }

    get bottomLeft(){
        return new Point([
            this.origin.x,
            this.corner.y
        ]);
    }

    get bottomRight(){
        return new Point(this.corner);
    }

    /**
     * Return a new instance with the
     * same origin, corner, and empty
     * values as myself.
     * @returns {Frame} - A new Frame instance
     * that has my same origin, corner, and
     * isEmpty values
     */
    copy(){
        let copyFrame = new Frame(
            this.origin,
            this.corner
        );
        copyFrame.isEmpty = this.isEmpty;
        return copyFrame;
    }

    /**
     * Provide some comprehensible string
     * representation of the frame
     * @returns {String} - The string
     * representation of myself
     */
    toString(){
        if(this.isEmpty){
            return `Frame(empty)`;
        }
        return `Frame(${this.origin}, ${this.corner})`;
    }

    /**
     * Class method for constructing a new
     * empty Frame.
     * @returns {Frame} - A new Frame instance
     * that has a 0,0 origin and corner and
     * that is set to empty.
     */
    static newEmpty(){
        let newFrame = new this([0,0], [0,0]);
        newFrame.isEmpty = true;
        return newFrame;
    }

    /**
     * Creates a new Frame instance based on two
     * Points. Unlike the regular constructor, these
     * points to not have to be the origin and corner,
     * but could be any of the four corners.
     * @param {Point|Coordinate} firstPoint - a Point
     * or coordinate representing one possible corner
     * of the desired Frame
     * @param {Point|Coordinate} secondPoint - a Point
     * or coordinate representing another possible
     * corner of the desired Frame
     * @returns {Frame} - A new Frame instance that has
     * the correctly computed origin and corner
     */
    static fromPointToPoint(firstPoint, secondPoint){
        if(firstPoint.equals(secondPoint)){
            return new Frame(firstPoint, secondPoint);
        }
        let origin = new Point([
            Math.min(firstPoint.x, secondPoint.x),
            Math.min(firstPoint.y, secondPoint.y)
        ]);

        let corner = new Point([
            Math.max(firstPoint.x, secondPoint.x),
            Math.max(firstPoint.y, secondPoint.y)
        ]);

        return new this(origin, corner);
    }

    /**
     * I create a naw Frame with 0,0 origin
     * and the correct size according to the
     * passed-in dimensions.
     * @param {number} width - The desired width
     * of the new Frame
     * @param {number} height - The desired height
     * of thw new Frame
     * @returns {Frame} - A new Frame instance with
     * the correct origin and corner
     */
    static newOfSize(width, height){
        // We return -1 for each
        // dimension because Frame
        // is zero-indexed
        return new this(
            [0,0],
            [width-1, height-1]
        );
    }
}

export {
    Frame as default,
    Frame
};
