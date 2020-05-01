/**
 * CustomElement Webcomponent for use
 * with AP ObjectDatabase Frontend
 * Cell Component
 */
import PrimaryFrame from './PrimaryFrame';
import DataFrame from './DataFrame';
import Point from './Point';
import Selector from './Selector';

class APSheet extends HTMLElement {
    constructor(){
        super();

        // Initialize default Sheet parts
        this.dataFrame = new DataFrame([0,0], [1000,1000]);
        this.primaryFrame = new PrimaryFrame(this.dataFrame, [0,0]);
        this.selector = new Selector(this.primaryFrame);

        // Initialize basic elements
        this.tableBody = document.createElement('tbody');
        this.table = document.createElement('table');

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
        this.updateRows = this.updateRows.bind(this);
        this.updateCols = this.updateCols.bind(this);
        this.updateTotalRows = this.updateTotalRows.bind(this);
        this.updateTotalCols = this.updateTotalCols.bind(this);
        this.updateLockedCols = this.updateLockedCols.bind(this);
        this.updateLockedRows = this.updateLockedRows.bind(this);
        this.resizePrimaryFrame = this.resizePrimaryFrame.bind(this);
        this.afterShift = this.afterShift.bind(this);
    }

    connectedCallback(){
        // Initialize the primary frame
        this.resizePrimaryFrame(0, 0);
        this.updateLockedCols(0);
        this.updateLockedRows(0);
        this.table.append(this.tableBody);
        this.append(this.table);

        // Set a tabindex
        this.setAttribute('tabindex', 0);
    }

    resizePrimaryFrame(cornerX, cornerY){
        let newPrimaryFrame = new PrimaryFrame(
            this.dataFrame,
            new Point([cornerX, cornerY])
        );
        newPrimaryFrame.initialBuild();
        let numLockedRows = parseInt(
            this.getAttribute('locked-rows')
        );
        let numLockedCols = parseInt(
            this.getAttribute('locked-columns')
        );
        newPrimaryFrame.lockRows(numLockedRows);
        newPrimaryFrame.lockColumns(numLockedCols);
        newPrimaryFrame.labelElements();
        this.primaryFrame = newPrimaryFrame;
        this.selector.primaryFrame = newPrimaryFrame;
        this.tableBody.innerHTML = "";
        this.tableBody.append(...this.primaryFrame.rowElements);
        this.primaryFrame.updateCellContents();
        this.primaryFrame.afterShift = this.afterShift;
        this.selector.drawCursor();
        this.selector.updateElements();
    }

    afterShift(){
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
            default:
                return;
            }
        }
    }

    updateRows(oldVal, newVal){
        let numRows = parseInt(newVal) - 1;
        this.numRows = Math.max(0, numRows);
        return this.resizePrimaryFrame(this.numColumns, this.numRows);
    }

    updateCols(oldVal, newVal){
        let numCols = parseInt(newVal) - 1;
        this.numColumns = Math.max(0, numCols);
        return this.resizePrimaryFrame(this.numColumns, this.numRows);
    }

    updateLockedCols(oldVal, newVal){
        let numLockedCols = parseInt(newVal);
        this.numLockColumns = Math.max(0, numLockedCols);
        this.primaryFrame.lockColumns(this.numLockedColumns);
        this.primaryFrame.labelElements();
        this.primaryFrame.updateCellContents();
        this.selector.updateElements();
    }

    updateLockedRows(oldVal, newVal){
        let numLockedRows = parseInt(newVal);
        this.numLockedRows = Math.max(0, numLockedRows);
        this.primaryFrame.lockRows(this.numLockedRows);
        this.primaryFrame.labelElements();
        this.primaryFrame.updateCellContents();
        this.selector.updateElements();
    }

    updateTotalCols(oldVal, newVal){
        let numTotalCols = parseInt(newVal);
        this.totalColumns = Math.max(0, numTotalCols);
        let newCornerX = Math.max(0, (numTotalCols - 1));
        let primaryCornerX = this.primaryFrame.corner.x;
        this.dataFrame.corner.x = Math.max(
            newCornerX,
            primaryCornerX
        );
    }

    updateTotalRows(oldVal, newVal){
        let numTotalRows = parseInt(newVal);
        this.totalRows = Math.max(0, numTotalRows);
        let newCornerY = Math.max(0, (numTotalRows - 1));
        let primaryCornerY = this.primaryFrame.corner.y;
        this.dataFrame.corner.y = Math.max(
            newCornerY,
            primaryCornerY
        );
    }


    /* Dynamic Attributes */
    static get observedAttributes(){
        return [
            'rows',
            'columns',
            'locked-rows',
            'locked-columns',
            'total-rows',
            'total-columns'
        ];
    }
};

window.customElements.define('ap-sheet', APSheet);
