/**
 * APSheet Point class
 * ---------------------------
 * A Point represents a pair of x
 * and y coordinates on a 2 dimensional
 * plane.
 */


/**
 * Returns true only if the incoming
 * Object is an Array that has two
 * values.
 * @param {object} object - An object
 * to check to see if it is a "coordinate pair"
 * meaning a size 2 array of ints
 * @returns {boolean} - True only if
 * the object is an array of size 2
 */
const isCoordinate = (object) => {
    if(!Array.isArray(object)){
        return false;
    }
    return (object.length == 2);
};

class Point {
    constructor(arrayOrPoint){
        if(Array.isArray(arrayOrPoint)){
            if(arrayOrPoint.length < 2){
                throw "Must pass a Point or Array of length 2";
            }
            this.x = arrayOrPoint[0];
            this.y = arrayOrPoint[1];
        } else if(arrayOrPoint.isPoint){
            this.x = arrayOrPoint.x;
            this.y = arrayOrPoint.y;
        }

        this.isPoint = true;

        // Bind intance methods
        this.equals = this.equals.bind(this);
        this.toString = this.toString.bind(this);
        this.translate = this.translate.bind(this);
    }

    /**
     * Returns true if the Point given
     * by the argument has the same x and
     * y values as this instance.
     * @param {Point} otherPoint - The point
     * against which we compare this instance
     * @returns {boolean
     */
    equals(otherPoint){
        return (otherPoint.x == this.x && otherPoint.y == this.y);
    }

    /**
     * Translate this instance by the x and y
     * values present in the Point provided
     * by the argument.
     * @param {Point} otherPoint - The point
     * representing the translation values
     */
    translate(translationPoint){
        this.x += translationPoint.x;
        this.y += translationPoint.y;
    }

    /**
     * I make the my string representation
     * @returns {String} - The string representation
     * of myself
     */
    toString(){
        return `Point(${this.x}, ${this.y})`;
    }
};

export {
    Point as default,
    Point,
    isCoordinate
};
