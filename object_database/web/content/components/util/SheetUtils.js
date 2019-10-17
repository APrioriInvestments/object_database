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


class Rect {
    constructor(origin, corner){
        this.origin = origin;
        this.corner = corner;
    }
}
