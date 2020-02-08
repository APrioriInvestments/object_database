/**
 * Utility Classes and Methods for
 * Sheet Component
 **/

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
        this.translate = this.translate.bind(this);
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
        if (condition.every((item) => {return item === true;})){
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

        return NaN;
    }

    get copy(){
        return new Point([this._values[0], this._values[1]]);
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

    /**
     * I translate myself by another point p.
     * p can also be a length 2 array
     * @param {Point|Array} p - The point by which we
     * with to translate the current instance.
     */
    translate(p){
        if (p instanceof Array){
            p = new Point(p);
        }
        this.x += p.x;
        this.y += p.y;
    }

    toString(){
        if (this.isNaN){
            return "NaN";
        }
        return `${this._values[0]},${this._values[1]}`;
    }

    toPoint(){
        return this;
    }
}

Array.prototype.toPoint = function(){
    if(this.length !== 2){
        throw new Error("toPoint requires an Array of length 2 [x, y]!");
    }
};


class Frame {
    constructor(origin, corner, name=null){
        /* Origin and corner can be any points in the first quadrant. Only those where
         * corner.x >= origin.x AND corner.y <= origin.y will lead an non-empty
         * non-zero dimensional frame.IE we stick the basic bitmap conventions of
         * origin as top-left and corner as bottom-right.
         */
        this.origin = new Point(origin);
        this.corner = new Point(corner);
        this.name = name;
        if (!this.origin.isNaN && !this.corner.isNaN) {
            if (this.origin.quadrant !== 1 || this.corner.quadrant !== 1){
                throw "Both 'origin' and 'corner' must be of non-negative coordinates";
            }
            if (this.origin.x > this.corner.x || this.origin.y > this.corner.y){
                throw "Origin must be top-left and corner bottom-right";
            }
        }

        // Bind methods
        this.intersect = this.intersect.bind(this);
        this.translate = this.translate.bind(this);
        this.sliceCoords = this.sliceCoords.bind(this);
    }

