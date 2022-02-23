import {makeDomElt as h} from '../Cell';

// object to let us show a "view" of a collection of divs indexed by a key.
// the view consists of placing a rectangle in the subspace indexed by
// 'upperLeft' and 'extent' at 'screenPos' in the parent view.

// because the browser gets confused by large pixel offsets, we manually maintain
// the desired position of each div, and then reposition each child when we reposition
// the view. This means that actual top/left coordinates in the divs are tractable numbers
// which prevents the browser from overflowing its coordinates.
class ViewOfDivs {
    constructor() {
        this.screenPos = [0, 0];
        this.upperLeft = [0, 0];
        this.extent = [0, 0];

        this.childDivs = {};
        this.childPositions = {};

        this.setChild = this.setChild.bind(this);
        this.hasChild = this.hasChild.bind(this);
        this.removeChild = this.removeChild.bind(this);
        this.children = this.children.bind(this);
        this.resetView = this.resetView.bind(this);
        this.clear = this.clear.bind(this);
        this.resetTouched = this.resetTouched.bind(this);
        this.touch = this.touch.bind(this);
        this.removeUntouched = this.removeUntouched.bind(this);

        this.mainDiv = h('div', {
            class: 'sheet-restriction-panel',
            style: `left:${this.screenPos[0]}px;top:${this.screenPos[1]}px;`
                +  `width:${this.extent[0]}px;`
                +  `height:${this.extent[1]}px;`

            },
            []
        );

        this.touched = {};
    }

    resetTouched() {
        this.touched = {}
    }

    touch(key) {
        this.touched[key] = true;
    }

    removeUntouched() {
        // remove any ones not visible anymore
        this.children().forEach((childKey) => {
            if (this.touched[childKey] === undefined) {
                this.removeChild(childKey);
            }
        });

        this.touched = {};
    }

    // place childDiv named by 'key' at 'pos' in our space
    setChild(key, childDiv, pos) {
        if (pos === undefined) {
            throw new Error("pos can't be undefined");
        }

        if (this.childDivs[key] !== undefined) {
            this.removeChild(key);
        }

        this.childDivs[key] = childDiv;
        this.childPositions[key] = pos;

        childDiv.style.left = (pos[0] - this.upperLeft[0]) + "px";
        childDiv.style.top = (pos[1] - this.upperLeft[1]) + "px";

        this.mainDiv.appendChild(childDiv);
    }

    removeChild(key) {
        this.mainDiv.removeChild(this.childDivs[key]);
        delete this.childDivs[key];
        delete this.childPositions[key];
    }

    hasChild(key) {
        return this.childDivs[key] !== undefined;
    }

    children() {
        return Object.keys(this.childDivs).map((x) => x);
    }

    resetView(screenPos, upperLeft, extent) {
        this.screenPos = screenPos;
        this.upperLeft = upperLeft;
        this.extent = extent;

        Object.keys(this.childDivs).forEach((childKey) => {
            let pos = this.childPositions[childKey];
            let div = this.childDivs[childKey];

            div.style.left = (pos[0] - this.upperLeft[0]) + 'px';
            div.style.top = (pos[1] - this.upperLeft[1]) + 'px';
        });

        this.mainDiv.style = (
            `left:${screenPos[0]}px;top:${screenPos[1]}px;`
            +  `width:${extent[0]}px;`
            +  `height:${extent[1]}px;`
        );
    }

    clear() {
        this.children().forEach((childKey) => {
            this.removeChild(childKey);
        });
    }
}

export {
    ViewOfDivs,
    ViewOfDivs as default
};
