/**
 * Shell of a Sheet Webcomponent
 */
import PrimaryFrame from './PrimaryFrame';
import DataFrame from './DataFrame';
import Point from './Point';
import Selector from './Selector';

class Sheet extends HTMLElement {
    constructor(){
        super();
        this.dataFrame = new DataFrame([0,0], [1000,1000]);
        this.dataFrame.forEachPoint(aPoint => {
            let label = aPoint.toString().replace("Point", "");
            this.dataFrame.putAt(aPoint, label);
        });
        this.primaryFrame = new PrimaryFrame(this.dataFrame, [0,0]);
        this.selector = new Selector(this.primaryFrame);
        this.tableBody = document.createElement('tbody');
        this.table = document.createElement('table');

        // Bind component methods
        this.resize = this.resize.bind(this);

        // Add event listeners
        this.handleKeyDown = this.handleKeyDown.bind(this);
    }

    connectedCallback(){
        console.log('connected!');
        this.table.append(this.tableBody);
        this.append(this.table);
        let initialRows = parseInt(this.getAttribute('rows'));
        let initialCols = parseInt(this.getAttribute('columns'));
        this.resize(initialRows, initialCols);

        // Set tabindex to any value
        this.setAttribute('tabindex', 0);

        // Add keydown event listener
        this.addEventListener('keydown', this.handleKeyDown);
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

    handleKeyDown(event){
        if(event.key == 'ArrowRight'){
            if(event.shiftKey){
                this.selector.isSelecting = true;
            }
            this.selector.moveRightBy(1);
            event.preventDefault();

            // Update relevant view areas
            let posArea = document.getElementById('cursor-pos');
            let posDataArea = document.getElementById('cursor-data-pos');
            let dataArea = document.getElementById('cursor-data');
            posArea.innerText = this.selector.cursor.toString();
            posDataArea.innerText = this.selector.relativeCursor.toString();
            dataArea.innerText = this.selector.dataAtCursor.toString();
        } else if(event.key == 'ArrowLeft'){
            if(event.shiftKey){
                this.selector.isSelecting = true;
            }
            this.selector.moveLeftBy(1);
            event.preventDefault();

            // Update relevant view areas
            let posArea = document.getElementById('cursor-pos');
            let posDataArea = document.getElementById('cursor-data-pos');
            let dataArea = document.getElementById('cursor-data');
            posArea.innerText = this.selector.cursor.toString();
            posDataArea.innerText = this.selector.relativeCursor.toString();
            dataArea.innerText = this.selector.dataAtCursor.toString();
        } else if(event.key == 'ArrowUp'){
            if(event.shiftKey){
                this.selector.isSelecting = true;
            }
            this.selector.moveUpBy(1);
            event.preventDefault();

            // Update relevant view areas
            let posArea = document.getElementById('cursor-pos');
            let posDataArea = document.getElementById('cursor-data-pos');
            let dataArea = document.getElementById('cursor-data');
            posArea.innerText = this.selector.cursor.toString();
            posDataArea.innerText = this.selector.relativeCursor.toString();
            dataArea.innerText = this.selector.dataAtCursor.toString();
        } else if(event.key == 'ArrowDown'){
            if(event.shiftKey){
                this.selector.isSelecting = true;
            }
            this.selector.moveDownBy(1);
            event.preventDefault();

            // Update relevant view areas
            let posArea = document.getElementById('cursor-pos');
            let posDataArea = document.getElementById('cursor-data-pos');
            let dataArea = document.getElementById('cursor-data');
            posArea.innerText = this.selector.cursor.toString();
            posDataArea.innerText = this.selector.relativeCursor.toString();
            dataArea.innerText = this.selector.dataAtCursor.toString();
        }
        this.selector.isSelecting = false;
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
        let newPrimaryFrame = new PrimaryFrame(this.dataFrame, newCorner);
        newPrimaryFrame.corner = new Point([numCols-1, numRows-1]);
        newPrimaryFrame.initialBuild();
        newPrimaryFrame.lockRows(numLockedRows);
        newPrimaryFrame.lockColumns(numLockedColumns);
        newPrimaryFrame.labelElements();
        this.primaryFrame = newPrimaryFrame;
        this.selector = new Selector(this.primaryFrame);
        this.tableBody.append(...this.primaryFrame.rowElements);
        this.primaryFrame.updateCellContents();
        this.selector.drawCursor();
    }

    static get observedAttributes(){
        return ['rows', 'columns', 'locked-rows', 'locked-columns'];
    }
};

window.customElements.define('test-sheet', Sheet);
