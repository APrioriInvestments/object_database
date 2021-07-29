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
        this.isPrimaryFrame = true;

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

        // Optional callbacks

        // Callback fired after the frames
        // have actually shifted
        this.afterChange = null;

        // Bind instance methods
        this.lockRows = this.lockRows.bind(this);
        this.lockColumns = this.lockColumns.bind(this);
        this.adjustLayout = this.adjustLayout.bind(this);
        this.labelElements = this.labelElements.bind(this);
        this.updateLockedRowElements = this.updateLockedRowElements.bind(this);
        this.relativePointAt = this.relativePointAt.bind(this);
        this.shiftRightBy = this.shiftRightBy.bind(this);
        this.shiftLeftBy = this.shiftLeftBy.bind(this);
        this.shiftDownBy = this.shiftDownBy.bind(this);
        this.shiftUpBy = this.shiftUpBy.bind(this);
        this.pageUp = this.pageUp.bind(this);
        this.pageDown = this.pageDown.bind(this);
        this.pageLeft = this.pageLeft.bind(this);
        this.pageRight = this.pageRight.bind(this);
        this.triggerAfterShift = this.triggerAfterShift.bind(this);
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

    /**
     * I add the appropriate CSS classes to any of
     * my td elements that are in a locked columns
     * or row frame, or the view frame.
     * I also clear any classes that no longer
     * apply to each element
     */
    labelElements(){
        let classesToClear = ['in-locked-row', 'in-locked-column', 'view-cell'];
        // Begin with columns
        this.lockedColumnsFrame.forEachPoint(aPoint => {
            let el = this.elementAt(aPoint);
            if (el !== null) {
                el.classList.remove(...classesToClear);
                el.classList.add('in-locked-column');
            }
        });
        this.lockedRowsFrame.forEachPoint(aPoint => {
            let el = this.elementAt(aPoint);
            if (el !== null) {
                el.classList.remove(...classesToClear);
                el.classList.add('in-locked-row');
            }
        });
        this.viewFrame.forEachPoint(aPoint => {
            let el = this.elementAt(aPoint);
            if (el !== null) {
                el.classList.remove(...classesToClear);
                el.classList.add('view-cell');
            }
        });

    }

    /**
     * I update the data-relative values
     * for each of my td elements.
     * This includes the data values for any
     * elements whose relative points appear
     * in locked column/row frames.
     * I also update the data-attributes
     * for each element such that they store
     * both the "absolute" (ie PrimaryFrame relative)
     * and "relative" (ie DataFrame relative) coordinate
     * values
     */
    updateCellContents(){
        this.updateLockedRowElements();
        this.updateLockedColumnElements();
        this.updateViewElements();

        // Update the locked frames intersection,
        // if there is one
        if(!this.lockedFramesIntersect.isEmpty){
            this.lockedFramesIntersect.forEachPoint(aPoint => {
                let value = this.dataFrame.getAt(aPoint);
                if(value == undefined){
                    this.setTextContentAt(aPoint, '...');
                } else {
                    this.setTextContentAt(aPoint, value.toString());
                }
            });
        }
    }

    /**
     * I update the data-relative values and
     * element data attributes for each of my td
     * elements that appears within the locked
     * rows frame.
     */
    updateLockedRowElements(){
        if(this.numLockedRows){
            this.relativeLockedRowsFrame.forEachPoint(aPoint => {
                let dataValue = this.dataFrame.getAt(aPoint);
                let translation = new Point([
                    (aPoint.x - this.dataOffset.x),
                    aPoint.y
                ]);
                let element = this.elementAt(translation);
                if(dataValue != undefined){
                    this.setTextContentAt(translation, dataValue.toString());
                } else {
                    this.setTextContentAt(translation, '...');
                }
                element.setAttribute('data-relative-x', aPoint.x);
                element.setAttribute('data-relative-y', aPoint.y);
            });
        }
    }

    /**
     * I update the data-relative values and
     * element data attributes for each of my td
     * elements that appears within the locked
     * columns frame.
     */
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
                let element = this.elementAt(translation);
                if (element !== null) {
                    if(dataValue != undefined){
                        this.setTextContentAt(translation, dataValue.toString());
                    } else {
                        this.setTextContentAt(translation, '...');
                    }
                    element.setAttribute('data-relative-x', aPoint.x);
                    element.setAttribute('data-relative-y', aPoint.y);
                }
            });
        }
    }

    /**
     * I update the data-relative values and
     * element data attributes for each of my td
     * elements that appears within my viewFrame.
     */
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
            let element = this.elementAt(translation);

            if (element !== null) {
                if(value != undefined){
                    this.setTextContentAt(translation, value.toString());
                } else {
                    this.setTextContentAt(translation, '...');
                }
                element.setAttribute('data-relative-x', aPoint.x);
                element.setAttribute('data-relative-y', aPoint.y);
            }
        });
    }

    /**
     * Given a Point on this PrimaryFrame, respond with
     * a Point that represents the data-relative translation,
     * ie where one can find what is currently being shown
     * at that point in the DataFrame.
     * Because all PrimaryFrame points also have corresponding
     * DOMElements, we can perform easily manipulations
     * @param {Point} aPoint - A PrimaryFrame absolute
     * Point for which we want to find the data-relative
     * translation
     * @param {Point} - A new Point that is the data-relative
     * translation of the provided Point
     */
    relativePointAt(aPoint){
        if(!this.contains(aPoint)){
            throw `PrimaryFrame does not contain ${aPoint}`;
        }
        // Because we store all relative values
        // in the elements themselves, we simply
        // pull from there
        let el = this.elementAt(aPoint);
        return new Point([
            parseInt(el.dataset.relativeX),
            parseInt(el.dataset.relativeY)
        ]);
    }

    /* Movement */

    /**
     * I attempt to move my constituent frames
     * to the right over my underlying dataFrame
     * by the specified number of Points.
     * If the given amount would set my frames beyond
     * the bounds of the dataFrame, I simply stop
     * at the maximum possible position in that direction.
     * Note that I will also attempt to trigger an
     * `afterChange` callback when done, should one be
     * set.
     * @param {number} amount - The number of Points to
     * shift right by over the underlying dataFrame
     */
    shiftRightBy(amount){
        let nextX = this.dataOffset.x + amount;
        let nextRight = nextX + (this.viewFrame.size.x + this.numLockedColumns);
        if(nextRight >= this.dataFrame.right){
            nextX = this.dataFrame.right - (this.numLockedColumns + this.viewFrame.size.x);
        }
        this.dataOffset.x = nextX;
        this.updateCellContents();
        this.triggerAfterShift();
    }

    /**
     * I attempt to move my constituent frames
     * to the left over my underlying dataFrame
     * by the specified number of Points.
     * If the given amount would set my frames beyond
     * the bounds of the dataFrame, I simply stop
     * at the maximum possible position in that direction.
     * Note that I will also attempt to trigger an
     * `afterChange` callback when done, should one be
     * set.
     * @param {number} amount - The number of Points to
     * shift left by over the underlying dataFrame
     */
    shiftLeftBy(amount){
        let nextX = this.dataOffset.x - amount;
        if((nextX < this.viewFrame.left)){
            nextX = 0;
        }
        this.dataOffset.x = nextX;
        this.updateCellContents();
        this.triggerAfterShift();
    }

    /**
     * I attempt to move my constituent frames
     * down over my underlying dataFrame
     * by the specified number of Points.
     * If the given amount would set my frames beyond
     * the bounds of the dataFrame, I simply stop
     * at the maximum possible position in that direction.
     * Note that I will also attempt to trigger an
     * `afterChange` callback when done, should one be
     * set.
     * @param {number} amount - The number of Points to
     * shift down by over the underlying dataFrame
     */
    shiftDownBy(amount, debug=false){
        let nextY = this.dataOffset.y + amount;
        let nextBottom = nextY + (this.viewFrame.size.y + this.numLockedRows);
        if(nextBottom >= this.dataFrame.bottom){
            nextY = this.dataFrame.bottom - (this.numLockedRows + this.viewFrame.size.y);
        }
        this.dataOffset.y = nextY;
        this.updateCellContents();
        this.triggerAfterShift();
    }

    /**
     * I attempt to move my constituent frames
     * up over my underlying dataFrame
     * by the specified number of Points.
     * If the given amount would set my frames beyond
     * the bounds of the dataFrame, I simply stop
     * at the maximum possible position in that direction.
     * Note that I will also attempt to trigger an
     * `afterChange` callback when done, should one be
     * set.
     * @param {number} amount - The number of Points to
     * shift up by over the underlying dataFrame
     */
    shiftUpBy(amount){
        let nextY = this.dataOffset.y - amount;
        if((nextY < this.viewFrame.top)){
            nextY = 0;
        }
        this.dataOffset.y = nextY;
        this.updateCellContents();
        this.triggerAfterShift();
    }

    /**
     * I trigger a `shiftRightBy` call with
     * an amount equivalent to my own total width
     */
    pageRight(){
        let amount = this.relativeViewFrame.size.x;
        this.shiftRightBy(amount);
    }

    /**
     * I trigger a `shiftLeftBy` call with
     * an amount equivalent to my own total width
     */
    pageLeft(){
        let amount = this.relativeViewFrame.size.x;
        this.shiftLeftBy(amount);
    }

    /**
     * I trigger a `shiftUpBy` call with
     * an amount equivalent to my own total height
     */
    pageUp(){
        let amount = this.relativeViewFrame.size.y;
        this.shiftUpBy(amount);
    }

    /**
     * I trigger a `shiftDownBy` call with
     * an amount equivalent to my own total height
     */
    pageDown(){
        let amount = this.relativeViewFrame.size.y;
        this.shiftDownBy(amount);
    }

    /**
     * If there is a callback set on my
     * `afterChange` attribute, I will call it.
     * I am usually triggered after any type of
     * shift has taken place
     */
    triggerAfterShift(){
        if(this.afterChange){
            this.afterChange(this);
        }
    }

    /**
     * This is the lockedRowsFrame relative
     * to the dataOffset point. Returns a totally
     * new Frame.
     * @returns {Frame} - A new Frame whose Points
     * correspond to data-relative Points for the
     * current locked rows.
     */
    get relativeLockedRowsFrame(){
        if(this.numLockedRows){
            let relativeOrigin = [
                (this.lockedRowsFrame.origin.x + this.dataOffset.x + this.numLockedColumns),
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
     * @returns {Frame} - A new Frame whose Points
     * correspond to data-relative Points for the
     * current locked columns.
     */
    get relativeLockedColumnsFrame(){
        if(this.numLockedColumns){
            let relativeOrigin = [
                this.lockedColumnsFrame.origin.x,
                (this.dataOffset.y + this.numLockedRows)
            ];
            let relativeCorner = [
                this.lockedColumnsFrame.corner.x,
                (this.dataOffset.y + this.corner.y)
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
     * @returns {Frame} - A new Frame whose Points
     * correspond to data-relative Points for the
     * current relative view.
     */
    get relativeViewFrame(){
        let origin = new Point([
            (this.dataOffset.x + this.numLockedColumns),
            (this.dataOffset.y + this.numLockedRows)
        ]);
        let corner = new Point([
            Math.max(origin.x, this.corner.x + this.dataOffset.x),
            Math.max(origin.y, this.corner.y + this.dataOffset.y)
        ]);
        return new Frame(origin, corner);
    }

    /**
     * This is the frame representing the intersection
     * between the lockedRowsFrame and the
     * lockedColumnsFrame. We use this to permanently
     * fix data at this frame's points into the top
     * left corner, but only when there are *both*
     * locked columns and locked frames
     * @returns {Frame} - A new Frame instance representing
     * the intersection of locked rows/locked columns frame,
     * should both be present and non-empty
     */
    get lockedFramesIntersect(){
        if(this.numLockedRows && this.numLockedColumns){
            return this.lockedColumnsFrame.intersection(this.lockedRowsFrame);
        }
        return Frame.newEmpty();
    }

    /**
     * Returns true if the viewFrame is completely
     * to the left side of the corresponding dataFrame,
     * adjusted for locked columns
     * @returns {boolean} - Whether or not the viewFrame
     * is leftmost relative to the underlying dataFrame
     */
    get isAtLeft(){
        return this.dataOffset.x == 0;
    }

    /**
     * Returns true if the relativeViewFrame's
     * right side is equal to the dataFrame's
     * right side (ie we are all the way right)
     * @returns {boolean} - Whether or not the viewFrame
     * is rightmost relative to the underlying dataFrame
     */
    get isAtRight(){
        return this.relativeViewFrame.right == this.dataFrame.right;
    }

    /**
     * Returns true if the relativeViewFrame
     * is at the total possible top, taking
     * into consideration any locked rows.
     * @returns {boolean} - Whether or not the viewFrame
     * is top-most relative to the underlying dataFrame
     */
    get isAtTop(){
        return this.dataOffset.y == 0;
    }

    /**
     * Returns true if the relativeViewFrame
     * is at the total possible bottom
     * @returns {boolean} - Whether or not the viewFrame
     * is bottom-most relative to the underlying dataFrame
     */
    get isAtBottom(){
        return this.relativeViewFrame.bottom == this.dataFrame.bottom;
    }
};

export {
    PrimaryFrame,
    PrimaryFrame as default
};
