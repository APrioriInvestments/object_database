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

        // Tell us whether or not we are
        // currently "selecting". Used
        // in concert with movement methods
        this.isSelecting = false;

        // Bind methods
        this.moveRightBy = this.moveRightBy.bind(this);
        this.moveLeftBy = this.moveLeftBy.bind(this);
        this.moveUpBy = this.moveUpBy.bind(this);
        this.moveDownBy = this.moveDownBy.bind(this);
        this.selectFromAnchorTo = this.selectFromAnchorTo.bind(this);
        this.updateElements = this.updateElements.bind(this);
        this.drawAnchor = this.drawAnchor.bind(this);
        this.drawCursor = this.drawCursor.bind(this);
    }

    moveRightBy(amount){
        let nextCursor = new Point([
            this.cursor.x,
            this.cursor.y
        ]);
        let rightDiff = (nextCursor.x + amount) - this.primaryFrame.viewFrame.right;
        if(rightDiff > 0){
            this.primaryFrame.shiftRightBy(rightDiff);
        } else {
            nextCursor.x += amount;
        }

        if(this.isSelecting){
            this.cursor = nextCursor;
            this.selectFromAnchorTo(this.relativeCursor);
        } else {
            this.selectionFrame.isEmpty = true;
            this.cursor = nextCursor;
            this.anchor = this.relativeCursor;
        }

        this.updateElements();
    }

    moveLeftBy(amount){
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

        if(this.isSelecting){
            this.cursor = nextCursor;
            this.selectFromAnchorTo(this.relativeCursor);
        } else {
            this.selectionFrame.isEmpty = true;
            this.cursor = nextCursor;
            this.anchor = this.relativeCursor;
        }

        this.updateElements();
    }

    moveUpBy(amount){
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

        if(this.isSelecting){
            this.cursor = nextCursor;
            this.selectFromAnchorTo(this.relativeCursor);
        } else {
            this.selectionFrame.isEmpty = true;
            this.cursor = nextCursor;
            this.anchor = this.relativeCursor;
        }

        this.updateElements();
    }

    moveDownBy(amount){
        let nextCursor = new Point([
            this.cursor.x,
            this.cursor.y
        ]);
        let downDiff = (nextCursor.y + amount) - this.primaryFrame.viewFrame.bottom;
        if(downDiff > 0){
            this.primaryFrame.shiftDownBy(downDiff);
        } else {
            nextCursor.y += amount;
        }

        if(this.isSelecting){
            this.cursor = nextCursor;
            this.selectFromAnchorTo(this.relativeCursor);
        } else {
            this.selectionFrame.isEmpty = true;
            this.cursor = nextCursor;
            this.anchor = this.relativeCursor;
        }

        this.updateElements();
    }

    drawCursor(){
        let element = this.primaryFrame.elementAt(this.cursor);
        element.classList.add('selector-cursor');
        if(this.prevCursorEl && this.prevCursorEl != element){
            this.prevCursorEl.classList.remove('selector-cursor');
        }
        this.prevCursorEl = element;
    }

    drawAnchor(){
        if(this.anchor.equals(this.relativeCursor)){
            return this.drawCursor();
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

    updateElements(){

        // Loop through each Point in the PrimaryFrame
        // and update appropriate elements as needed.
        this.primaryFrame.forEachPoint(aPoint => {
            let relativePoint = this.primaryFrame.relativePointAt(aPoint);
            let element = this.primaryFrame.elementAt(aPoint);
            let hasSelection = !this.selectionFrame.isEmpty;

            // If the relative point is in the selectionFrame,
            // give the element the appropriate class
            if(hasSelection && this.selectionFrame.contains(relativePoint)){
                element.classList.add('in-selection');
            } else {
                element.classList.remove('in-selection');
            }

            // Remove all former cursor or anchor styles
            element.classList.remove('selector-anchor', 'selector-cursor');
        });

        // Give the cursor the correct cursor
        // class
        this.drawCursor();

        // Draw the anchor element
        this.drawAnchor();
    }

    selectFromAnchorTo(aRelativePoint){
        this.selectionFrame = Frame.fromPointToPoint(
            this.anchor,
            aRelativePoint
        );
        this.selectionFrame.isEmpty = false;
    }


    /**
     * Responds with a new Point that
     * represents the data-relative
     * Point under the cursor
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
     */
    get dataAtCursor(){
        return this.primaryFrame.dataFrame.getAt(this.relativeCursor);
    }
};

export {
    Selector,
    Selector as default
};
