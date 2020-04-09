/**
 * APSheet TableElementsFrame
 * --------------------------------
 * A kind of Frame whose points are made
 * up of HTML td Elements and whose structures
 * can be made up of tr row Elements
 */
import Frame from './Frame';
import {
    isCoordinate,
    Point
} from './Point';

class TableElementsFrame extends Frame {
    constructor(origin, corner, options){
        super(origin, corner);
        this.rowElements = [];
        this.tdElements = [];
        this.initialBuild();

        // Bind instance methods
        this.elementAt = this.elementAt.bind(this);
    }

    initialBuild(){
        this.rowElements = [];
        this.tdElements =  [];
        this.forEachPointRow((row, rowIndex) => {
            let rowEl = document.createElement('tr');
            rowEl.setAttribute('data-y', rowIndex);
            row.forEach(point => {
                let tdEl = document.createElement('td');
                tdEl.setAttribute('data-y', point.y);
                tdEl.setAttribute('data-relative-y', point.y);
                tdEl.setAttribute('data-x', point.x);
                tdEl.setAttribute('data-relative-x', point.x);
                tdEl.point = point;
                this.tdElements.push(tdEl);
                rowEl.appendChild(tdEl);
            });
            this.rowElements.push(rowEl);
        });
    }

    /**
     * Returns the DOMElement that is mapped
     * to the given Point or coordinate in this
     * Frame.
     * @param {Array|Point} location - An array or
     * Point that should be mapped to a DOMElement.
     * @returns {DOMElement}
     */
    elementAt(location){
        let x, y;
        if(isCoordinate(location)){
            x = location[0];
            y = location[1];
        } else if(location.isPoint){
            x = location.x,
            y = location.y;
        } else {
            return null;
        }
        for(let i = 0; i < this.tdElements.length; i++){
            let element = this.tdElements[i];
            if(element.point.x == x && element.point.y == y){
                return element;
            }
        }
        return null;
    }
}

export {
    TableElementsFrame as default,
    TableElementsFrame
};
