/**
 * APSheet Selector Class
 * ----------------------
 * Handles all selection and cursor
 * interaction over a PrimaryFrame
 */
import Point from './Point';
import Frame from './Frame';

class Selector {
    constructor(primaryFrame){
        if(!primaryFrame || !primaryFrame.isPrimaryFrame){
            throw 'Selector must be initialized with a valid PrimaryFrame!';
        }
        this.primaryFrame = primaryFrame;

        // Set up the internal selectionFrame,
        // which is relative to the primaryFrame
        // The initial origin / corner should be
        // the origin of the underlying viewFrame,
        // as this is where we will set our cursor
        this.selectionFrame = new Frame(
            this.primaryFrame.viewFrame.origin,
            this.primaryFrame.viewFrame.origin
        );
        this.selectionFrame.isEmpty = true;

        // Set a cursor point to track.
        // We begin it at the origin of the
        // single celled selectionFrame
        this.cursor = new Point([
            this.selectionFrame.origin.x,
            this.selectionFrame.origin.y
        ]);

        // Anchor is a point that is relative
        // to the DataFrame. During selection
        // actions, the cursor moves but the
        // anchor point does not. It remains
        // where the cursor was originally,
        // and thus we use both the anchor
        // and relative cursor to make selection
        // frames.
        this.anchor = this.relativeCursor;

        // We hold old values for cursor
        // for restyling and debugging
        // purposes
        this.prevCursorEl = null;

        // Bind methods
        this.moveRightBy = this.moveRightBy.bind(this);
        this.moveLeftBy = this.moveLeftBy.bind(this);
        this.moveUpBy = this.moveUpBy.bind(this);
        this.moveDownBy = this.moveDownBy.bind(this);
        this.pageUp = this.pageUp.bind(this);
        this.pageDown = this.pageDown.bind(this);
        this.pageRight = this.pageRight.bind(this);
        this.pageLeft = this.pageLeft.bind(this);
        this.moveToRightEnd = this.moveToRightEnd.bind(this);
        this.moveToLeftEnd = this.moveToLeftEnd.bind(this);
        this.moveToTopEnd = this.moveToTopEnd.bind(this);
        this.moveToBottomEnd = this.moveToBottomEnd.bind(this);
        this.selectFromAnchorTo = this.selectFromAnchorTo.bind(this);
        this.setAnchorToElement = this.setAnchorToElement.bind(this);
        this.setCursorToElement = this.setCursorToElement.bind(this);
        this.updateElements = this.updateElements.bind(this);
        this.drawAnchor = this.drawAnchor.bind(this);
        this.drawCursor = this.drawCursor.bind(this);
    }

    /**
     * I move the cursor right by the given
     * amount.
     * If `selecting` is set to true, I also
     * update the selectionFrame accordingly.
     * In the event that I am to the right of
     * the current viewFrame already, but there
     * is more underlying data at the Point where
     * the cursor should next be, I will trigger
     * a `shiftRightBy` call on the underlying primaryFrame.
     * @param {number} amount - The number of Points
     * to move the cursor right by
     * @param {boolean} selecting - Whether or not to
     * "select" during the move, meaning update the
     * internal selectionFrame.
     */
    moveRightBy(amount, selecting=false){
        let nextCursor = new Point([
            this.cursor.x,
            this.cursor.y
        ]);
        let rightDiff = (nextCursor.x + amount) - this.primaryFrame.viewFrame.right;
        if(rightDiff > 0){
            nextCursor.x = this.primaryFrame.right;
            this.primaryFrame.shiftRightBy(rightDiff);
        } else {
            nextCursor.x += amount;
        }

        if(selecting){
            this.cursor = nextCursor;
            this.selectFromAnchorTo(this.relativeCursor);
        } else {
            this.selectionFrame.isEmpty = true;
            this.cursor = nextCursor;
            this.anchor = this.relativeCursor;
        }

        this.updateElements();
    }

