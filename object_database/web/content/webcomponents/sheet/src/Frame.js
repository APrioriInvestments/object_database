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
     * TODO: See about refactoring
     * using min()/max()
     */
    union(otherFrame){
        let cornerX;
        let cornerY;
        let originX;
        let originY;

        // Set the new origin to be the min
        // of the possible x and y values for
        // both
        if(this.origin.x <= otherFrame.origin.x){
            originX = this.origin.x;
        } else {
            originX = otherFrame.origin.x;
        }
        if(this.origin.y <= otherFrame.origin.y){
            originY = this.origin.y;
        } else {
            originY = otherFrame.origin.y;
        }

        // Set the new corner to be the max of
        // the possible x, y values for both
        if(this.corner.x >= otherFrame.corner.x){
            cornerX = this.corner.x;
        } else {
            cornerX = otherFrame.corner.x;
        }
        if(this.corner.y >= otherFrame.corner.y){
            cornerY = this.corner.y;
        } else {
            cornerY = otherFrame.corner.y;
        }
        return new Frame(
            [originX, originY],
            [cornerX, cornerY]
        );
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
     * Return the number of dimensions for
     * the current Frame.
     * Note that a Frame with identical
     * origin and corner is not necessarily
     * 'empty' (0-dimensional), as it can
     * contain a single point (cell) which
     * is actually 1 dimensional.
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
     */
    get area(){
        if(this.isEmpty){
            return 0;
        }
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
     * Class method for constructing a new
     * empty Frame.
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
     */
    static fromPointToPoint(firstPoint, secondPoint){
        if(firstPoint.equals(secondPoint)){
            return new Frame(firstPoint, secondPoint);
        }
        let newOrigin;
        let newCorner;
        if(firstPoint.x < secondPoint.x){
            // In this case, the firstPoint
            // is the bottomLeft and the
            // secondPoint is the topRight
            if(firstPoint.y > secondPoint.y){
                newOrigin = new Point([
                    firstPoint.x,
                    secondPoint.y
                ]);
                newCorner = new Point([
                    secondPoint.x,
                    firstPoint.y
                ]);
                return new Frame(newOrigin, newCorner);
            }
        }
        if(firstPoint.x > secondPoint.x){
            // In this case, the firstPoint
            // is the topRight and the
            // secondPoint is bottomLeft
            if(firstPoint.y < secondPoint.y){
                newOrigin = new Point([
                    secondPoint.x,
                    firstPoint.y
                ]);
                newCorner = new Point([
                    firstPoint.x,
                    secondPoint.y
                ]);
                return new Frame(newOrigin, newCorner);
                // Otherwise the secondPoint is the same as
                // the origin and the first is the same
                // as the corner
            } else {
                return new Frame(secondPoint, firstPoint);
            }
        }

        // If we get here, then the firstPoint
        // is the origin and the second is the
        // corner
        return new Frame(firstPoint, secondPoint);
    }
}

export {
    Frame as default,
    Frame
};
