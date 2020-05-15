/**
 * CustomElement Webcomponent for use
 * with AP ObjectDatabase Frontend
 * Cell Component
 */
import PrimaryFrame from './PrimaryFrame';
import DataFrame from './DataFrame';
import Point from './Point';
import Selector from './Selector';

/**
 * I return the value of parseInt
 * on some object. Unlike regular
 * parseInt, if the result is
 * undefined or NaN, I return 0.
 * @param {object} anObject - An object
 * to parseInt on
 * @returns {Number} - A valid integer
 * or 0 if NaN|undefined
 */
const cleanParseInt = (anObject) => {
    let result = parseInt(anObject);
    if(result == undefined || isNaN(result)){
        return 0;
    }
    return result;
}

class APSheet extends HTMLElement {
    constructor(){
        super();

        // Initialize default Sheet parts
        this.dataFrame = new DataFrame([0,0], [1000,1000]);
        this.primaryFrame = new PrimaryFrame(this.dataFrame, [0,0]);
        this.selector = new Selector(this.primaryFrame);

        // Initialize basic elements
        this.tableBody = document.createElement('tbody');
        this.tableHeader = document.createElement('thead');
        this.table = document.createElement('table');
        this.cellContentDisplay = document.createElement('div');
        this.customStyle = document.createElement('style');

        // Initialize sheet properties
        // These will be updated by attributes
        this.numColumns = 0;
        this.numRows = 0;
        this.numLockedRows = 0;
        this.numLockedColumns = 0;
        this.totalRows = Math.max(
            0,
            this.dataFrame.corner.y - 1
        );
        this.totalColumns = Math.max(
            0,
            this.dataFrame.corner.x - 1
        );

        // Bind component methods
        this.createHeader = this.createHeader.bind(this);
        this.createContentDisplay = this.createContentDisplay.bind(this);
        this.updateRows = this.updateRows.bind(this);
        this.updateCols = this.updateCols.bind(this);
        this.updateTotalRows = this.updateTotalRows.bind(this);
        this.updateTotalCols = this.updateTotalCols.bind(this);
        this.updateLockedCols = this.updateLockedCols.bind(this);
        this.updateLockedRows = this.updateLockedRows.bind(this);
        this.updateCustomStyle = this.updateCustomStyle.bind(this);
        this.resizePrimaryFrame = this.resizePrimaryFrame.bind(this);
        this.afterChange = this.afterChange.bind(this);
    }

    connectedCallback(){
        // Get the initial numbers based on
        // the assigned attributes to the element
        this.numColumns = cleanParseInt(this.getAttribute('columns')) || 0;
        this.numRows = cleanParseInt(this.getAttribute('rows')) || 0;
        this.numLockedRows = cleanParseInt(this.getAttribute('locked-rows')) || 0;
        this.numLockedColumns = cleanParseInt(this.getAttribute('locked-columns')) || 0;

        // Initialize the primary frame
        this.resizePrimaryFrame(
            this.numColumns,
            this.numRows
        );
        this.customStyle.setAttribute('scoped', true);
        this.append(this.customStyle);
        this.createHeader();
        this.createContentDisplay();
        this.table.append(this.tableHeader);
        this.table.append(this.tableBody);
        this.append(this.table);
        // Set a tabindex
        this.setAttribute('tabindex', 0);
    }

    createHeader(){
        this.tableHeader.innerHTML = "";
        let headerRow = document.createElement('tr');
        let headerCoordinateData = document.createElement('th');
        let dummyHeader = document.createElement('th'); // Will be used only for measurement
        headerCoordinateData.setAttribute("colSpan", 1);
        dummyHeader.setAttribute("colSpan", `${this.numColumns - 1}`);
        headerCoordinateData.textContent = "(0, 0)";
        headerRow.append(headerCoordinateData);
        headerRow.append(dummyHeader);
        this.tableHeader.append(headerRow);
    }

    createContentDisplay(){
        this.cellContentDisplay.innerHTML = "";
        this.cellContentDisplay.classList.add('sheet-content-display');
        this.prepend(this.cellContentDisplay);
    }

    resizePrimaryFrame(cornerX, cornerY){
        let newPrimaryFrame = new PrimaryFrame(
            this.dataFrame,
            new Point([cornerX, cornerY])
        );
        newPrimaryFrame.initialBuild();
        newPrimaryFrame.lockRows(this.numLockedRows);
        newPrimaryFrame.lockColumns(this.numLockedColumns);
        newPrimaryFrame.labelElements();
        this.primaryFrame = newPrimaryFrame;
        this.selector.primaryFrame = newPrimaryFrame;
        this.tableBody.innerHTML = "";
        this.tableBody.append(...this.primaryFrame.rowElements);
        this.primaryFrame.updateCellContents();
        this.createHeader();
        this.createContentDisplay();
        this.primaryFrame.afterChange = this.afterChange;
        this.selector.drawCursor();
        this.selector.updateElements();
    }

