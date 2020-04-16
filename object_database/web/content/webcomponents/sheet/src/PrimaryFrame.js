/**
 * APSheet PrimaryFrame Class
 * --------------------------------
 * The primary frame represents the overall
 * main "view" of the Sheet as it appears in the UI.
 * It is a composite of three possible visual Frames:
 * - A Frame for locked rows
 * - A Frame for locked columns
 * - A View Frame offset from the locked rows
 *   and columns.
 * It also holds references to an underlying DataFrame
 * and a Selector for interaction.
 */
import Frame from './Frame';
import DataFrame from './DataFrame';
import TableElementsFrame from './TableElementsFrame';
import {
    isCoordinate,
    Point
} from './Point';

class PrimaryFrame extends TableElementsFrame {
    constructor(dataFrame, corner, options){
        super([0,0], corner, options);

        // The underlyng dataframe will
        // hold values that we can pull out
        // for the current view, rows, and
        // columnds frames
        this.dataFrame = dataFrame;

        // We initialize with 0 locked
        // rows or columns
        this.numLockedRows = 0;
        this.numLockedColumns = 0;

        // Create initial empty frames
        // for the locked rows and locked
        // columns
        this.lockedRowsFrame = Frame.newEmpty();
        this.lockedColumnsFrame = Frame.newEmpty();

        // Because we have no locked columns or rows,
        // the view frame will initially have the dimensions
        // of the current instance.
        this.viewFrame = new Frame(this.origin, this.corner);

        // The dataOffset is an origin Point that
        // tells us where we are in the underlying
        // DataFrame
        this.dataOffset = new Point([0,0]);

        // Bind instance methods
        this.lockRows = this.lockRows.bind(this);
        this.lockColumns = this.lockColumns.bind(this);
        this.adjustLayout = this.adjustLayout.bind(this);
        this.labelElements = this.labelElements.bind(this);
        this.updateLockedRowElements = this.updateLockedRowElements.bind(this);
        this.shiftRightBy = this.shiftRightBy.bind(this);
        this.shiftLeftBy = this.shiftLeftBy.bind(this);
        this.shiftDownBy = this.shiftDownBy.bind(this);
        this.shiftUpBy = this.shiftUpBy.bind(this);
        this.pageUp = this.pageUp.bind(this);
        this.pageDown = this.pageDown.bind(this);
        this.pageLeft = this.pageLeft.bind(this);
        this.pageRight = this.pageRight.bind(this);
    }

    /**
     * Set the number of locked rows and modify the
     * current lockedRowsFrame accordingly.
     * Note that we adjust the layout after this step.
     * @param {Number} num - The number of rows we will
     * be locking (from the top).
     */
    lockRows(num){
        if(num <= 0){
            this.numLockedRows = 0;
            this.lockedRowsFrame = Frame.newEmpty();
        } else {
            this.lockedRowsFrame.isEmpty = false;
            this.lockedRowsFrame.origin = new Point(this.origin);
            this.lockedRowsFrame.corner = new Point([
                this.corner.x,
                this.origin.y + (num - 1)
            ]);
            this.numLockedRows = num;
        }
        this.adjustLayout();
    }

    /**
     * Set the number of locked columns and modify
     * the current lockedColumnsFrame accordingly.
     * Note that we adjust the layout after this step.
     * @param {Number} num - The number of columns
     * that will be locked (from the left)
     */
    lockColumns(num){
        if(num <= 0){
            this.numLockedColumns = 0;
            this.lockedColumnsFrame = Frame.newEmpty();
        } else {
            this.lockedColumnsFrame.isEmpty = false;
            this.lockedColumnsFrame.origin = new Point(this.origin);
            this.lockedColumnsFrame.corner = new Point([
                this.origin.x + (num - 1),
                this.corner.y
            ]);
            this.numLockedColumns = num;
        }
        this.adjustLayout();
    }