    /**
     * I move the cursor left by the given
     * amount.
     * If `selecting` is set to true, I will
     * update my underlying selectionFrame
     * accordingly.
     * In the event that I am to the left of
     * the current viewFrame, but there is more
     * data to the left, I will trigger a
     * `shiftLeftBy` on the underlying
     * primaryFrame.
     * @param {number} amount - The number of
     * Points to shift left by
     * @param {boolean} selecting - Whether or
     * not to "select" during the move and
     * update my current selectionFrame
     */
    moveLeftBy(amount, selecting=false){
        let nextCursor = new Point([
            this.cursor.x,
            this.cursor.y
        ]);
        let nextPos = (this.cursor.x - amount);
        if(this.primaryFrame.isAtLeft){
            // If the view is already all the way left,
            // then a nextPos that is less than the
            // whole frame is all that matters, ie
            // we can navigate into locked columns,
            // if any.
            if(nextPos <= this.primaryFrame.left){
                nextPos = this.primaryFrame.left;
            }
            nextCursor.x = nextPos;
        } else if(nextPos < this.primaryFrame.viewFrame.left) {
            // If the nextPos less than the viewFrame left,
            // we need to move the view left by
            // the difference, then move the cursor
            // to the leftmost
            let diff = this.primaryFrame.viewFrame.left - nextPos;
            this.primaryFrame.shiftLeftBy(diff);
            nextCursor.x = this.primaryFrame.viewFrame.left;
        } else {
            nextCursor.x = nextPos;
        }

        if(selecting){
            this.cursor = nextCursor;
            this.selectFromAnchorTo(this.relativeCursor);
        } else {
            this.selectionFrame.isEmpty = true;
            this.cursor = nextCursor;
            this.anchor = this.relativeCursor;
        }

        this.updateElements();
    }

    /**
     * I move the cursor up by the given amount.
     * If `selecting` is set to true, I also
     * update my internal selectionFrame
     * accordingly.
     * If the cursor is already at the top of
     * the current viewFrame and there is more
     * data further up, I will trigger a
     * `shiftUpBy` call on my underling primaryFrame
     * by the correct amount.
     * @param {number} amount - The number of Points
     * to move the cursor up by
     * @param {selecting} - Whether or not to
     * "select" during the move and update the
     * selectionFrame.
     */
    moveUpBy(amount, selecting=false){
        let nextCursor = new Point([
            this.cursor.x,
            this.cursor.y
        ]);
        let nextPos = (this.cursor.y - amount);
        if(this.primaryFrame.isAtTop){
            // If the view is already at the top,
            // then a nextPos that is less than the
            // whole frame is all that matters, ie
            // we can navigate into locked rows,
            // if any.
            if(nextPos <= this.primaryFrame.top){
                nextPos = this.primaryFrame.top;
            }
            nextCursor.y = nextPos;
        } else if(nextPos < this.primaryFrame.viewFrame.top){
            // If the nextPos is less than viewFrame top,
            // we need to move the view up by the difference,
            // then move the cursor to the topmost position.
            let diff = this.primaryFrame.viewFrame.top - nextPos;
            this.primaryFrame.shiftUpBy(diff);
            nextCursor.y = this.primaryFrame.viewFrame.top;
        } else {
            nextCursor.y = nextPos;
        }

        if(selecting){
            this.cursor = nextCursor;
            this.selectFromAnchorTo(this.relativeCursor);
        } else {
            this.selectionFrame.isEmpty = true;
            this.cursor = nextCursor;
            this.anchor = this.relativeCursor;
        }

        this.updateElements();
    }

    /**
     * I move the cursor down by the given amount.
     * If `selecting` is set to true, I also update
     * my underlying selectionFrame accordingly.
     * If I am at the bottom of the current viewFrame
     * and there is further data below, I will trigger
     * a call to `shiftDownBy` on my underling
     * primaryFrame with the correct adjusted amount.
     * @param {number} amount - The number of Points to
     * move the cursor down by
     * @param {boolean} selecting - Whether or not to
     * "select" during the move, updating the
     * selectionFrame
     */
    moveDownBy(amount, selecting=false){
        let nextCursor = new Point([
            this.cursor.x,
            this.cursor.y
        ]);
        let downDiff = (nextCursor.y + amount) - this.primaryFrame.viewFrame.bottom;
        if(downDiff > 0){
            nextCursor.y = this.primaryFrame.bottom;
            this.primaryFrame.shiftDownBy(downDiff);
        } else {
            nextCursor.y += amount;
        }

        if(selecting){
            this.cursor = nextCursor;
            this.selectFromAnchorTo(this.relativeCursor);
        } else {
            this.selectionFrame.isEmpty = true;
            this.cursor = nextCursor;
            this.anchor = this.relativeCursor;
        }

        this.updateElements();
    }

    /**
     * I trigger a `moveUp` call whose
     * amount is equal to the current page
     * height.
     * If `selecting` is true, I will also
     * update the selectionFrame accordingly.
     * @param {boolean} selecting - Whether or
     * not to "select" during the move and
     * update the underlying selectionFrame
     */
    pageUp(selecting=false){
        this.moveUpBy(
            this.pageSize.y,
            selecting
        );
    }

