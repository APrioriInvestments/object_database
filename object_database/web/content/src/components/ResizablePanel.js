/**
 * ResizablePanel Cell Cell
 * --------------------------------
 * This Cell represents a flex view
 * of two children whereby the proportions
 * of each child in the parent can be updated
 * with a vertical/horizontal resizer.
 * NOTE: We are using the Splitjs
 * (https://github.com/nathancahill/split/tree/master/packages/splitjs#api)
 * library to deal with the complexity
 * of global event listeners etc associated
 * with resizing and dragging items.
 */

import {makeDomElt as h} from './Cell';
import {ConcreteCell} from './ConcreteCell';
import Split from 'split.js';

/**
 * About Named Children
 * --------------------
 * `first` (single) - The first cell to show in the view
 * `second` (single) - The second cell to show in the view
 */
class ResizablePanel extends ConcreteCell {
    constructor(props, ...args){
        super(props, ...args);

        // Bind Cell methods
        this.makeFirstChild = this.makeFirstChild.bind(this);
        this.makeSecondChild = this.makeSecondChild.bind(this);
        this.addSplitTo = this.addSplitTo.bind(this);
    }

    build(){
        let classString = "";
        if(this.props.split == 'vertical'){
            classString = " horizontal-panel";
        } else if(this.props.split == 'horizontal'){
            classString = " vertical-panel";
        }
        let domElt = (
            h('div', {
                id: this.getElementId(),
                class: `cell resizable-panel${classString}`,
                'data-cell-type': 'ResizablePanel',
                'data-cell-id': this.identity,
            }, [
                this.makeFirstChild(),
                this.makeSecondChild()
            ])
        );

        this.addSplitTo(domElt);

        return domElt;
    }

    makeFirstChild(){
        let inner = this.renderChildNamed('first');
        return (
            h('div', {
                class: 'resizable-panel-item overflow',
                'data-resizable-panel-item-id': `panel-item-${this.identity}`
            }, [inner])
        );
    }

    makeSecondChild(){
        let inner = this.renderChildNamed('second');
        // Our panel items must be uniquely identifiable in order to properly insert
        // the resize splitter. See the .afterCreate().
        return (
            h('div', {
                class: 'resizable-panel-item overflow',
                'data-resizable-panel-item-id': `panel-item-${this.identity}`
            }, [inner])
        );
    }

    addSplitTo(element){
        if(element._splitter){
            return;
        }

        // Our Cell described directions are opposite those
        // required by the Splitjs library, so we need
        // to case them out and provide the opposite as
        // a Splitjs constructor option
        let sizes = [
            (this.props.ratio * 100),
            ((1 - this.props.ratio) * 100)
        ];
        let reverseDirection = 'horizontal';
        if(this.props.split == 'horizontal'){
            reverseDirection = 'vertical';
        }
        element._splitter = new Split(
            element.querySelectorAll(`div[data-resizable-panel-item-id=panel-item-${this.identity}]`),
            {
                direction: reverseDirection,
                sizes: sizes
            }
        );
    }

    cellWillUnload(){
        if (this.domElement._splitter){
            this.domElement._splitter.destroy();
        }
    }
}

export {ResizablePanel, ResizablePanel as default};
