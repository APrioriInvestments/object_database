/**
 * ResizablePanel Cell Component
 * --------------------------------
 * This component represents a flex view
 * of two children whereby the proportions
 * of each child in the parent can be updated
 * with a vertical/horizontal resizer.
 * NOTE: We are using the Splitjs
 * (https://github.com/nathancahill/split/tree/master/packages/splitjs#api)
 * library to deal with the complexity
 * of global event listeners etc associated
 * with resizing and dragging items.
 */
import {Component} from './Component';
import {PropTypes} from './util/PropertyValidator';
import {h} from 'maquette';
import Split from 'split.js';

/**
 * About Named Children
 * --------------------
 * `first` (single) - The first cell to show in the view
 * `second` (single) - The second cell to show in the view
 */
class ResizablePanel extends Component {
    constructor(props, ...args){
        super(props, ...args);

        // Bind component methods
        this.makeFirstChild = this.makeFirstChild.bind(this);
        this.makeSecondChild = this.makeSecondChild.bind(this);
        this.afterCreate = this.afterCreate.bind(this);
        this.afterDestroyed = this.afterDestroyed.bind(this);
    }

    build(){
        let classString = "";
        if(this.props.split == 'vertical'){
            classString = " horizontal-panel";
        } else if(this.props.split == 'horizontal'){
            classString = " vertical-panel";
        }
        return (
            h('div', {
                id: this.getElementId(),
                class: `cell resizable-panel${classString}`,
                'data-cell-type': 'ResizablePanel',
                'data-cell-id': this.props.id,
                afterCreate: this.afterCreate,
                afterDestroyed: this.afterDestroyed
            }, [
                this.makeFirstChild(),
                this.makeSecondChild()
            ])
        );
    }

    makeFirstChild(){
        let inner = this.renderChildNamed('first');
        return (
            h('div', {
                class: 'resizable-panel-item',
                'data-resizable-panel-item-id': `panel-item-${this.props.id}`
            }, [inner])
        );
    }

    makeSecondChild(){
        let inner = this.renderChildNamed('second');
        // Our panel items must be uniquely identifiable in order to properly insert
        // the resize splitter. See the .afterCreate().
        return (
            h('div', {
                class: 'resizable-panel-item',
                'data-resizable-panel-item-id': `panel-item-${this.props.id}`
            }, [inner])
        );
    }

    afterCreate(element){
        // Sometimes maquette calls afterCreate
        // twice. This will end up creating two gutters
        // instead of one, so we need to check for the
        // splitter attached instance and return if it's
        // already there.
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
            element.querySelectorAll(`div[data-resizable-panel-item-id=panel-item-${this.props.id}]`),
            {
                direction: reverseDirection,
                sizes: sizes
            }
        );
    }

    afterDestroyed(element){
        if(element._splitter){
            element._splitter.destroy();
        }
    }
}

ResizablePanel.propTypes = {
    split: {
        type: PropTypes.oneOf(["horizontal", "vertical"]),
        description: "Axis along with the panel is split"
    },
    ratio: {
        type: PropTypes.number,
        description: "Flex ratio for first child item"
    }
};

export {ResizablePanel, ResizablePanel as default};