    /**
     * I trigger a `moveDownBy` call whose
     * amount is equal to the current page
     * height.
     * @param {boolean} selecting - Whether
     * or not to "select" during the move and
     * update the underlying selectionFrame
     */
    pageDown(selecting=false){
        this.moveDownBy(
            this.pageSize.y,
            selecting
        );
    }

    /**
     * I trigger a `moveRightBy` call whose
     * amount is equal to the current page
     * width.
     * @param {boolean} selecting - Whether
     * or not to "select" during the move and
     * update the underlying selectionFrame
     */
    pageRight(selecting=false){
        this.moveRightBy(
            this.pageSize.x,
            selecting
        );
    }

    /**
     * I trigger a `moveLeftBy` call whose
     * amount i equal to the current page
     * width.
     * @param {boolean} selecting - Whether
     * or not to "select" during the move and
     * update the underlying selectionFrame
     */
    pageLeft(selecting=false){
        this.moveLeftBy(
            this.pageSize.x,
            selecting
        );
    }

    /**
     * I move the cursor to the rightmost
     * end of the data, triggering any needed
     * shift on the underlying primaryFrame.
     * @param {boolean} selecting - Whether or not
     * to "select" during the move and update the
     * selectionFrame accordingly
     */
    moveToRightEnd(selecting=false){
        // Move by any amount greather than the dataFrame
        // size
        this.moveRightBy(
            this.primaryFrame.dataFrame.right * 2,
            selecting
        );
    }

    /**
     * I move the cursor to the leftmost
     * end of the data, triggering any needed
     * shift on the underlying primaryFrame
     * @param {boolean} selecting - Whether or not
     * to "select" during the move and update the
     * selectionFrame accordingly
     */
    moveToLeftEnd(selecting=false){
        // Move by any amout greather than dataFrame size
        this.moveLeftBy(
            this.primaryFrame.dataFrame.size.x * 2,
            selecting
        );
    }

    /**
     * I move the cursor to the topmost
     * end of the data, triggering any needed
     * shift on the underlying primaryFrame.
     * @param {boolean} selecting - Whether or not
     * to "select" during the move and update the
     * selectionFrame accordingly
     */
    moveToTopEnd(selecting=false){
        // Move up by any amount greather than
        // the dataFrame's total height
        this.moveUpBy(
            this.primaryFrame.dataFrame.size.y * 2,
            selecting
        );
    }

    /**
     * I move the cursor to the bottom-most
     * end of the data, triggering any needed
     * shift on the underlying primaryFrame
     * @param {boolean} selecting - Whether or not
     * to "select" during the move and update the
     * selectionFrame accordingly
     */
    moveToBottomEnd(selecting=false){
        // Move down by any amount greather than
        // the dataFrame's total height
        this.moveDownBy(
            this.primaryFrame.dataFrame.size.y * 2,
            selecting
        );
    }

    /**
     * I find the td element at the current
     * cursor location on the primaryFrame
     * and add the appropriate CSS class to it.
     * If there is a cached previousCursor, I
     * remove the CSS class from it.
     */
    drawCursor(withAnchor=false){
        let element = this.primaryFrame.elementAt(this.cursor);
        element.classList.add('selector-cursor');
        if(withAnchor){
            element.classList.add('selector-anchor');
        }
        if(this.prevCursorEl && this.prevCursorEl != element){
            this.prevCursorEl.classList.remove('selector-cursor');
        }
        this.prevCursorEl = element;
    }

    /**
     * I find the td element at the current
     * anchor location on the primaryFrame
     * and add the appropriate CSS class to it.
     * Note that if my anchor and cursor points
     * are equivalent, I only call `drawCursor`
     */
    drawAnchor(){
        if(this.anchor.equals(this.relativeCursor)){
            return this.drawCursor(true);
        }
        let absoluteAnchor = new Point([
            this.anchor.x - this.primaryFrame.dataOffset.x,
            this.anchor.y - this.primaryFrame.dataOffset.y
        ]);
        if(this.primaryFrame.contains(absoluteAnchor)){
            let element = this.primaryFrame.elementAt(absoluteAnchor);
            element.classList.add('selector-anchor');
        }
    }

