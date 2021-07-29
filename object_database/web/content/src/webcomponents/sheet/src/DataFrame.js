/**
 * APSheet DataFrame class
 * ------------------------------------
 * Represents a kind of Frame that can store
 * values at each of its Points.
 */
import Frame from './Frame';
import {
    Point,
    isCoordinate
} from './Point';

class DataFrame extends Frame {
    constructor(...args){
        super(...args);

        // We store Point data as keys
        // composed of the values of each
        // Point
        this.store = {};

        // Bind instance methods
        this.loadFromArray = this.loadFromArray.bind(this);
        this.putAt = this.putAt.bind(this);
        this.getAt = this.getAt.bind(this);
        this.getDataArrayForFrame = this.getDataArrayForFrame.bind(this);
    }

    /**
     * Loads the supplied value object
     * into the store at the location
     * specified by the Point or coordinate
     * array.
     * @param {Point|Array} location - The
     * Point or coordinate array at which
     * we will store the value
     * @param {Object} value - The object
     * to store.
     */
    putAt(location, value){
        let x, y, key;
        if(location.isPoint){
            x = location.x;
            y = location.y;
            key = `${x},${y}`;
        } else if(isCoordinate(location)){
            x = location[0];
            y = location[1];
            key = location.toString();
        } else {
            throw "Invalid Point or Coordinate";
        }
        this.store[key] = value;
    }

    /**
     * Retrieves a stored value at the given
     * Point or coordinate location. Will return
     * undefined for values that have not been set,
     * and will throw an error for locations that
     * are outside the bounds of the Frame.
     * @param {Array|Point} location - The location
     * from which we will retrieve the stored item.
     * @returns {Object|undefined} - The retrieved
     * item or undefined if there is no stored
     * value. Errors if the location is out of
     * scope of the frame.
     */
    getAt(location){
        let key;
        if(isCoordinate(location)){
            if(!this.contains(location)){
                throw `${location} outside of DataFrame`;
            }
            key = location.toString();
        } else if(location.isPoint){
            if(!this.contains(location)){
                throw `${location} outside of DataFrame`;
            }
            key = `${location.x},${location.y}`;
        } else {
            throw "Invalid Point or Coordinate";
        }
        return this.store[key];
    }

    /**
     * Loads an array of arrays of data values
     * into the store at the appropriate point
     * values. The optional origin argument
     * specifies where in the current DataFrame
     * to begin storing the values from (an offset).
     * NOTE: The array of arrays first dimension will be
     * rows (y values) whose elements are columns (x values)
     * @param {Array[Array]} data - An array of arrays
     * of data values that we will store.
     * @param {Point|Array} origin - The relative
     * from which to start loading the data into
     * this DataFrame.
     */
    loadFromArray(data, origin=[0,0]){
        if(!this.contains(origin)){
            throw `${origin} not contained in this DataFrame`;
        }
        origin = new Point(origin);
        let rowMax = data.length - 1;
        let colMax = data[0].length - 1; // Assume all are equal
        let corner = new Point([
            colMax + origin.x,
            rowMax + origin.y
        ]);
        let comparisonFrame = new Frame(origin, corner);
        if(!this.contains(comparisonFrame)){
            throw `Incoming data runs outside bounds of current DataFrame (using origin ${origin})`;
        }
        data.forEach((row, y) => {
            row.forEach((value, x) => {
                let adjustedCoord = [
                    x + comparisonFrame.origin.x,
                    y + comparisonFrame.origin.y
                ];
                this.putAt(
                    adjustedCoord,
                    value
                );
            });
        });
    }

    /**
     * Return an array of arrays (rows of columns,
     * ie y then x) of the values stored in this
     * DataFrame.
     * @param {Frame} aFrame - The Frame instance
     * whose values we will pull out from the store
     * @returns {Array[Array]} A y-to-x (row to column)
     * array of array of stored values
     */
    getDataArrayForFrame(aFrame){
        if(!this.contains(aFrame)){
            throw `Frame is not contained within DataFrame!`;
        }
        let result = [];
        aFrame.forEachCoordinateRow(row => {
            let mappedRow = row.map(val => {
                return this.getAt(val);
            });
            result.push(mappedRow);
        });
        return result;
    }

    /**
     * A DataFrame is considered "full" if there
     * are stored values for each of its points.
     * This is equivalent to each point having a key
     * in the internal store dictionary.
     * To make matters even simpler, if the number of
     * keys is equivalent to the area of the DataFrame,
     * then something has been stored at each point value.
     */
    get isFull(){
        return(this.area == Object.keys(this.store).length);
    }

    /**
     * Responds true if the given Frame,
     * relative to this DataFrame instance,
     * has a data value set for each of the
     * Points therein. Returns false otherwise.
     * This is a method for determining if,
     * for example, some given intersect on the
     * DataFrame is complete or incomplete.
     * Note we will also throw an Error in the
     * event that the given Frame is not contained
     * within this one.
     */
    hasCompleteDataForFrame(aFrame){
        if(!this.contains(aFrame)){
            throw 'Passed Frame is not contained within DataFrame!';
        }
        let points = aFrame.points;
        for(let i = 0; i < points.length; i++){
            let thisPoint = points[i];
            if(this.getAt(thisPoint) == undefined){
                return false;
            }
        }

        return true;
    }
};

export {
    DataFrame,
    DataFrame as default
};
