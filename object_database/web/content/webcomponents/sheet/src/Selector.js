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

        // Set a cursor point to track.
        // We begin it at the origin of the
        // single celled selectionFrame
        this.cursor = new Point([
            this.selectionFrame.origin.x,
            this.selectionFrame.origin.y
        ]);

        // We hold old values for cursor
        // for restyling and debugging
        // purposes
        this.prevCursorEl = null;

        // Bind methods
        this.moveRightBy = this.moveRightBy.bind(this);
        this.moveLeftBy = this.moveLeftBy.bind(this);
    }

    moveRightBy(amount){
        let rightDiff = (this.cursor.x + amount) - this.primaryFrame.viewFrame.right;
        if(rightDiff > 0){
            console.log(`Moving beyond right boundary by ${rightDiff}`);
            this.primaryFrame.shiftRightBy(rightDiff);
        } else {
            console.log(`Moving right by ${amount}`);
            this.cursor.x += amount;
        }
    }

    moveLeftBy(amount){
        let nextPos = (this.cursor.x - amount);
        if(this.primaryFrame.isCompletelyLeft){
            // If the view is already all the way left,
            // then a nextPos that is less than the
            // whole frame is all that matters, ie
            // we can navigate into locked columns,
            // if any.
            if(nextPos <= this.primaryFrame.left){
                nextPos = this.primaryFrame.left;
            }
            this.cursor.x = nextPos;
        } else if(nextPos < this.primaryFrame.viewFrame.left) {
            // If the nextPos less than the viewFrame left,
            // we need to move the view left by
            // the difference, then move the cursor
            // to the leftmost
            let diff = this.primaryFrame.viewFrame.left - nextPos;
            this.primaryFrame.shiftLeftBy(diff);
            this.cursor.x = this.primaryFrame.viewFrame.left;
        } else {
            this.cursor.x = nextPos;
        }
    }

    drawCursor(){
        let element = this.primaryFrame.elementAt(this.cursor);
        element.classList.add('selector-cursor');
        if(this.prevCursorEl && this.prevCursorEl != element){
            this.prevCursorEl.classList.remove('selector-cursor');
        }
        this.prevCursorEl = element;
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
