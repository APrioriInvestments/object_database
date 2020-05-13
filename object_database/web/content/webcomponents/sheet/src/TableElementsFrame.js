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

    /**
     * I create and store the initial tr/td elements
     * as calculated by my own dimensions.
     * I set data-attributes for both the absolute
     * and relative coorindates on each td element.
     */
    initialBuild(){
        this.rowElements = [];
        this.tdElements =  [];
        this.forEachPointRow((row, rowIndex) => {
            let rowEl = document.createElement('tr');
            rowEl.setAttribute('data-y', rowIndex);
            row.forEach(point => {
                let tdEl = document.createElement('td');
                let innerDiv = document.createElement('div');
                innerDiv.classList.add('sheet-cell-inner');
                let innerSpan = document.createElement('span');
                innerSpan.classList.add('sheet-cell-inner-content');
                innerDiv.appendChild(innerSpan);
                tdEl.setAttribute('data-y', point.y);
                tdEl.setAttribute('data-relative-y', point.y);
                tdEl.setAttribute('data-x', point.x);
                tdEl.setAttribute('data-relative-x', point.x);
                tdEl.point = point;
                this.tdElements.push(tdEl);
                tdEl.appendChild(innerDiv);
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

    /**
     * Returns the DOMElement that is the inner
     * div (content element) of the td element
     * retrieved by `elementAt`.
     * @param {Array|Point} location - An array or
     * Point that should be mapped to a DOMElement.
     * @returns {DOMElement}
     */
    innerElementAt(location){
        let parent = this.elementAt(location);
        if(!parent){
            return null;
        }
        return parent.querySelector('div');
    }

    /**
     * Sets the innerText of the inner content
     * span element at the given location.
     * @param {Array|Point} location - An Array
     * or Point specifying the location of the
     * parent td element in this Frame
     * @param {String} content - The string
     * content to set the innerText as
     * @param {Boolean} allowNewlines - If false,
     * we first remove any newlines from the incoming
     * string, as these tend to mess up CSS styling
     * on sheet cells. Defaults to false.
     */
    setTextContentAt(location, content, allowNewlines=false){
        let inner = this.innerElementAt(location);
        if(inner){
            let span = inner.querySelector('span');
            if(allowNewlines){
                span.innerText = content;
            } else {
                let cleanContent = content.split("\n").join("");
                span.innerText = cleanContent;
            }
        }
    }

    /**
     * I respond with the corresponding point
     * of the passed-in element.
     * I will return null in the event
     * that the element is not one of my
     * contained td elements.
     * @param {HTMLElement} anElement - The
     * element for which we want to get the
     * corresponding point. Must be a td
     * element contained within my collection.
     */
    pointAtElement(anElement){
        if(!this.tdElements.includes(anElement)){
            return null;
        }
        let x = parseInt(anElement.dataset.x);
        let y = parseInt(anElement.dataset.y);
        return new Point([x,y]);
    }
}

export {
    TableElementsFrame as default,
    TableElementsFrame
};
