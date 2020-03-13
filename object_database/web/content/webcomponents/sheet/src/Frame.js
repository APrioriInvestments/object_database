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
import Point from './Point.js';

const validateGeometry = (corner, origin) => {
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

        // Bind instance methods
        this.contains = this.contains.bind(this);
        this.equals = this.equals.bind(this);
        this.translate = this.translate.bind(this);
        this.intersection = this.intersection.bind(this);
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
        if(aPointOrFrame.isPoint){
            let validX = (aPointOrFrame.x >= this.origin.x && aPointOrFrame.x <= this.corner.x);
            let validY = (aPointOrFrame.y >= this.origin.y && aPointOrFrame.y <= this.corner.y);
            return (validX && validY);
        } else if(aPointOrFrame.isFrame){
            return (this.contains(aPointOrFrame.origin) && this.contains(aPointOrFrame.corner));
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
     */
    intersection(otherFrame){
        if(this.isEmpty || otherFrame.isEmpty){
            return this.constructor.newEmpty();
        }

        if(this.contains(otherFrame)){
            return new Frame(otherFrame.origin, otherFrame.corner);
        }

        if(otherFrame.contains(this)){
            return new Frame(this.origin, this.corner);
        }

        if(this.contains(otherFrame.origin)){
            return new Frame(otherFrame.origin, this.corner);
        }

        if(otherFrame.contains(this.origin)){
            return new Frame(this.origin, otherFrame.corner);
        }

        return this.constructor.newEmpty();
    }

    /**
     * Run the specified callback with each Point
     * in the Frame's total collection of points.
     * @param {function} callback - The function
     * to call over each point.
     */
    forEachPoint(callback){
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

    forEachCoordinateRow(callback){
        for(let y = this.origin.y; y <= this.corner.y; y++){
            let row = [];
            for(let x = this.origin.x; x <= this.corner.x; x++){
                row.push([x,y]);
            }
            callback(row, y);
        }
    }

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
     */
    get points(){
        let points = [];
        for(let x = this.origin.x; x <= this.corner.x; x++){
            for(let y = this.origin.y; y <= this.corner.y; y++){
                points.push(new Point([x, y]));
            }
        }
        return points;
    }

    /**
     * Returns an array of Coordinate pairs
     * that are mapped to all points contained
     * within this Frame.
     * The order is from the x dimension first.
     */
    get coordinates(){
        let coordinates = [];
        for(let x = this.origin.x; x <= this.corner.x; x++){
            for(let y = this.origin.y; y <= this.corner.y; y++){
                coordinates.push([x, y]);
            }
        }
    }

    /**
     * Returns a Point corresponding
     * to the size in dimensions, x
     * being width and y being height.
     * Will return Point(0,0) for empty
     * Frames.
     */
    get size(){
        if(this.isEmpty){
            return new Point([0,0]);
        }
        let x = this.corner.x - this.origin.x;
        let y = this.corner.y - this.origin.y;
        return new Point([x,y]);
    }

    /**
     * Returns the total number of contained
     * Points/coordinates given the current
     * origin and corner values.
     */
    get area(){
        let maxX = (this.corner.x - this.origin.x) - 1;
        let maxY = (this.corner.y - this.origin.y) - 1;
        return maxX * maxY;
    }

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
     * Returns true if the Frame is "empty",
     * meaning that is has no dimensions and
     * the origin and corner are identical.
     */
    get isEmpty(){
        if(this.origin.x == this.corner.x && this.origin.y == this.corner.y){
            return true;
        }
        return false;
    }

    /**
     * Class method for constructing a new
     * empty Frame.
     */
    static newEmpty(){
        return new this(
            [0,0],
            [0,0]
        );
    }
}

export {
    Frame as default,
    Frame
};