    /**
     * Adjust the layout of the constituent
     * lockedRow, lockedColumn, and view frames
     * based upon their current values and positions.
     * Note: We overlap rows and columns frames,
     * here the intersection is represented
     * as U
     * Example: 2 locked rows, 2 locked columns
     *     UURRRRRRRRRR
     *     UURRRRRRRRRR
     *     CCVVVVVVVVVV
     *     CCVVVVVVVVVV
     *     CCVVVVVVVVVV
     *     CCVVVVVVVVVV
     *     CCVVVVVVVVVV
     *     CCVVVVVVVVVV
     */
    adjustLayout(){
        this.viewFrame.origin.y = this.numLockedRows;
        this.viewFrame.origin.x = this.numLockedColumns;
    }

    labelElements(){
        let classesToClear = ['in-locked-row', 'in-locked-column', 'view-cell'];
        // Begin with columns
        this.lockedColumnsFrame.forEachPoint(aPoint => {
            let el = this.elementAt(aPoint);
            el.classList.remove(...classesToClear);
            el.classList.add('in-locked-column');
        });
        this.lockedRowsFrame.forEachPoint(aPoint => {
            let el = this.elementAt(aPoint);
            el.classList.remove(...classesToClear);
            el.classList.add('in-locked-row');
        });
        this.viewFrame.forEachPoint(aPoint => {
            let el = this.elementAt(aPoint);
            el.classList.remove(...classesToClear);
            el.classList.add('view-cell');
        });
    }

    updateCellContents(){
        this.updateLockedRowElements();
        this.updateLockedColumnElements();
        this.updateViewElements();

        // Update the locked frames intersection,
        // if there is one
        if(!this.lockedFramesIntersect.isEmpty){
            this.lockedFramesIntersect.forEachPoint(aPoint => {
                let value = this.dataFrame.getAt(aPoint);
                //this.elementAt(aPoint).innerText = value.toString();
                this.elementAt(aPoint).innerText = 'x';
            });
        }
    }

    updateLockedRowElements(){
        if(this.numLockedRows){
            this.relativeLockedRowsFrame.forEachPoint(aPoint => {
                let dataValue = this.dataFrame.getAt(aPoint);
                let translation = new Point([
                    (aPoint.x - this.dataOffset.x),
                    aPoint.y
                ]);
                this.elementAt(translation).innerText = dataValue.toString();
            });
        }
    }

    updateLockedColumnElements(){
        if(this.numLockedColumns){
            let relativeColumns = this.relativeLockedColumnsFrame;
            let offset = new Point([
                0,
                relativeColumns.origin.y - (this.lockedColumnsFrame.origin.y + this.numLockedRows)
            ]);
            relativeColumns.forEachPoint(aPoint => {
                let dataValue = this.dataFrame.getAt(aPoint);
                let translation = new Point([
                    aPoint.x,
                    aPoint.y - offset.y
                ]);
                this.elementAt(translation).innerText = dataValue.toString();
            });
        }
    }

    updateViewElements(){
        let offset = new Point([
            this.relativeViewFrame.origin.x - this.viewFrame.origin.x,
            this.relativeViewFrame.origin.y - this.viewFrame.origin.y
        ]);
        this.relativeViewFrame.forEachPoint(aPoint => {
            let value = this.dataFrame.getAt(aPoint);
            let translation = new Point([
                aPoint.x - offset.x,
                aPoint.y - offset.y
            ]);
            this.elementAt(translation).innerText = value.toString();
        });
    }

    /* Movement */

    shiftRightBy(amount){
        let nextX = this.dataOffset.x + amount;
        if((nextX + this.viewFrame.size.x) > this.dataFrame.right){
            nextX = this.dataFrame.right - this.viewFrame.size.x;
        }
        this.dataOffset.x = nextX;
    }

    shiftLeftBy(amount){
        let nextX = this.dataOffset.x - amount;
        if((nextX < this.viewFrame.left)){
            nextX = this.viewFrame.left;
        }
        this.dataOffset.x = nextX;
    }

