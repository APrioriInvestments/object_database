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

    set x(val){
        this._values[0] = val;
    }

    set y(val){
        this._values[1] = val;
    }
}

class Frame {
    constructor(origin, corner){
        this.origin = new Point(origin);
        this.corner = new Point(corner);


        // Bind methods
    }

    get dim(){
        let x = this.corner.x - this.origin.x;
        let y = this.corner.y - this.origin.y;
        // TODO raise some errors if the any dim is negative
        return [x, y]
    }

}

export {Point, Frame}
