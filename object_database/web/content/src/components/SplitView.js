/**
 * SplitView Cell Cell
 * -------------------------
 * A SplitView cell is a display container
 * that is either horizontal or vertical
 * that uses flexbox to divide up its child
 * Cells according to an array of proportions
 * that are passed in.
 */

import {makeDomElt as h} from './Cell';
import {ConcreteCell} from './ConcreteCell';

/**
 * About Named Children
 * ---------------------
 * `elements` (array) - The contained Cell elements
 */
class SplitView extends ConcreteCell {
    constructor(props, ...args){
        super(props, ...args);

        // Bind Cell methods
        this.makeClasses = this.makeClasses.bind(this);
        this.makeChildStyle = this.makeChildStyle.bind(this);
        this.makeChildElements = this.makeChildElements.bind(this);
    }

    _computeFillSpacePreferences() {
        return {horizontal: true, vertical: true}
    }

    build(){
        return (
            h('div', {
                id: this.getElementId(),
                class: this.makeClasses(),
                'data-cell-id': this.identity,
                'data-cell-type': "SplitView"
            }, this.makeChildElements())
        );
    }

    makeClasses(){
        // Note: the server side uses the "split" (axis) to
        // denote the direction
        let classes = ["cell", "split-view"];
        let directionClass = "split-view-row";
        if(this.props.split == "horizontal"){
            directionClass = "split-view-column";
        }
        classes.push(directionClass);
        return classes.join(" ");
    }

    makeChildStyle(index){
        let proportion = this.props.proportions[index];
        return `flex: ${proportion}`;
    }

    makeChildElements(){
        return this.renderChildrenNamed('elements').map((child, idx) => {
            return h('div', {
                style: this.makeChildStyle(idx),
                class: "split-view-area allow-child-to-fill-space"
            }, [child]);
        });
    }
}

export {SplitView, SplitView as default};