    shiftDownBy(amount){
        let nextY = this.dataOffset.y + amount;
        if((nextY + this.viewFrame.size.y) > this.dataFrame.bottom){
            nextY = this.dataFrame.bottom - this.viewFrame.size.y;
        }
        this.dataOffset.y = nextY;
    }

    shiftUpBy(amount){
        let nextY = this.dataOffset.y - amount;
        if((nextY < this.viewFrame.top)){
            nextY = this.viewFrame.top;
        }
        this.dataOffset.y = nextY;
    }

    pageRight(){
        let amount = this.relativeViewFrame.size.x;
        this.shiftRightBy(amount);
    }

    pageLeft(){
        let amount = this.relativeViewFrame.size.x;
        this.shiftLeftBy(amount);
    }

    pageUp(){
        let amount = this.relativeViewFrame.size.y;
        this.shiftUpBy(amount);
    }

    pageDown(){
        let amount = this.relativeViewFrame.size.y;
        this.shiftDownBy(amount);
    }
    /**
     * This is the lockedRowsFrame relative
     * to the dataOffset point. Returns a totally
     * new Frame.
     */
    get relativeLockedRowsFrame(){
        if(this.numLockedRows){
            let relativeOrigin = [
                (this.lockedRowsFrame.origin.x + this.dataOffset.x),
                this.lockedRowsFrame.origin.y
            ];
            let relativeCorner = [
                (this.lockedRowsFrame.corner.x + this.dataOffset.x),
                this.lockedRowsFrame.corner.y
            ];
            return new Frame(relativeOrigin, relativeCorner);
        }
        return null;
    }

    /**
     * This is the lockedColumnsFrame relative
     * to the dataOffset point. Returns a totally
     * new Frame instance.
     */
    get relativeLockedColumnsFrame(){
        if(this.numLockedColumns){
            let relativeOrigin = [
                this.lockedColumnsFrame.origin.x,
                (this.dataOffset.y)
            ];
            let relativeCorner = [
                this.lockedColumnsFrame.corner.x,
                (this.dataOffset.y + this.viewFrame.size.y)
            ];
            return new Frame(relativeOrigin, relativeCorner);
        }
        return null;
    }

    /**
     * This is the View frame adjusted for the
     * dataOffset (ie, the origin and corner correspond to
     * some actual position over the dataFrame) and
     * the positions of any relative locked rows or
     * columns frames.
     * Returns a new Frame instance.
     */
    get relativeViewFrame(){
        let originX = Math.max(this.numLockedColumns, this.dataOffset.x);
        let originY = Math.max(this.numLockedRows, this.dataOffset.y);

        // In the case where the dataOffset x or y
        // is *less* than the current number of locked
        // rows or columns in the relevant dimension,
        // we have to set the appripriate value
        // to the offset plus the number of rows/columns
        if(this.dataOffset.y < this.numLockedRows){
            originY = this.numLockedRows + this.dataOffset.y;
        }
        if(this.dataOffset.x < this.numLockedColumns){
            originX = this.numLockedColumns + this.dataOffset.x;
        }
        let relativeOrigin = [
            originX,
            originY
        ];
        let relativeCorner = [
            (originX + this.viewFrame.size.x),
            (originY + this.viewFrame.size.y)
        ];
        return new Frame(relativeOrigin, relativeCorner);
    }

    /**
     * This is the frame representing the intersection
     * between the lockedRowsFrame and the
     * lockedColumnsFrame. We use this to permanently
     * fix data at this frame's points into the top
     * left corner, but only when there are *both*
     * locked columns and locked frames
     */
    get lockedFramesIntersect(){
        if(this.numLockedRows && this.numLockedColumns){
            return this.lockedColumnsFrame.intersection(this.lockedRowsFrame);
        }
        return Frame.newEmpty();
    }
};

export {
    PrimaryFrame,
    PrimaryFrame as default
};