    /**
     * I loop through each of the Points in my
     * underlying primaryFrame and add/remove
     * CSS classes to each corresponding td element
     * as needed.
     * The styling added here includes:
     * - Removing borders from old selections,
     *   cursors, and anchors
     * - Adding CSS classes for any element whose
     *   corresponding data-relative Point is
     *   within the current selectionFrame
     */
    updateElements(){
        this.primaryFrame.forEachPoint(aPoint => {
            let relativePoint = this.primaryFrame.relativePointAt(aPoint);
            let element = this.primaryFrame.elementAt(aPoint);
            let hasSelection = !this.selectionFrame.isEmpty;

            // Clear previous selection borders
            element.classList.remove(
                'selection-top-border',
                'selection-bottom-border',
                'selection-right-border',
                'selection-left-border'
            );

            // If the relative point is in the selectionFrame,
            // give the element the appropriate class
            if(hasSelection && this.selectionFrame.contains(relativePoint)){
                element.classList.add('in-selection');
                if(relativePoint.y == this.selectionFrame.top){
                    element.classList.add('selection-top-border');
                }
                if(relativePoint.y == this.selectionFrame.bottom){
                    element.classList.add('selection-bottom-border');
                }
                if(relativePoint.x == this.selectionFrame.left){
                    element.classList.add('selection-left-border');
                }
                if(relativePoint.x == this.selectionFrame.right){
                    element.classList.add('selection-right-border');
                }
            } else {
                element.classList.remove('in-selection');
            }

            // Remove all former cursor or anchor styles
            element.classList.remove(
                'selector-anchor',
                'selector-cursor'
            );
        });

        // Give the cursor the correct cursor
        // class
        this.drawCursor();

        // Draw the anchor element
        this.drawAnchor();
    }

    /**
     * I set my selectionFrame to a new
     * Frame that extends from my current
     * anchor (which is relative to the dataFrame)
     * some other point that is relative to
     * the dataFrame.
     * @param {Point} aRelativePoint - Some Point
     * instance that corresponds to a Point on the
     * underlying dataFrame. This Point is data-relative.
     */
    selectFromAnchorTo(aRelativePoint){
        this.selectionFrame = Frame.fromPointToPoint(
            this.anchor,
            aRelativePoint
        );
        this.selectionFrame.isEmpty = false;
    }

    /**
     * I set the anchor to be the relative point
     * described by the passed in td element.
     * I will throw an error if the element
     * is not contained within the PrimaryFrame's
     * collection of td elements
     * @param {HTMLElement} anElement - The td
     * element in the PrimaryFrame that we want
     * to use as the anchor.
     */
    setAnchorToElement(anElement){
        if(!this.primaryFrame.tdElements.includes(anElement)){
            throw new Error(`Element ${anElement} not included in PrimaryFrame`);
        }
        let relX = parseInt(anElement.dataset.relativeX);
        let relY = parseInt(anElement.dataset.relativeY);
        this.anchor = new Point([relX,relY]);
        if(this.anchor.equals(this.relativeCursor)){
            this.selectionFrame.isEmpty = true;
        }
    }

    /**
     * I set the cursor to be the absolute
     * point described by the passed-in td
     * element.
     * I will throw an error if the element is
     * not contained within the PrimaryFrame's
     * collection of td elements.
     * @param {HTMLElement} anElement - The td
     * element in the PrimaryFrame that we want
     * to use as the cursor
     */
    setCursorToElement(anElement){
        if(!this.primaryFrame.tdElements.includes(anElement)){
            throw new Error(`Element ${anElement} not included in PrimaryFrame`);
        }
        let x = parseInt(anElement.dataset.x);
        let y = parseInt(anElement.dataset.y);
        this.cursor = new Point([x,y]);
        if(this.anchor.equals(this.relativeCursor)){
            this.selectionFrame.isEmpty = true;
        }
    }


    /**
     * Responds with a new Point that
     * represents the data-relative
     * Point under the cursor.
     * @returns {Point} - A data-relative
     * Point based on the primaryFrame absolute
     * Point given by my current cursor location
     * @returns {Point} - A data-relative Point
     * corresponding to the cursor location
     */
    get relativeCursor(){
        let el = this.primaryFrame.elementAt(this.cursor);
        return new Point([
            parseInt(el.dataset.relativeX),
            parseInt(el.dataset.relativeY)
        ]);
    }

    /**
     * Respond with the data at the current
     * cursor.
     * Note that we use relativeCursor to
     * do so.
     * @returns {object} - The stored data value
     * at the current relative cursor point
     */
    get dataAtCursor(){
        let dataValue = this.primaryFrame.dataFrame.getAt(
            this.relativeCursor
        );
        if(dataValue == undefined){
            return 'undefined';
        }
        return dataValue;
    }

    /**
     * Returns a point whose x and y values
     * are the corresponding size of the current
     * page. In most cases this will be identical
     * to the primaryFrame's viewFrame.
     * We include here for readability
     * @returns {Point} - A Point whose x and
     * y values are the size of the current page
     */
    get pageSize(){
        return this.primaryFrame.viewFrame.size;
    }
};

export {
    Selector,
    Selector as default
};