    afterChange(){
        // We check to see if we have data
        // for the three constinuent relative
        // frames of primaryFrame. If not,
        // we trigger an event that requests
        // this for each
        let relativeFrames = [
            this.primaryFrame.relativeViewFrame,
            this.primaryFrame.relativeLockedColumnsFrame,
            this.primaryFrame.relativeLockedRowsFrame
        ];
        let framesToRequest = relativeFrames.filter(frame => {
            return frame && !frame.isEmpty;
        }).filter(frame => {
            return !this.dataFrame.hasCompleteDataForFrame(frame);
        });

        // We dispatch the event only
        // if there are valid frames to
        // request
        if(framesToRequest.length){
            let event = new CustomEvent('sheet-needs-data', {
                detail: {
                    frames: framesToRequest
                }
            });
            this.dispatchEvent(event);
        }
    }

    /* Attribute Update Methods */
    attributeChangedCallback(name, oldVal, newVal){
        if(this.isConnected){
            switch(name){
            case 'rows':
                this.updateRows(oldVal, newVal);
                break;
            case 'columns':
                this.updateCols(oldVal, newVal);
                break;
            case 'total-columns':
                this.updateTotalCols(oldVal, newVal);
                break;
            case 'total-rows':
                this.updateTotalRows(oldVal, newVal);
                break;
            case 'locked-columns':
                this.updateLockedCols(oldVal, newVal);
                break;
            case 'locked-rows':
                this.updateLockedRows(oldVal, newVal);
                break;
            case 'col-width':
                this.colWidth = cleanParseInt(newVal);
                this.updateCustomStyle();
                break;
            case 'row-height':
                this.rowHeight = cleanParseInt(newVal);
                this.updateCustomStyle();
                break;
            default:
                return;
            }
        }
    }

    updateRows(oldVal, newVal, shouldResize=true){
        let numRows = cleanParseInt(newVal);
        this.numRows = Math.max(0, numRows);
        if(shouldResize){
            let newCornerY = Math.max(0, this.numRows - 1);
            let newCornerX = Math.max(0, this.numColumns - 1);
            return this.resizePrimaryFrame(newCornerX, newCornerY);
        }
    }

    updateCols(oldVal, newVal, shouldResize=true){
        let numCols = cleanParseInt(newVal);
        this.numColumns = Math.max(0, numCols);
        if(shouldResize){
            let newCornerY = Math.max(0, this.numRows - 1);
            let newCornerX = Math.max(0, this.numColumns - 1);
            return this.resizePrimaryFrame(newCornerX, newCornerY);
        }
    }

    updateLockedCols(oldVal, newVal, shouldResize=true){
        let numLockedCols = cleanParseInt(newVal);
        this.numLockedColumns = Math.max(0, numLockedCols);
        this.primaryFrame.lockColumns(this.numLockedColumns);
        this.primaryFrame.labelElements();
        this.primaryFrame.updateCellContents();
        this.selector.updateElements();
    }

    updateLockedRows(oldVal, newVal){
        let numLockedRows = cleanParseInt(newVal);
        this.numLockedRows = Math.max(0, numLockedRows);
        this.primaryFrame.lockRows(this.numLockedRows);
        this.primaryFrame.labelElements();
        this.primaryFrame.updateCellContents();
        this.selector.updateElements();
    }

    updateTotalCols(oldVal, newVal){
        let numTotalCols = cleanParseInt(newVal);
        this.totalColumns = Math.max(0, numTotalCols);
        let newCornerX = Math.max(0, (numTotalCols - 1));
        let primaryCornerX = this.primaryFrame.corner.x;
        this.dataFrame.corner.x = Math.max(
            newCornerX,
            primaryCornerX
        );
    }

    updateTotalRows(oldVal, newVal){
        let numTotalRows = cleanParseInt(newVal);
        this.totalRows = Math.max(0, numTotalRows);
        let newCornerY = Math.max(0, (numTotalRows - 1));
        let primaryCornerY = this.primaryFrame.corner.y;
        this.dataFrame.corner.y = Math.max(
            newCornerY,
            primaryCornerY
        );
    }

    updateCustomStyle(){
        let styleString = "";
        if(!this.colWidth && !this.colHeight){
            return;
        }
        if(this.colWidth > 0){
            styleString += `td > div.sheet-cell-inner { width: ${this.colWidth}px !important; }\n`;
            styleString += `th { max-width: ${this.colWidth}px }\n`;
        }
        if(this.rowHeight > 0){
            styleString += `tr div.sheet-cell-inner { height: ${this.rowHeight}px; }\n`;
        }
        this.customStyle.innerText = styleString;
    }


    /* Dynamic Attributes */
    static get observedAttributes(){
        return [
            'rows',
            'columns',
            'locked-rows',
            'locked-columns',
            'total-rows',
            'total-columns',
            'col-width',
            'row-height'
        ];
    }
};

window.customElements.define('ap-sheet', APSheet);