    /**
     * Responds with the number of dimensions
     * the current frame has.
     * @returns {number}
     */
    get dim(){
        if (this.empty){
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

    /* I return the size, a Point, of the frame */
    /**
     * I return the size, in the form of a Point,
     * of the current frame.
     * @returns {Point}
     */
    get size(){
        if (!this.empty){
            let x = this.corner.x - this.origin.x;
            let y = this.corner.y - this.origin.y;
            return new Point([x, y]);
        }
        return NaN;
    }

    /* check if the frame is empty. */
    get empty(){
        if (this.origin.isNaN || this.corner.isNaN){
            return true;
        }
        return false;
    }

    /* Set the name */
    set setName(n){
        this.name = name;
    }

    /* Set the origin */
    set setOrigin(xy){
        this.origin = new Point(xy);
    }

   /* Set the corner */
    set setCorner(xy){
        this.corner = new Point(xy);
    }

    /**
     * Returns the Point in the top right
     * corner
     * @returns {Point}
     */
    get topRight(){
        return new Point([
            this.corner.x,
            this.origin.y
        ]);
    }

    /**
     * Returns the Point in the bottom
     * left corner
     * @returns {Point}
     */
    get bottomLeft(){
        return new Point([
            this.origin.x,
            this.corner.y
        ]);
    }

    /**
     * Returns the Point in the bottom
     * right corner
     * @returns {Point}
     */
    get bottomRight(){
        return new Point([
            this.corner.x,
            this.corner.y
        ]);
    }

    /**
     * Returns the point at the top
     * left corner
     * @returns {Point}
     */
    get topLeft(){
        return new Point([
            this.origin.x,
            this.origin.y
        ]);
    }

    get right(){
        return this.corner.x;
    }

    get bottom(){
        return this.corner.y;
    }

    get top(){
        return this.origin.y;
    }

    get left(){
        return this.origin.x;
    }

    /**
     * Returns an array of relative (to the frame's origin
     * and corner) coordinate pairs.
     * @returns {Array}
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

    /**
     * I slice the frame along a given axis at a given row
     * and return the cooresponding coordinates.
     * For example:
     *     Frame([0, 0], [10, 10]).sliceCoords(5, 'y')
     * will return a  list like
     *     [[5, 0], ... [5, 10]]
     * @param {number} index - The row index where the
     * slice should begin
     * @param {string} axis - Either 'y' or 'x'
     * @returns {Array}
     */
    sliceCoords(index, axis) {
        let coords = [];
        if (axis === "y"){
            if (index > this.corner.x || index < this.origin.x){
                throw "Index out of range";
            }
            for(let y = this.origin.y; y <= this.corner.y; y++){
                coords.push(new Point([index, y]));
            }
        } else if (axis === "x"){
            for(let x = this.origin.x; x <= this.corner.x; x++){
                coords.push(new Point([x, index]));
            }
        }
        return coords;
    }

    /**
     * I check whether the given point (as Point, tuple
     * of coordinates, or string representation) or
     * Frame is contained within myself.
     * @param {Array|Point|Frame|string} other - The entity
     * that I will check to see if I contain.
     * @returns {boolean}
     */
    contains(other){
        if (other instanceof String || typeof(other) === "string") {
            other = new Point(other.split(',').map((item) => {
                return parseInt(item);
            }));
        } else if (other instanceof Array){
            other = new Point(other);
        }
        if (other instanceof Point) {
            return (other.x >= this.origin.x && other.x <= this.corner.x
                    && other.y <= this.corner.y && other.y >= this.origin.y);
        } else if (other instanceof Frame) {
            return this.contains(other.origin) && this.contains(other.corner);
        }
        throw "You must pass a length 2 array, a Point, or a Frame";
    }

    /**
     * I return true if the frames have the same origin
     * and corner.
     * @param {Frame} frame - The other frame to check
     * equality with.
     * @returns {boolean}
     */
    equals(frame){
        if (this.origin.equals(frame.origin) && this.corner.equals(frame.corner)){
            return true;
        }
        return false;
    }

    /**
     * I translate myself in the given [x, y]
     * direction.
     * Note: xy can also be a Point instance.
     * If inplace is true, I translate myself.
     * Otherwise, I return a new Frame instance that
     * is a translated copy of myself.
     * @param {Array|Point} xy - The coordinate pair
     * or Point instance that I will translate by.
     * @param {boolean} inplace - Whether or not to
     * mutate myself (true) or return a translated
     * copy (false). Defaults to true.
     * @returns {Frame}
     */
    translate(xy, inplace=true){
        let origin = this.origin;
        let corner = this.corner;
        if (inplace){
            this.corner.translate(xy);
            this.origin.translate(xy);
        } else {
            let newFrame = new Frame(new Point(this.origin), new Point(this.corner), this.name);
            newFrame.translate(xy);
            origin = newFrame.origin;
            corner = newFrame.corner;
            return newFrame;
        }
        if (origin.x > corner.x || origin.y > corner.y){
            throw "Invalid translation: new origin must be top-left and corner bottom-right";
        }
    }

    /**
     * I map myself onto another Frame by putting my
     * origin in the provided origin/coordinates.
     * For example:
     *     map(new Frame(0, 10), new Point(5, 5))
     * will map myself onto the Frame(0, 10) and put
     * my origin at Point(5, 5).
     * If strict=true, then I will make sure that I fit
     * entirely within the frame. Otherwise I will simply
     * take the intersection.
     * @param {Frame} frame - A Frame to map onto
     * @param {Array|Point} origin - Location in the
     *  new frame for the mapped origin
     * @param {boolean} strict - If true, throws an error
     * if I cannot fit entirely in the new Frame. Defaults
     * to false.
     * @returns {Frame}
     */

    map(frame, origin, strict=false){
        if (origin instanceof Array){
            origin = new Point(origin);
        }
        if (!frame.contains(origin)){
            throw "the specified origin is not contained in the provided frame.";
        }
        let xDiff = origin.x - this.origin.x;
        let yDiff = origin.y - this.origin.y;
        let translatedFrame = this.translate([xDiff, yDiff], inplace=false);
        if (strict && !frame.contains(translatedFrame)){
            return new Frame();
        }
        return frame.intersect(translatedFrame);
    }

    /**
     * I return a Frame that is the intersection of
     * myself and the passed-in Frame.
     * @param {Frame} frame - The Frame that I should
     * intersect with.
     * @returns {Frame} - A new Frame instance that
     * is the intersect of myself and the passed-in
     * frame.
     */
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


/**
 * I am a Frame of Frames, i.e., a Composite Frame.
 * I allow you to manipulate many frames at once
 * overlayed on a base frame.
 * You can think of me as moving ship formations on
 * a Battleship game board.
 * I allow you to do basic geometric arithmetic,
 * transformation, etc., without having to keep
 * track of many frames at once.
 */
class CompositeFrame {
    constructor(baseFrame, overlayFrames){
        /*
         * baseFrame is the underlying frame for CompositeFrame.
         * All other frames should fit inside of it, and CompositeFrame
         * will raise an error if this is not the case.
         * overlayFrames is an array of dictionaries, each consisting of
         * a frame and origin point (key and values)
         * The origin determines where the given frame roots itself
         * project on the base frame.
         */
        if (!(baseFrame instanceof Frame)){
            throw "baseFrame must be a Frame class object";
        }
        this.baseFrame = baseFrame;
        this.overlayFrames = overlayFrames;

        // bind methods
        this.checkFrameConsistency = this.checkFrameConsistency.bind(this);
        this.project = this.project.bind(this);
        this._project = this._project.bind(this);
        this.translate = this.translate.bind(this);
        this._translate = this._translate.bind(this);
        this.getOverlayFrame = this.getOverlayFrame.bind(this);
        this.equals = this.equals.bind(this);

        this.checkFrameConsistency();
    }

    /**
     * I make sure that overlay frames can fit
     * inside the baseFrame.
     * @returns {boolean} - true if the overlay frames
     * can fit inside the baseFrame
     */
    checkFrameConsistency() {
        // If the baseFrame is empty, check that all the
        // overlayFrames are as well.
        // This is a weird situation but it's valid
        if (this.baseFrame.empty){
            if (this.overlayFrames.every(frame => {
                return frame['frame'].empty;
            })){
                return true;
            }
        }
        this.overlayFrames.map(frame => {
            let x = frame["origin"].x + frame["frame"].size.x;
            let y = frame["origin"].y + frame["frame"].size.y;
            if (x > this.baseFrame.size.x || y > this.baseFrame.size.y){
                throw `frame named '${frame["frame"].name}' will not project/fit into baseFrame at specified origin`;
            }
        });
        return true;
    }

    /**
     * I translate all my overlay frames in the given
     * [x, y] direction.
     * I also make sure that we don't translate off the
     * baseFrame, i.e., I move the frame within the
     * bounds of the baseFrame coordinates.
     * If baseFrame=true, then my baseFrame is also
     * translated.
     * Note: xy can also be a Point instance.
     * @param {Array|Point} xy - The direction of the
     * translation to apply
     * @param {string} name - The name to give the
     * translation (defaults to null)
     * @param {boolean} baseFrame - Whether or not
     * to also translate the whole baseFrame (defaults
     * to false)
     */
    translate(xy, name=null, baseFrame=false){
        if (baseFrame) {
            this.baseFrame.translate(xy);
        }
        if (name !== null){
            let frame = null;
            let index = null;
            this.overlayFrames.forEach((frm, i) => {
                if (frm["frame"].name === name){
                    frame = frm;
                    index = i;
                }
            });
            if (frame === null){
                return;
            }
            this.overlayFrames[index] = {
                frame: this._translate(frame["frame"], xy),
                origin: frame["origin"]
            };
        } else {
            this.overlayFrames = this.overlayFrames.map(frame => {
                return {
                    frame: this._translate(frame["frame"], xy),
                    origin: frame["origin"]
                };
            });
        }
    }

    _translate(frame, xy){
        return frame.translate(xy, false);
    }

    /**
     * I return the overlay frame that corresponds to
     * the name provided.
     * If none is found I return null.
     * @param {string} name - The name of the overlay
     * frame to find in this CompositeFrame.
     * @returns {Frame|null}
     */
    getOverlayFrame(name){
        let frame = null;
        this.overlayFrames.map(frm => {
            if (frm["frame"].name === name){
                frame = frm;
            }
        });
        return frame;
    }

    /**
     * I project the overlay frames onto the baseFrame and
     * return a dictionary of new frames for each overlay.
     * Essentially I take an overlayFrame's specified origin
     * in the baseFrame and make a new Frame of the same size,
     * starting at that origin.
     * You can also specify a name for a specific overlayFrame.
     * @param {string} name - The name of an overlayFrame
     * to project onto the baseFrame by itself.
     * @returns {object|Array} - An array of dictionaries
     * if we are doing all overlayFrames or a single dictionary
     * if we have specified a single overlayFrame by name.
     */
    project(name=null){
        if (name !== null){
            let frm = this.getOverlayFrame(name);
            return this._project(frm["frame"], frm["origin"]);
        }
        let projectedFrames = {};
        this.overlayFrames.forEach(frm => {
            projectedFrames[frm["frame"].name] = this._project(frm["frame"], frm["origin"]);
        });
        return projectedFrames;
    }

    _project(frame, origin){
        return new Frame([origin.x, origin.y],
            [origin.x + frame.size.x, origin.y + frame.size.y],
            frame.name
        );
    }

    /**
     * I project the intersection of toIntersect and frame onto
     * the baseFrame using frame's origin.
     * return a dictionary of new frames for each overlay.
     * Essentially I take frame's specified origin
     * in the baseFrame and make a new Frame of the same size,
     * starting at that origin, and then translate said new Frame's
     * origin and corner by the difference in those from frame and
     * frame.intersection(toIntersect).
     * @param {frame} frame - The frame to intersect with toIntersect and project
     * onto the baseFrame.
     * @param {frame/point} toIntersect - The frame or point to intersect with frame1.
     * @returns {frame} - The projected intersection frame.
     */
    intersectAndProject(frame, origin, toIntersect){
        let returnPoint = false;
        let frame2 = toIntersect;
        if (toIntersect instanceof Point){
            frame2 = new Frame(toIntersect, toIntersect);
            returnPoint = true;
        }
        if (!this.baseFrame.contains(origin)){
            throw "origin not contained in baseFrame";
        }
        if (frame.intersect(frame2).empty){
            return new Frame();
        }
        let originOffset = new Point([frame2.origin.x - frame.origin.x, frame2.origin.y - frame.origin.y]);
        let cornerOffset = new Point([frame2.corner.x - frame.corner.x, frame2.corner.y - frame.corner.y]); //NOTE: this is <=0
        let projection = this._project(frame, origin);
        projection.origin.translate(originOffset);
        projection.corner.translate(cornerOffset);
        if (returnPoint){
            return projection.origin;
        }
        return projection;
    }

    /**
     * I check whether I match the provided CompositeFrame
     * instance.
     * @param {CompositeFrame} compositeFrame - Another
     * CompositeFrame to check for equality against.
     * @returns {boolean} - true if they are equal
     */
    equals(compositeFrame){
        if (! compositeFrame instanceof CompositeFrame){
            throw "you must provide and instance of CompositeFrame.";
        }
        let baseFrameTest = this.baseFrame.equals(compositeFrame.baseFrame);
        let overlayFramesTest = this.overlayFrames.every(frame => {
            return compositeFrame.overlayFrames.some(argFrame => {
                return frame["frame"].equals(
                    argFrame["frame"]) && frame["origin"].equals(argFrame["origin"]);
            });
        });
        return baseFrameTest && overlayFramesTest;
    }

}


/**
 * I am a kind of Frame that represents a rectangular
 * selection of Points in another Frame or across
 * several intersecting frames.
 * I maintain a special Point called the cursor
 * which can be used by other classes for navigation
 * purposes.
 */
class SelectionFrame extends Frame {
    constructor(origin, corner, name=null){
        super(origin, corner, name);

        // This is what used to be the
        // single-cell "active" cell.
        this.cursor = new Point(this.origin);

        // Bind methods
        this.fromPointToPoint = this.fromPointToPoint.bind(this);
    }


    /**
     * Given two Points/coordinate pairs, I
     * adjust my own properties to embody a new
     * rectangle that encloses those points.
     * I also performs checks to ensure that
     * the top left is still the origin and the
     * bottom right is still the corner, even
     * if the to/from points are negative opposed.
     * If updateCursor=true, I will set the cursor
     * to be the from point.
     * @param {Array|Point} from - The point from
     * which we start making a new rect
     * @param {Array|Point} to - The point to
     * which we will extend the new rect
     * @param {boolean} updateCursor - Whether or not
     * to also re-set the cursor to be at the from
     * point. Defaults to true.
     */
    fromPointToPoint(from, to, updateCursor = true){
        // If the destination point is behind
        // the from point in some way, then we calc
        // new values for origin.
        if(Array.isArray(from)){
            from = new Point(from);
        }
        if(Array.isArray(to)){
            to = new Point(to);
        }

        // Above and left
        if(to.y <= from.y && to.x < from.x){
            this.setOrigin = to;
            this.setCorner = from;

        // Above and possibly right
        } else if(to.y < from.y && to.x >= from.x){
            this.setOrigin = new Point([from.x, to.y]);
            this.setCorner = new Point([to.x, from.y]);

        // Below and possibly left
        } else if(to.y > from.y && to.x <= from.x){
            this.setOrigin = new Point([to.x, from.y]);
            this.setCorner = new Point([from.x, to.y]);

        // Otherwise this is normal
        } else {
            this.setOrigin = new Point([from.x, from.y]);
            this.setCorner = new Point([to.x, to.y]);
        }

        // Update cursor
        if(updateCursor){
            this.cursor = from;
        }
    }

    translate(xy, cursor=true){
        super.translate(xy);
        if (cursor){
            this.cursor.translate(xy);
        }
    }

    /**
     * I return an array of all the Points that
     * correspond to the left side of myself.
     * In other words, the Points of the left
     * border.
     * @returns {Array} - An array of Points
     */
    get leftPoints(){
        let result = [];
        for(let y = this.origin.y; y <= this.corner.y; y++){
            result.push(new Point([this.origin.x, y]));
        }
        return result;
    }

    /**
     * I return an array of all the Points that
     * correspond to the left side of myself.
     * In other words, the Points of the left
     * border.
     * @returns {Array} - An array of Points
     */
    get rightPoints(){
        let result = [];
        for(let y = this.origin.y; y <= this.corner.y; y++){
            result.push(new Point([this.corner.x, y]));
        }
        return result;
    }

    /**
     * I return an array of all the Points that
     * correspond to the left side of myself.
     * In other words, the Points of the left
     * border.
     * @returns {Array} - An array of Points
     */
    get topPoints(){
        let result = [];
        for(let x = this.origin.x; x <= this.corner.x; x++){
            result.push(new Point([x, this.origin.y]));
        }
        return result;
    }

    /**
     * I return an array of all the Points that
     * correspond to the bottom side of myself.
     * In other words, the Points of the bottom
     * border.
     * @returns {Array} - An array of Points
     */
    get bottomPoints(){
        let result = [];
        for(let x = this.origin.x; x <= this.corner.x; x++){
            result.push(new Point([x, this.corner.y]));
        }
        return result;
    }

    /**
     * I return true if the provided point is at the bottom
     * side of myself.
     * @param {tuple/point}
     * @returns {bool}
     */
    isAtBottom(point){
        point = new Point(point);
        return this.corner.y === point.y;
    }

    /**
     * I return true if the provided point is at the top
     * side of myself.
     * @param {tuple/point}
     * @returns {bool}
     */
    isAtTop(point){
        point = new Point(point);
        return this.origin.y === point.y;
    }

    /**
     * I return true if the provided point is at the right
     * side of myself.
     * @param {tuple/point}
     * @returns {bool}
     */
    isAtRight(point){
        point = new Point(point);
        return this.corner.x === point.x;
    }

    /**
     * I return true if the provided point is at the left
     * side of myself.
     * @param {tuple/point}
     * @returns {bool}
     */
    isAtLeft(point){
        point = new Point(point);
        return this.origin.x === point.x;
    }
}


/**
 * I am a kind of Frame that also serves as a key-value
 * data store. You can .load() and .get() from me.
 */
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

    /**
     * I load an array of arrays of data.
     * Data coordinates (keys) are defined by the
     * 'origin' Point where data.length corresponds
     * to the y axis (offset by origin.y) and data[N]
     * corresponds to the x-axis (offset by origin.x)
     * @param {Array[Array]} data - An array of array of data
     * values.
     * @param {Array|Point} origin - The Point offset origin
     * for storing each data value
     */
    load(data, origin){
        if (origin instanceof Array){
            origin = new Point(origin);
        }
        if (origin.y > this.corner.y || origin.x > this.corner.x){
            throw "Origin is outside of frame.";
        }
        // check to make sure we are not out of the frame
        if (data.length + origin.y - 1> this.corner.y){
            throw "Data + origin surpass frame y-dimension.";
        }
        // iterate over the data and update the store; make sure to offset the
        // coordintates properly
        for (let y = 0; y < data.length; y++){
            let xSlice = data[y];
            for (let x = 0; x < xSlice.length; x++){
                if (x + origin.x > this.corner.x){
                    throw "Data + origin surpass frame x-dimension.";
                }
                let coord = [x + origin.x, y + origin.y];
                coord = coord.toString();
                this.store[coord] = xSlice[x];
            }
        }
    }

    /**
     * Given a coordinate, I respond with the stored
     * data value at that location.
     * @param {Array} coordinate - A coordinate pair
     * to lookup
     * @returns {object} - The data value at the coordinate
     * location
     */
    get(coordinate){
        if (!this.contains(coordinate)){
            throw "Coordinate not in frame.";
        }
        if (coordinate instanceof Array || coordinate instanceof Point){
            coordinate = coordinate.toString();
        }
        return this.store[coordinate];
    }
}

class Selector {
    constructor(sheet){
        this.sheet = sheet;
        this.selectionFrame = new SelectionFrame([0,0], [0,0]);
        this.onNeedsUpdate = null;

        // Bind methods
        this.elementAtPoint = this.elementAtPoint.bind(this);
        this.clearStyling = this.clearStyling.bind(this);
        this.addStyling = this.addStyling.bind(this);
        this.fromPointToPoint = this.fromPointToPoint.bind(this);
        this.applyToOppositeCorner = this.applyToOppositeCorner.bind(this);
        this.shrinkToCursor = this.shrinkToCursor.bind(this);
        this.triggerNeedsUpdate = this.triggerNeedsUpdate.bind(this);
        this.isAtViewTop = this.isAtViewTop.bind(this);
        this.isAtViewRight = this.isAtViewRight.bind(this);
        this.isAtViewLeft = this.isAtViewLeft.bind(this);
        this.isAtViewBottom = this.isAtViewBottom.bind(this);
        this.isAtDataTop = this.isAtDataTop.bind(this);
        this.isAtDataLeft = this.isAtDataLeft.bind(this);
        this.shiftUp = this.shiftUp.bind(this);
        this.shiftRight = this.shiftRight.bind(this);
        this.shiftDown = this.shiftDown.bind(this);
        this.shiftLeft = this.shiftLeft.bind(this);
        this.growUp = this.growUp.bind(this);
        this.growRight = this.growRight.bind(this);
        this.growDown = this.growDown.bind(this);
        this.growLeft = this.growLeft.bind(this);
        this.cursorTo = this.cursorTo.bind(this);
        this.cursorUp = this.cursorUp.bind(this);
        this.cursorRight = this.cursorRight.bind(this);
        this.cursorDown = this.cursorDown.bind(this);
		this.cursorInView = this.cursorInView.bind(this);
		this.cursorAboveView = this.cursorAboveView.bind(this);
		this.cursorBelowView = this.cursorBelowView.bind(this);
		this.cursorLeftOfView = this.cursorLeftOfView.bind(this);
		this.cursorRightOfView = this.cursorRightOfView.bind(this);
		this.shiftViewToCursor = this.shiftViewToCursor.bind(this);
        this.cursorLeft = this.cursorLeft.bind(this);
        this.getSelectionClipboard = this.getSelectionClipboard.bind(this);
        this.fetchData = this.fetchData.bind(this);
    }

    /**
     * I remove all styling from td elements
     * that are within my selection frame.
     * This includes any border styling.
     * If clearCursor=true, I will also
     * clear the styling of the td element
     * that maps to the current selection frame
     * cursor.
     * @param {boolean} clearCursor - Whether or not
     * to clear the cursor styling too. Defaults to
     * true
     */
    clearStyling(clearCursor = false){
        // Clears all styling on the
        // current selectionFrame and
        // cursor.
        let sheetEl = this.sheet.getDOMElement();
        let cells = sheetEl.querySelectorAll(`[class^="sheet-cell"]`);
        cells.forEach(element => {
            element.classList.remove(
                'active',
                'active-selection',
                'active-selection-left',
                'active-selection-right',
                'active-selection-top',
                'active-selection-bottom'
            );
        });
    }

    /**
     * I generate a clipboard string based on the text
     * content of td elements that are within my current
     * selection frame.
     * Note that we use the CSV format for the values,
     * creating line breaks along the y-axis.
     * @param {array} - arrat of arrays of text-values
     * @returns {string} - A CSV-formatted string
     */
    getSelectionClipboardNEW(data){
        // generates a clipboard string from the current points
        // Note: in order to create line breaks we slice along the y-axis
        let clipboard = data.map(item => {return item.join("\t")}).join("\n");
        navigator.clipboard.writeText(clipboard)
            .then(() => {
                console.log('Data copied.');
            })
            .catch(err => {
                // This can happen if the user denies clipboard permissions:
                console.error('Could not copy data: ', err);
            });
    }

    getSelectionClipboard(){
        // generates a clipboard string from the current points
        // Note: in order to create line breaks we slice along the y-axis
        let clipboard = "";
        for (let y = this.selectionFrame.origin.y; y <= this.selectionFrame.corner.y; y++){
            let row = "";
            this.selectionFrame.sliceCoords(y, "x").map(point => {
                // let id = this.sheet._coordToId("td", [point.x, point.y]);
                // let td = document.getElementById(id);
                // row += td.textContent + "\t";
				let textContent = this.sheet.dataFrame.get(point);
                row += textContent + "\t";
            });
            clipboard += row + "\n";
        }
        return clipboard;
    }

    /* I make WS requests to the server for more data.*/
    fetchData(){
        // TODO: maybe we don't need to fetch all the data or need to batch it
        this.sheet.requestIndex += 1;
        let frame = this.selectionFrame;
        let request = JSON.stringify({
            event: "sheet_needs_data",
            request_index: this.sheet.requestIndex,
            target_cell: this.sheet.props.id,
            frame: {
                origin: {x: frame.origin.x, y: frame.origin.y},
                corner: {x: frame.corner.x, y: frame.corner.y},
            },
            action: "clipboardData",
        });
        cellSocket.sendString(request);
		window.setTimeout(() => {return Promise.resolve("clipboard data fetched")}, 2000);
    }

    /**
     * Returns the td element that is mapped to by
     * the given Point.
     * @param {Point} point - The point at which we want
     * to look up the corresponding td elemnt
     * @returns {DOMElement} - A mapped td element
     */
    elementAtPoint(point){
        let id = this.sheet._coordToId("td", [point.x, point.y]);
        return document.getElementById(id);
    }

    /**
     * I add styling to all td elements that are within
     * my selection frame.
     * This includes styling for elements that are along
     * the borders of the selection frame.
     */
    addStyling(){
        // Adds the correct styling to the
        // selection area and cursor.
        let sheetEl = this.sheet.getDOMElement();
        let cells = sheetEl.querySelectorAll(`[class^="sheet-cell"]`);
        cells.forEach(element => {
            let x = parseInt(element.dataset['x']);
            let y = parseInt(element.dataset['y']);
            let elementPoint = new Point([x, y]);
            if (this.selectionFrame.contains(elementPoint)){
                if(this.selectionFrame.cursor.equals(elementPoint)){
                    element.classList.add('active');
                } else {
                    element.classList.add('active-selection');
                }
                if(this.selectionFrame.isAtLeft(elementPoint)){
                    element.classList.add('active-selection-left');
                }
                if(this.selectionFrame.isAtRight(elementPoint)){
                    element.classList.add('active-selection-right');
                }
                if(this.selectionFrame.isAtTop(elementPoint)){
                    element.classList.add('active-selection-top');
                }
                if(this.selectionFrame.isAtBottom(elementPoint)){
                    element.classList.add('active-selection-bottom');
                }
            };
        });
    }

    /**
     * I set my selection frame to be a single Point, that
     * of the selection cursor.
     */
    shrinkToCursor(){
        this.selectionFrame.setOrigin = this.selectionFrame.cursor;
        this.selectionFrame.setCorner = this.selectionFrame.cursor;
    }

    /**
     * I am an action that moves the cursor
     * of my selection frame to a new Point.
     * I always shrink the current selection frame
     * to the size of its cursor.
     * Note also that I clear styling, move, then
     * apply styling to the new cursor.
     * @param {Point} aPoint - The new location for
     * the selection frame cursor
     */
    cursorTo(aPoint){
        this.clearStyling(true);
        this.shrinkToCursor();
        this.selectionFrame.fromPointToPoint(
            aPoint,
            aPoint
        );
        this.addStyling();
    }

    /**
     * I add the given coordinate pair to the Point that
     * corresponds to the opposite corner of the current
     * selection frame's cursor. This means, of course, that
     * the cursor must be in one of the frame's corners. We throw
     * an error if it is not.
     * This method is used in the process of expanding the selection
     * frame using key events, while ensuring that the cursor remains
     * in the correct place.
     * @param {Array} diffCoord - A coordinate pair that will be added to
     * the Point in the opposite corner from the cursor
     * @returns {Point} - A Point representing the updated corner value
     */
    applyToOppositeCorner(diffCoord){
        if(this.selectionFrame.cursor.equals(this.selectionFrame.origin)){
            return new Point([
                this.selectionFrame.corner.x + diffCoord[0],
                this.selectionFrame.corner.y + diffCoord[1]
            ]);
        } else if(this.selectionFrame.cursor.equals(this.selectionFrame.corner)){
            return new Point([
                this.selectionFrame.origin.x + diffCoord[0],
                this.selectionFrame.origin.y + diffCoord[1]
            ]);
        } else if(this.selectionFrame.cursor.equals(this.selectionFrame.bottomLeft)){
            return new Point([
                this.selectionFrame.topRight.x + diffCoord[0],
                this.selectionFrame.topRight.y + diffCoord[1]
            ]);
        } else if(this.selectionFrame.cursor.equals(this.selectionFrame.topRight)){
            return new Point([
                this.selectionFrame.bottomLeft.x + diffCoord[0],
                this.selectionFrame.bottomLeft.y + diffCoord[1]
            ]);
        } else {
            throw new Error('Selection cursor not in a valid selection corner:', this.selectionFrame);
        }
    }

    /**
     * I expand the selection frame up by one
     */
    growUp(){
        if(!this.isAtViewTop(true)){
            let diff = [0, -1];
            let toPoint = this.applyToOppositeCorner(diff);
            this.fromPointToPoint(
                this.selectionFrame.cursor,
                toPoint,
                false
            );
        }
    }

    /**
     * I expand the selection frame right by one
     */
    growRight(){
        if(!this.isAtViewRight()){
            let diff = [1, 0];
            let toPoint = this.applyToOppositeCorner(diff);
            this.fromPointToPoint(
                this.selectionFrame.cursor,
                toPoint,
                false
            );
        }
    }

    /**
     * I expand the selection frame down by one
     */
    growDown(){
        if(!this.isAtViewBottom()){
            let diff = [0, 1];
            let toPoint = this.applyToOppositeCorner(diff);
            this.fromPointToPoint(
                this.selectionFrame.cursor,
                toPoint,
                false
            );
        }
    }

    /**
     * I expand the selection frame left by one
     */
    growLeft(){
        if(!this.isAtViewLeft(true)){
            let diff = [-1, 0];
            let toPoint = this.applyToOppositeCorner(diff);
            this.fromPointToPoint(
                this.selectionFrame.cursor,
                toPoint,
                false
            );
        }
    }

    /**
     * I expand the selection frame all the way to the bottom
     */
    growToBottom(){
		let yDiff = this.sheet.dataFrame.corner.y - this.selectionFrame.corner.y;
		if(this.selectionFrame.isAtBottom(this.selectionFrame.cursor)){
			yDiff = this.sheet.dataFrame.corner.y - this.selectionFrame.origin.y;
		}
		let diff = [0, yDiff];
		let toPoint = this.applyToOppositeCorner(diff);
		this.fromPointToPoint(
			this.selectionFrame.cursor,
			toPoint,
			false
		);
    }

    /**
     * I expand the selection frame all the way to the top
     */
    growToTop(){
		let yDiff = -1 * this.selectionFrame.origin.y;
		if(this.selectionFrame.isAtTop(this.selectionFrame.cursor)){
			yDiff = -1 * this.selectionFrame.corner.y;
		}
		let diff = [0, yDiff];
		let toPoint = this.applyToOppositeCorner(diff);
		this.fromPointToPoint(
			this.selectionFrame.cursor,
			toPoint,
			false
		);
    }

    /**
     * I expand the selection frame all the way to the right
     */
    growToRight(){
		let xDiff = this.sheet.dataFrame.corner.x - this.selectionFrame.corner.x;
		if(this.selectionFrame.isAtRight(this.selectionFrame.cursor)){
			xDiff = this.sheet.dataFrame.corner.x - this.selectionFrame.origin.x;
		}
		let diff = [xDiff, 0];
		let toPoint = this.applyToOppositeCorner(diff);
		this.fromPointToPoint(
			this.selectionFrame.cursor,
			toPoint,
			false
		);
    }

    /**
     * I expand the selection frame all the way to the left
     */
    growToLeft(){
		let xDiff = -1 * this.selectionFrame.origin.x;
		if(this.selectionFrame.isAtLeft(this.selectionFrame.cursor)){
			xDiff = -1 * this.selectionFrame.corner.x;
		}
		let diff = [xDiff, 0];
		let toPoint = this.applyToOppositeCorner(diff);
		this.fromPointToPoint(
			this.selectionFrame.cursor,
			toPoint,
			false
		);
    }

    /**
     * I expand the selection frame one page down
     */
    pageDown(amount){
		let yDiff = amount;
		// if(this.selectionFrame.isAtBottom(this.selectionFrame.cursor)){
		//	yDiff = amount + this.selectionFrame.size.y;
		//}
		let diff = [0, yDiff];
		let toPoint = this.applyToOppositeCorner(diff);
		this.fromPointToPoint(
			this.selectionFrame.cursor,
			toPoint,
			false
		);
    }

    /**
     * I expand the selection frame one page up.
     */
    pageUp(amount){
		let yDiff = -1 * amount;
		// if(this.selectionFrame.isAtTop(this.selectionFrame.cursor)){
		//	yDiff = -1 * (amount + this.selectionFrame.size.y);
		//}
		let diff = [0, yDiff];
		let toPoint = this.applyToOppositeCorner(diff);
		this.fromPointToPoint(
			this.selectionFrame.cursor,
			toPoint,
			false
		);
    }

    /**
     * I expand the selection frame one page right
     */
    pageRight(amount){
		let xDiff = amount;
		// if(this.selectionFrame.isAtRight(this.selectionFrame.cursor)){
		//	xDiff = amount + this.selectionFrame.size.x;
		// }
		let diff = [xDiff, 0];
		let toPoint = this.applyToOppositeCorner(diff);
		this.fromPointToPoint(
			this.selectionFrame.cursor,
			toPoint,
			false
		);
    }

    /**
     * I expand the selection frame page left
     */
    pageLeft(amount){
		let xDiff = -1 * amount;
		// if(this.selectionFrame.isAtLeft(this.selectionFrame.cursor)){
		//	xDiff = -1 * (amount + this.selectionFrame.size.x);
		//}
		let diff = [xDiff, 0];
		let toPoint = this.applyToOppositeCorner(diff);
		this.fromPointToPoint(
			this.selectionFrame.cursor,
			toPoint,
			false
		);
    }
    /**
     * I move the cursor up by one
     */
    cursorUp(shrinkToCursor){
        this.shiftUp(1, shrinkToCursor);
        // TODO: this is not compatible with pagination!
        // and could lead to unexpected UX/behavior
    }

    /**
     * I move the cursor right by one
     */
    cursorRight(shrinkToCursor){
        this.shiftRight(1, shrinkToCursor);
        // TODO: this is not compatible with pagination!
        // and could lead to unexpected UX/behavior
    }

    /**
     * I move the cursor down by one
     */
    cursorDown(shrinkToCursor){
        this.shiftDown(1, shrinkToCursor);
        // TODO: this is not compatible with pagination!
        // and could lead to unexpected UX/behavior
    }

    /**
     * I move the cursor left by one
     */
    cursorLeft(shrinkToCursor){
        this.shiftLeft(1, shrinkToCursor);
        // TODO: this is not compatible with pagination!
        // and could lead to unexpected UX/behavior
    }

    /**
     * I shift the selection frame up by the
     * specified number of points. I can
     * optionally shrink the frame to fit
     * the cursor after doing so.
	 * Before I do any shifting, I check that the
	 * cursor is in the current view. If it's not
	 * I trigger a translation of the entire view
	 * to where the cursor is located.
     * @param {number} amount - The number of
     * points to shift in the up direction.
     * Defaults to 1.
     * @param {boolean} shrinkToCursor - Whether
     * to shrink the selection frame to be just
     * the size of the cursor after shifting.
     * Defaults to false.
     */
    shiftUp(amount = 1, shrinkToCursor = false){
		if (this.cursorInView()){
			let shift = [0, (amount * -1)];
			if(this.isAtDataTop()){
				if(!this.isAtViewTop(true)){
					this.clearStyling(true);
					this.selectionFrame.translate(shift);
					if(shrinkToCursor){
						this.shrinkToCursor();
					}
					this.addStyling();
				}
			} else {
				if(this.isAtViewTop()){
					this.selectionFrame.translate(shift);
					this.triggerNeedsUpdate('up', amount);
					if(shrinkToCursor){
						this.shrinkToCursor();
					}
				} else {
					this.selectionFrame.translate(shift);
					this.clearStyling(true);
					if(shrinkToCursor){
						this.shrinkToCursor();
					}
					this.addStyling();
				}
			}
		} else {
			this.shiftViewToCursor();
		}
    }

    /**
     * I shift the selection frame down by the
     * specified number of points. I can
     * optionally shrink the frame to fit
     * the cursor after doing so.
	 * Before I do any shifting, I check that the
	 * cursor is in the current view. If it's not
	 * I trigger a translation of the entire view
	 * to where the cursor is located.
     * @param {number} amount - The number of
     * points to shift in the down direction.
     * Defaults to 1.
     * @param {boolean} shrinkToCursor - Whether
     * to shrink the selection frame to be just
     * the size of the cursor after shifting.
     * Defaults to false.
     */
    shiftDown(amount = 1, shrinkToCursor = false){
		if (this.cursorInView()){
			let shift = [0, amount * 1];
			if (!this.isAtDataBottom()){
				if(this.isAtViewBottom()){
					this.triggerNeedsUpdate('down', amount);
					this.selectionFrame.translate(shift);
					if(shrinkToCursor){
						this.shrinkToCursor();
					}
				} else {
					this.selectionFrame.translate(shift);
					this.clearStyling(true);
					if(shrinkToCursor){
						this.shrinkToCursor();
					}
					this.addStyling();
				}
			}
		} else {
			this.shiftViewToCursor();
		}
    }

    /**
     * I shift the selection frame right by the
     * specified number of points. I can
     * optionally shrink the frame to fit
     * the cursor after doing so.
	 * Before I do any shifting, I check that the
	 * cursor is in the current view. If it's not
	 * I trigger a translation of the entire view
	 * to where the cursor is located.
     * @param {number} amount - The number of
     * points to shift in the right direction.
     * Defaults to 1.
     * @param {boolean} shrinkToCursor - Whether
     * to shrink the selection frame to be just
     * the size of the cursor after shifting.
     * Defaults to false.
     */
    shiftRight(amount = 1, shrinkToCursor = false){
		if (this.cursorInView()){
			let shift = [amount * 1, 0];
			if (!this.isAtDataRight()){
				if(this.isAtViewRight()){
					this.triggerNeedsUpdate('right', amount);
					this.selectionFrame.translate(shift);
					if(shrinkToCursor){
						this.shrinkToCursor();
					}
				} else {
					this.selectionFrame.translate(shift);
					this.clearStyling(true);
					if(shrinkToCursor){
						this.shrinkToCursor();
					}
					this.addStyling();
				}
			}
		} else {
			this.shiftViewToCursor();
		}
    }

    /**
     * I shift the selection frame left by the
     * specified number of points. I can
     * optionally shrink the frame to fit
     * the cursor after doing so.
	 * Before I do any shifting, I check that the
	 * cursor is in the current view. If it's not
	 * I trigger a translation of the entire view
	 * to where the cursor is located.
     * @param {number} amount - The number of
     * points to shift in the left direction.
     * Defaults to 1.
     * @param {boolean} shrinkToCursor - Whether
     * to shrink the selection frame to be just
     * the size of the cursor after shifting.
     * Defaults to false.
     */
    shiftLeft(amount = 1, shrinkToCursor = false){
		if (this.cursorInView()){
			let shift = [amount * -1, 0];
			if(this.isAtDataLeft()){
				if(!this.isAtViewLeft(true)){
					this.clearStyling(true);
					this.selectionFrame.translate(shift);
					if(shrinkToCursor){
						this.shrinkToCursor();
					}
					this.addStyling();
				}
			} else {
				if(this.isAtViewLeft()){
					this.selectionFrame.translate(shift);
					this.triggerNeedsUpdate('left', amount);
					if(shrinkToCursor){
						this.shrinkToCursor();
					}
				} else {
					this.selectionFrame.translate(shift);
					this.clearStyling(true);
					if(shrinkToCursor){
						this.shrinkToCursor();
					}
					this.addStyling();
				}
			}
		} else {
			this.shiftViewToCursor();
		}
    }

    triggerNeedsUpdate(direction, shift){
        if(this.onNeedsUpdate){
            this.onNeedsUpdate(direction, shift);
        }
    }

    /**
     * I am a wrapper for my selection frame's
     * fromPointToPoint method.
     * I first clear all styling before the
     * underlying call, and then add styling
     * once the frame has been translated.
     * See SelectionFrame.fromPointToPoint()
     * for more detail.
     */
    fromPointToPoint(from, to, updateCursor = true){
        this.clearStyling();
        this.selectionFrame.fromPointToPoint(from, to, updateCursor);
        this.addStyling();
    }

	/**
	 * I shift the entire view to the location of the cursor.
	 * If the cursor is above the current view I place it at the
	 * top row of the shifted view.
	 * If the cursor is below the current view I place it at the
	 * bottom row of the shifted view.
	 * If the cursor is to left of the current view I place it at the
	 * left-left most column of the shifted view.
	 * If the cursor is to the right of the current view I place it at the
	 * right-most column of the shifted view.
	 */
	shiftViewToCursor(){
		// we always shrink to cursor here
		this.shrinkToCursor();
        let body = document.getElementById(`sheet-${this.sheet.props.id}-body`);
        let bottomRow = body.lastChild;
        let cornerElement = bottomRow.lastChild;
		let originElement = body.querySelectorAll("td:not(.locked)")[0];
		let translation = new Point([0, 0]);
		if (this.cursorAboveView()){
			translation.y = this.selectionFrame.cursor.y - parseInt(originElement.dataset.y);
53
		} if (this.cursorBelowView()){
			translation.y = this.selectionFrame.cursor.y - parseInt(cornerElement.dataset.y);
		}
		if (this.cursorRightOfView()){
			translation.x = this.selectionFrame.cursor.x - parseInt(cornerElement.dataset.x);

		} else if (this.cursorLeftOfView()){
			translation.x = this.selectionFrame.cursor.x - parseInt(originElement.dataset.x);
		}
		this.sheet.compositeFrame.translate(translation, "viewFrame");
		this.sheet.compositeFrame.translate([0, translation.y], "lockedColumns");
		this.sheet.compositeFrame.translate([translation.x, 0], "lockedRows");
		this.sheet.fetchData("update");
	}

    /**
     * Returns true if the selection frame's cursor
     * is currently at the 'view top,' meaning what is
     * currently visual to the user.
     * If absolute=true we use the complete grid, i.e. the baseFrame, as opposed to the
     * viewFrame.
     */
    isAtViewTop(absolute=false){
        if (absolute){
            let body = document.getElementById(`sheet-${this.sheet.props.id}-body`);
            let firstRow = body.firstChild;
            let originElement = firstRow.firstChild;
            return this.selectionFrame.origin.y === parseInt(originElement.dataset["y"]);
        }
        return this.selectionFrame.origin.y === this.sheet.compositeFrame.getOverlayFrame("viewFrame")["frame"]["origin"].y;
    }

    /**
     * Returns true if the selection frame's cursor
     * is currently at the 'view bottom,' meaning what is
     * currently visual to the user.
     */
    isAtViewBottom(){
        let body = document.getElementById(`sheet-${this.sheet.props.id}-body`);
        let bottomRow = body.lastChild;
        let cornerElement = bottomRow.lastChild;
        return this.selectionFrame.corner.y === parseInt(cornerElement.dataset["y"]);
    }

    /**
     * Returns true if the selection frame's cursor
     * is currently at the 'view left,' meaning what is
     * currently visual to the user.
     * If absolute=true we use the complete grid, i.e. the baseFrame, as opposed to the
     * viewFrame.
     */
    isAtViewLeft(absolute=false){
        if (absolute){
            let body = document.getElementById(`sheet-${this.sheet.props.id}-body`);
            let firstRow = body.firstChild;
            let originElement = firstRow.firstChild;
            return this.selectionFrame.origin.x === parseInt(originElement.dataset["x"]);
        }
        return this.selectionFrame.origin.x === this.sheet.compositeFrame.getOverlayFrame("viewFrame")["frame"]["origin"].x;
    }

    /**
     * Returns true if the selection frame's cursor
     * is currently at the 'view right,' meaning what is
     * currently visual to the user.
     */
    isAtViewRight(){
        let body = document.getElementById(`sheet-${this.sheet.props.id}-body`);
        let bottomRow = body.lastChild;
        let cornerElement = bottomRow.lastChild;
        return this.selectionFrame.corner.x === parseInt(cornerElement.dataset["x"]);
    }
      /**
     * Returns true if the viewFrame top row matches up with the projected viewFrame top row, meaning
     * that we have reached the top of the Sheet and there is no more data above.
     */
    isAtDataTop(){
        return (
            this.sheet.compositeFrame.project("viewFrame").origin.y === this.sheet.compositeFrame.getOverlayFrame("viewFrame")["frame"].origin.y
        );
    }

    /**
     * Returns true if the viewFrame left-most column matches up with the
     * projected viewFrame left-most column, meaning
     * that we have reached the beginning of the Sheet and there is no more data to the left.
     */
    isAtDataLeft(){
        return (
            this.sheet.compositeFrame.project("viewFrame").origin.x === this.sheet.compositeFrame.getOverlayFrame("viewFrame")["frame"].origin.x
        );
    }

    /**
     * Returns true if the selectionFrame is at the absolute bottom of the data, i.e. its
     * corner.y === dataFrame.corner.y.
     */
    isAtDataBottom(){
        return this.selectionFrame.corner.y === this.sheet.dataFrame.corner.y;
    }

    /**
     * Returns true if the selectionFrame is at the absolute right of the data, i.e. its
     * corner.x === dataFrame.corner.x.
     */
    isAtDataRight(){
        return this.selectionFrame.corner.x === this.sheet.dataFrame.corner.x;
    }

	/**
	 * Returns true if the cursor is in the current view.
	 */
	cursorInView(){
        let body = document.getElementById(`sheet-${this.sheet.props.id}-body`);
        let bottomRow = body.lastChild;
        let cornerElement = bottomRow.lastChild;
		let originElement = body.querySelectorAll("td:not(.locked)")[0];
        let originX = parseInt(originElement.dataset["x"]);
        let originY = parseInt(originElement.dataset["y"]);
        let cornerX = parseInt(cornerElement.dataset["x"]);
        let cornerY = parseInt(cornerElement.dataset["y"]);
		let x = this.selectionFrame.cursor.x;
		let y = this.selectionFrame.cursor.y;
		return (x >= originX) && (x <= cornerX) && (y >= originY) && (y <= cornerY);
	}

	/**
	 * Returns true if the cursor is above the current view.
	 */
	cursorAboveView(){
        let body = document.getElementById(`sheet-${this.sheet.props.id}-body`);
		let originElement = body.querySelectorAll("td:not(.locked)")[0];
		let y = this.selectionFrame.cursor.y;
        return y < parseInt(originElement.dataset["y"]);
	}

	/**
	 * Returns true if the cursor is below the current view.
	 */
	cursorBelowView(){
        let body = document.getElementById(`sheet-${this.sheet.props.id}-body`);
        let bottomRow = body.lastChild;
        let cornerElement = bottomRow.lastChild;
		let y = this.selectionFrame.cursor.y;
        return y > parseInt(cornerElement.dataset["y"]);
	}

	/**
	 * Returns true if the cursor is left of the current view.
	 */
	cursorLeftOfView(){
        let body = document.getElementById(`sheet-${this.sheet.props.id}-body`);
		let originElement = body.querySelectorAll("td:not(.locked)")[0];
		let x = this.selectionFrame.cursor.x;
        return x < parseInt(originElement.dataset["x"]);
	}

	/**
	 * Returns true if the cursor is right of the current view.
	 */
	cursorRightOfView(){
        let body = document.getElementById(`sheet-${this.sheet.props.id}-body`);
        let bottomRow = body.lastChild;
        let cornerElement = bottomRow.lastChild;
		let x = this.selectionFrame.cursor.x;
        return x > parseInt(cornerElement.dataset["x"]);
	}
}


export {
    Point,
    Frame,
    CompositeFrame,
    SelectionFrame,
    Selector,
    DataFrame
}
