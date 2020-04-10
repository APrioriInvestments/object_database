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
     * Note: Locked rows come first, then columns, then
     * the view frame.
     * Example: 2 locked rows, 2 locked columns
     *     RRRRRRRRRRRR
     *     RRRRRRRRRRRR
     *     CCVVVVVVVVVV
     *     CCVVVVVVVVVV
     *     CCVVVVVVVVVV
     *     CCVVVVVVVVVV
     *     CCVVVVVVVVVV
     *     CCVVVVVVVVVV
     */
    adjustLayout(){
        this.lockedColumnsFrame.origin.y = this.numLockedRows;
        this.viewFrame.origin.y = this.numLockedRows;
        this.viewFrame.origin.x = this.numLockedColumns;
        this.labelElements();
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
        this.relativeViewFrame.forEachPoint(point => {
            let value = this.dataFrame.getAt(point);
            this.elementAt(point).innerText = value;
        });
    }

    /**
     * This is the lockedRowsFrame relative
     * to the dataOffset point. Returns a totally
     * new Frame.
     */
    get relativeLockedRowsFrame(){
        if(this.numLockedRows){
            let relativeOrigin = [
                (this.lockedRowsFrame.origin.x + this.dataOffset.origin.x),
                this.lockedRowsFrame.origin.y
            ];
            let relativeCorner = [
                (this.lockedRowsFrame.corner.x + this.dataOffset.corner.x),
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
                this.lockedRowsFrame.origin.x,
                (this.lockedRowsFrame.origin.y + this.dataOffset.y)
            ];
            let relativeCorner = [
                this.lockedRowsFrame.corner.x,
                (this.lockedRowsFrame.corner.y + this.dataOffset.y)
            ];
            return new Frame(relativeOrigin, relativeCorner);
        }
        return null;
    }

    /**
     * This is the View frame adjusted for the
     * dataOffset (ie, the origin and corner correspond to
     * some actual position over the dataFrame)
     * Returns a new Frame instance.
     */
    get relativeViewFrame(){
        let relativeOrigin = [
            (this.viewFrame.origin.x + this.dataOffset.x),
            (this.viewFrame.origin.y + this.dataOffset.y)
        ];
        let relativeCorner = [
            (this.viewFrame.corner.x + this.dataOffset.x),
            (this.viewFrame.corner.y + this.dataOffset.y)
        ];
        return new Frame(relativeOrigin, relativeCorner);
    }
};

export {
    PrimaryFrame,
    PrimaryFrame as default
};
