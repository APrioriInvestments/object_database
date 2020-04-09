/**
 * Shell of a Sheet Webcomponent
 */
import PrimaryFrame from './PrimaryFrame';
import DataFrame from './DataFrame';
import Point from './Point';

class Sheet extends HTMLElement {
    constructor(){
        super();
        this.primaryFrame = PrimaryFrame.newEmpty();
        this.dataFrame = DataFrame.newEmpty();
        this.tableBody = document.createElement('tbody');
        this.table = document.createElement('table');

        // Bind component methods
        this.resize = this.resize.bind(this);
        this.paintExes = this.paintExes.bind(this);
        this.handleElementClick = this.handleElementClick.bind(this);
    }

    connectedCallback(){
        console.log('connected!');
        this.table.append(this.tableBody);
        this.append(this.table);
        let initialRows = parseInt(this.getAttribute('rows'));
        let initialCols = parseInt(this.getAttribute('columns'));
        this.resize(initialRows, initialCols);
    }

    attributeChangedCallback(name, oldVal, newVal){
        if(name == 'rows'){
            let numCols = parseInt(this.getAttribute('columns'));
            this.resize(parseInt(newVal), numCols);
        }
        if(name == 'columns'){
            let numRows = parseInt(this.getAttribute('rows'));
            this.resize(parseInt(numRows), newVal);
        }
        if(name == 'locked-rows'){
            this.primaryFrame.lockRows(parseInt(newVal));
        }
        if(name == 'locked-columns'){
            this.primaryFrame.lockColumns(parseInt(newVal));
        }
    }

    handleElementClick(event){
        // Increment the number in the cell
        // and store in the DataFrame
        let relX = event.target.dataset.relativeX;
        let relY = event.target.dataset.relativeY;
        let dataPoint = new Point([relX, relY]);
        let currentVal = this.dataFrame.getAt(dataPoint);
        if(currentVal){
            this.dataFrame.putAt(dataPoint, currentVal + 1);
        } else {
            this.dataFrame.putAt(dataPoint, 1);
        }
        this.primaryFrame.updateCellContents();
    }

    resize(numRows, numCols){
        // We make a new PrimaryFrame instance.
        // This is easier than updating the
        // labelling and inner frames on an
        // origin or corner change.
        this.tableBody.innerHTML = "";
        let numLockedRows = parseInt(this.getAttribute('locked-rows'));
        let numLockedColumns = parseInt(this.getAttribute('locked-columns'));
        let newCorner = new Point([numCols-1, numRows-1]);
        this.dataFrame.corner = newCorner;
        let newPrimaryFrame = new PrimaryFrame(this.dataFrame, newCorner);
        newPrimaryFrame.corner = new Point([numCols-1, numRows-1]);
        newPrimaryFrame.initialBuild();
        newPrimaryFrame.tdElements.forEach(tdEl => {
            tdEl.addEventListener('click', this.handleElementClick);
        });
        newPrimaryFrame.lockRows(numLockedRows);
        newPrimaryFrame.lockColumns(numLockedColumns);
        this.primaryFrame = newPrimaryFrame;
        this.tableBody.append(...this.primaryFrame.rowElements);
        this.paintExes();
        this.primaryFrame.updateCellContents();
    }

    paintExes(){
        // Does what it says: puts X in
        // each TD element
        this.querySelectorAll('td').forEach(el => {
            el.innerText = 'X';
        });
    }

    static get observedAttributes(){
        return ['rows', 'columns', 'locked-rows', 'locked-columns'];
    }
};

window.customElements.define('test-sheet', Sheet);
