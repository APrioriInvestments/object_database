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

    /* I translate myself by another point p; p can also be a length 2 array
     * of coordinates */
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

    /* I return the size, a Point, of the frame */
    get size(){
        if (!this._empty()){
            let x = this.corner.x - this.origin.x + 1;
            let y = this.corner.y - this.origin.y + 1;
            return new Point([x, y]);
        }
        return NaN;
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
                coords.push(new Point([index, y]));
            }
        } else if (axis === "x"){
            for(let x = this.origin.x; x <= this.corner.x; x++){
                coords.push(new Point([x, index]));
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

    /* I translate myself in the given [x, y] direction
     * Note: xy can also be an instance of class Point
     * If inplace=true I translate myself; if inplace=false I return a new
     * Frame that is a translated copy of myself.
     */
    translate(xy, inplace=true){
        let origin = this.origin;
        let corner = this.corner;
        if (inplace){
            this.corner.translate(xy);
            this.origin.translate(xy);
        } else {
            let newFrame = new Frame(new Point(this.origin), new Point(this.corner));
            newFrame.translate(xy);
            origin = newFrame.origin;
            corner = newFrame.corner;
            return newFrame;
        }
        if (origin.x > corner.x || origin.y > corner.y){
            throw "Invalid translation: new origin must be top-left and corner bottom-right"
        }
    }

    /* I map myself onto another frame by putting my origin in the provided
     * origin/coordinates. For example, `map(new Frame(0, 10), new Point(5, 5))`
     * will map myself onto the Frame(0, 10) putting my origin at Point(5, 5).
     * If strict=true then I will make sure that I fit entirely in the frame,
     * returning an empty frame if this is not the case;
     * otherwise I will simply take the intersection.
     */
    map(frame, origin, strict=false){
        if (origin instanceof Array){
            origin = new Point(origin);
        }
        if (!frame.contains(origin)){
            throw "the specified origin is not contained in the provided frame.";
        }
        let x_diff = origin.x - this.origin.x;
        let y_diff = origin.y - this.origin.y;
        let translatedFrame = this.translate([x_diff, y_diff], inplace=false);
        if (strict && !frame.contains(translatedFrame)){
            return new Frame();
        }
        return frame.intersect(translatedFrame);
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


/* I am Frame of Frames, i.e. a composite frame. I allow you to manipulate many frames at once
 * overlayed on a base frame. You can think of me as moving ship formations on a battleship game board.
 * I allow you to do basic geometric arithmetic, transformations etc without having to keep track of many
 * frames at once.
 */
class CompositeFrame {
    constructor(baseFrame, overlayFrames){
        /* baseFrame is the underlying frame for CompositeFrame; all other frames
         * should fit inside it, and CompositeFrame will raise an error if this is not the case.
         * overlayFrames is an array of dictionaries, each consition of a frame and origin poing (key and values);
         * the origin determines where the given frame roots itself project on the base frame.
         */
        if (! baseFrame instanceof Frame){
            throw "baseFrame must be a Frame class object";
        }
        this.baseFrame = baseFrame;
        this.overlayFrames = overlayFrames;

        // bind methods
        this.checkFrameConsistency = this.checkFrameConsistency.bind(this);
        this.checkFrameConsistency();
    }

    /* I make sure that overlay frames can fit inside the baseFrame */
    checkFrameConsistency() {
        this.overlayFrames.map(frame => {
            if (frame["frame"].size.x > this.baseFrame.size.x || frame["frame"].size.y > this.baseFrame.size.y){
                throw `frame named '${frame.name}' will not project/fit into baseFrame`;
            }
        });
        return true;
    }

    /* I translate all my overlay frames in the given [x, y] direction.
     * If baseFrame=true, the my baseFrame is also translated.
     * Note: xy can also be an instance of class Point
     */
    translate(xy, baseFrame=false){
        if (baseFrame) {
            this.baseFrame.translate(xy);
        }
        this.overlayFrames.map(frame => {frame["frame"].translate(xy)});
    }

    /* I return the overlay frame which corresponds to the name provided.
     * If none is found I return null.
     */
    getOverlayFrame(name){
        let frame = {"frame": null, origin: null};
        this.overlayFrames.map(frm => {
            if (frm["frame"].name === name){
                frame = frm;
            }
        });
        return frame["frame"];
    }

    /* I map my baseFrame and all overlayFrames onto another frame by
     * putting my origin in the provided
     * origin/coordinates. For example, `map(new Frame(0, 10), new Point(5, 5))`
     * will map myself onto the Frame(0, 10) putting my origin at Point(5, 5).
     * If strict=true then I will make sure that I fit entirely in the frame,
     * returning an empty frame if this is not the case;
     * otherwise I will simply take the intersection.
     */
    map(frame, origin, strict=false){
        if (origin instanceof Array){
            origin = new Point(origin);
        }
        if (!frame.contains(origin)){
            throw "the specified origin is not contained in the provided frame.";
        }
        let x_diff = origin.x - this.baseFrame.origin.x;
        let y_diff = origin.y - this.baseFrame.origin.y;
        let translatedBaseFrame = this.baseFrame.translate([x_diff, y_diff], inplace=false);
        if (strict && !frame.contains(translatedBaseFrame)){
            return new CompositeFrame(new Frame(), []);
        }
        let translatedOverlayFrames = this.overlayFrames.map(frm => {
            return frm.translate([x_diff, y_diff], inplace=false).intersect(frame);
        });
        translatedBaseFrame = translatedBaseFrame.intersect(frame);
        return new CompositeFrame(translatedBaseFrame, translatedOverlayFrames);
    }

    /* I check whether this matched the provided CompositeFrame. */
    equals(compositeFrame){
        if (! compositeFrame instanceof CompositeFrame){
            throw "you must provide and instance of CompositeFrame.";
        }
        let baseFrameTest = this.baseFrame.equals(compositeFrame.baseFrame);
        let overlayFramesTest = this.overlayFrames.every(frame => {
            return compositeFrame.overlayFrames.some(argFrame => {
                return frame["frame"].equals(argFrame["frame"]) && frame["origin"].equals(argFrame["origin"]);
            });
        })
        return baseFrameTest && overlayFramesTest;

    }

}

class SelectionFrame extends Frame {
    constructor(origin, corner){
        super(origin, corner);

        // This is what used to be the
        // single-cell "active" cell.
        this.cursor = this.origin;

        // Bind methods
        this.fromPointToPoint = this.fromPointToPoint.bind(this);
    }

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

    translate(xy){
        super.translate(xy);
        this.cursor.x += xy[0];
        this.cursor.y += xy[1];
    }

    get leftPoints(){
        let result = [];
        for(let y = this.origin.y; y <= this.corner.y; y++){
            result.push(new Point([this.origin.x, y]));
        }
        return result;
    }

    get rightPoints(){
        let result = [];
        for(let y = this.origin.y; y <= this.corner.y; y++){
            result.push(new Point([this.corner.x, y]));
        }
        return result;
    }

    get topPoints(){
        let result = [];
        for(let x = this.origin.x; x <= this.corner.x; x++){
            result.push(new Point([x, this.origin.y]));
        }
        return result;
    }

    get bottomPoints(){
        let result = [];
        for(let x = this.origin.x; x <= this.corner.x; x++){
            result.push(new Point([x, this.corner.y]));
        }
        return result;
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
        this.cursorLeft = this.cursorLeft.bind(this);
        this.getSelectionClipboard = this.getSelectionClipboard.bind(this);
    }

    clearStyling(clearCursor = false){
        // Clears all styling on the
        // current selectionFrame and
        // cursor.
        this.selectionFrame.coords.forEach(point => {
            if(clearCursor && point.equals(this.selectionFrame.cursor)){
                let id = this.sheet._coordToId("td", [point.x, point.y]);
                let td = document.getElementById(id);
                td.classList.remove(
                    'active',
                    'active-selection',
                    'active-selection-left',
                    'active-selection-right',
                    'active-selection-top',
                    'active-selection-bottom'
                );
            } else if(!point.equals(this.selectionFrame.cursor)) {
                let id = this.sheet._coordToId("td", [point.x, point.y]);
                let td = document.getElementById(id);
                td.classList.remove(
                    'active-selection',
                    'active-selection-left',
                    'active-selection-right',
                    'active-selection-top',
                    'active-selection-bottom'
                );
            }
        });
    }

    getSelectionClipboard(){
        // generates a clipboard string from the current points
        // Note: in order to create line breaks we slice along the y-axis
        let clipboard = "";
        for (let y = this.selectionFrame.origin.y; y <= this.selectionFrame.corner.y; y++){
            let row = "";
            this.selectionFrame.coords_slice(y, "x").map(point => {
                let id = this.sheet._coordToId("td", [point.x, point.y]);
                let td = document.getElementById(id);
                row += td.textContent + "\t";
            })
            clipboard += row + "\n";
        }
        return clipboard;
    }

    elementAtPoint(point){
        let id = this.sheet._coordToId("td", [point.x, point.y]);
        return document.getElementById(id);
    }

    addStyling(){
        // Adds the correct styling to the
        // selection area and cursor.
        let cursorEl = this.elementAtPoint(this.selectionFrame.cursor);
        cursorEl.classList.add('active');

        if(this.selectionFrame.dim > 0){
            this.selectionFrame.coords.forEach(point => {
                if(!point.equals(this.selectionFrame.cursor)){
                    let el = this.elementAtPoint(point);
                    el.classList.add('active-selection');
                }
            });
            this.selectionFrame.leftPoints.forEach(point => {
                if(!point.equals(this.selectionFrame.cursor)){
                    let el = this.elementAtPoint(point);
                    el.classList.add('active-selection-left');
                }
            });
            this.selectionFrame.topPoints.forEach(point => {
                if(!point.equals(this.selectionFrame.cursor)){
                    let el = this.elementAtPoint(point);
                    el.classList.add('active-selection-top');
                }
            });
            this.selectionFrame.rightPoints.forEach(point => {
                if(!point.equals(this.selectionFrame.cursor)){
                    let el = this.elementAtPoint(point);
                    el.classList.add('active-selection-right');
                }
            });
            this.selectionFrame.bottomPoints.forEach(point => {
                if(!point.equals(this.selectionFrame.cursor)){
                    let el = this.elementAtPoint(point);
                    el.classList.add('active-selection-bottom');
                }
            });
        }
    }

    shrinkToCursor(){
        this.selectionFrame.setOrigin = this.selectionFrame.cursor;
        this.selectionFrame.setCorner = this.selectionFrame.cursor;
    }

    cursorTo(aPoint){
        this.clearStyling(true);
        this.shrinkToCursor();
        this.selectionFrame.fromPointToPoint(
            aPoint,
            aPoint
        );
        this.addStyling();
    }

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

    growUp(){
        if(!this.isAtViewTop()){
            let diff = [0, -1];
            let toPoint = this.applyToOppositeCorner(diff);
            this.fromPointToPoint(
                this.selectionFrame.cursor,
                toPoint,
                false
            );
        }
    }

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

    growLeft(){
        if(!this.isAtViewLeft()){
            let diff = [-1, 0];
            let toPoint = this.applyToOppositeCorner(diff);
            this.fromPointToPoint(
                this.selectionFrame.cursor,
                toPoint,
                false
            );
        }
    }

    cursorUp(){
        this.shiftUp(1, true);
    }

    cursorRight(){
        this.shiftRight(1, true);
    }

    cursorDown(){
        this.shiftDown(1, true);
    }

    cursorLeft(){
        this.shiftLeft(1, true);
    }

    shiftUp(amount = 1, shrinkToCursor = false){
        let shift = [0, (amount * -1)];
        if(this.isAtViewTop()){
            this.triggerNeedsUpdate('up', shift);
        } else {
            this.clearStyling(true);
            this.selectionFrame.translate(shift);
        }
        if(shrinkToCursor){
            this.shrinkToCursor();
        }
        this.addStyling();
    }

    shiftRight(amount = 1, shrinkToCursor = false){
        let shift = [amount * 1, 0];
        if(this.isAtViewRight()){
            this.triggerNeedsUpdate('right', shift);
        } else {
            this.clearStyling(true);
            this.selectionFrame.translate(shift);
        }
        if(shrinkToCursor){
            this.shrinkToCursor();
        }
        this.addStyling();
    }

    shiftDown(amount = 1, shrinkToCursor = false){
        let shift = [0, amount * 1];
        if(this.isAtViewBottom()){
            this.triggerNeedsUpdate('down', shift);
        } else {
            this.clearStyling(true);
            this.selectionFrame.translate(shift);
        }
        if(shrinkToCursor){
            this.shrinkToCursor();
        }
        this.addStyling();
    }

    shiftLeft(amount = 1, shrinkToCursor = false){
        let shift = [amount * -1, 0];
        if(this.isAtViewLeft()){
            this.triggerNeedsUpdate('left', shift);
        } else {
            this.clearStyling(true);
            this.selectionFrame.translate(shift);
        }
        if(shrinkToCursor){
            this.shrinkToCursor();
        }
        this.addStyling();

    }

    triggerNeedsUpdate(direction, shift){
        if(this.onNeedsUpdate){
            this.onNeedsUpdate(direction, shift);
        }
    }

    fromPointToPoint(from, to, updateCursor = true){
        this.clearStyling();
        this.selectionFrame.fromPointToPoint(from, to, updateCursor);
        this.addStyling();
    }

    isAtViewTop(){
        return this.selectionFrame.origin.y === this.sheet.view_frame_offset.y;
    }

    isAtViewBottom(){
        return this.selectionFrame.corner.y === this.sheet.fixed_view_frame.corner.y;
    }

    isAtViewLeft(){
        return this.selectionFrame.origin.x === this.sheet.view_frame_offset.x;
    }

    isAtViewRight(){
        return this.selectionFrame.corner.x === this.sheet.fixed_view_frame.corner.x;
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
