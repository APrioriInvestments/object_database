/**
 * Shell of a Sheet Webcomponent
 */
import PrimaryFrame from './PrimaryFrame';
import DataFrame from './DataFrame';
import Point from './Point';
import Selector from './Selector';

const remoteDataFrame = new DataFrame([0,0], [1000,1000]);
remoteDataFrame.forEachPoint(aPoint => {
    let label = aPoint.toString().replace("Point", "");
    remoteDataFrame.putAt(aPoint, label);
});

const fetchRemoteFrames = (frames) => {
    console.log('Fetching frames from remote:');
    console.log(frames);
    return new Promise((resolve, reject) => {
        let fetchedData = frames.map(aFrame => {
            return [
                aFrame.origin,
                remoteDataFrame.getDataArrayForFrame(aFrame)
            ];
        });
        setTimeout(function(){
            resolve(fetchedData);
        }, 300);
    });
};

class Sheet extends HTMLElement {
    constructor(){
        super();
        this.dataFrame = new DataFrame([0,0], [1000,1000]);
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
        let shouldUpdateInfoAreas = false;
        let isSelecting = event.shiftKey;
        if(event.key == 'ArrowRight'){
            shouldUpdateInfoAreas = true;
            if(event.ctrlKey){
                this.selector.moveToRightEnd(isSelecting);
            } else {
                this.selector.moveRightBy(
                    1,
                    isSelecting
                );
            }
            event.preventDefault();
        } else if(event.key == 'ArrowLeft'){
            shouldUpdateInfoAreas = true;
            if(event.ctrlKey){
                this.selector.moveToLeftEnd(isSelecting);
            } else {
                this.selector.moveLeftBy(
                    1,
                    isSelecting
                );
            }
            event.preventDefault();
        } else if(event.key == 'ArrowUp'){
            shouldUpdateInfoAreas = true;
            if(event.ctrlKey){
                this.selector.moveToTopEnd(isSelecting);
            } else {
                this.selector.moveUpBy(
                    1,
                    isSelecting
                );
            }
            event.preventDefault();
        } else if(event.key == 'ArrowDown'){
            shouldUpdateInfoAreas = true;
            if(event.ctrlKey){
                this.selector.moveToBottomEnd(isSelecting);
            } else {
                this.selector.moveDownBy(
                    1,
                    isSelecting
                );
            }
            event.preventDefault();
        } else if(event.key == 'PageUp'){
            shouldUpdateInfoAreas = true;
            if(event.altKey){
                this.selector.pageLeft(isSelecting);
            } else {
                this.selector.pageUp(isSelecting);
            }
            event.preventDefault();
        } else if(event.key == 'PageDown'){
            shouldUpdateInfoAreas = true;
            if(event.altKey){
                this.selector.pageRight(isSelecting);
            } else {
                this.selector.pageDown(isSelecting);
            }
            event.preventDefault();
        }

        if(shouldUpdateInfoAreas){
            // Update relevant view areas
            let posArea = document.getElementById('cursor-pos');
            let posDataArea = document.getElementById('cursor-data-pos');
            let dataArea = document.getElementById('cursor-data');
            let selectionFrameArea = document.getElementById('selection-frame-info');
            let selectionPointsArea = document.getElementById('selection-points-info');
            posArea.innerText = this.selector.cursor.toString();
            posDataArea.innerText = this.selector.relativeCursor.toString();
            dataArea.innerText = this.selector.dataAtCursor.toString();
            selectionFrameArea.innerText = this.selector.selectionFrame.toString();
            if(this.selector.selectionFrame.isEmpty){
                selectionPointsArea.innerText = '[Empty Frame]';
            } else {
                selectionPointsArea.innerText = this.selector.selectionFrame.area.toString();
            }
        }
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
        newPrimaryFrame.afterShift = this.afterShift;
        this.primaryFrame = newPrimaryFrame;
        this.selector.primaryFrame = this.primaryFrame;
        this.tableBody.append(...this.primaryFrame.rowElements);
        this.primaryFrame.updateCellContents();
        this.selector.drawCursor();
        this.selector.updateElements();

        // Call afterShift the first time to ensure that data
        // for the initial views is fetched from the remote
        // source
        this.primaryFrame.afterShift(this.primaryFrame);
    }

    afterShift(primaryFrame){
        console.log('afterShift called');
        let frames = [
            primaryFrame.relativeViewFrame,
            primaryFrame.relativeLockedColumnsFrame,
            primaryFrame.relativeLockedRowsFrame
        ].filter(aFrame => {
            return !primaryFrame.dataFrame.hasCompleteDataForFrame(aFrame);
        });
        if(frames.length){
            console.log(`Attempting to fetch ${frames.length} frames...`);
            fetchRemoteFrames(frames)
                .then(frameTuples => {
                    frameTuples.forEach(frameTuple => {
                        let relativeOrigin = frameTuple[0];
                        let dataArray = frameTuple[1];
                        this.dataFrame.loadFromArray(
                            dataArray,
                            relativeOrigin
                        );
                    });
                })
                .then(() => {
                    primaryFrame.updateCellContents();
                })
                .catch(err => {
                    console.error(err);
                });
        }
    }

    static get observedAttributes(){
        return ['rows', 'columns', 'locked-rows', 'locked-columns'];
    }
};

window.customElements.define('test-sheet', Sheet);
