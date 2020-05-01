/**
 * Sheet Cell Component
 * ----------------------------------
 * NOTE: This iteration of the Component
 * makes use of our custom element
 * ap-sheet webcomponent under the hood.
 * See the `webcomponents` directory for
 * more information
 */
import {h} from 'maquette';
import {Component} from './Component';
import {PropTypes} from './util/PropertyValidator';
import {
    KeyListener,
    KeyBinding
} from './util/KeyListener';

/**
 * About Named Children
 * --------------------
 * `error` (single) - An error cell (if present)
 */

class NewSheet extends Component {
    constructor(props, ...args){
        super(props, ...args);

        // We cache a reference
        // do the DOM node we will
        // ultimately create.
        this._cachedNode = null;

        // We store the created KeyBindings
        // here for now for debugging
        // purposes
        this.keyBindings = [];

        // Bind component methods
        this.afterCreate = this.afterCreate.bind(this);
        this.setupEvents = this.setupEvents.bind(this);
        this.tearDownEvents = this.tearDownEvents.bind(this);

        // Bind component event handlers
        this.onPageUp = this.onPageUp.bind(this);
        this.onPageDown = this.onPageDown.bind(this);
        this.onPageRight = this.onPageRight.bind(this);
        this.onPageLeft = this.onPageLeft.bind(this);
        this.onSelectPageUp = this.onSelectPageUp.bind(this);
        this.onSelectPageDown = this.onSelectPageDown.bind(this);
        this.onSelectPageRight = this.onSelectPageRight.bind(this);
        this.onSelectPageLeft = this.onSelectPageLeft.bind(this);
        this.onArrowUp = this.onArrowUp.bind(this);
        this.onSelectArrowUp = this.onSelectArrowUp.bind(this);
        this.onUpToTop = this.onUpToTop.bind(this);
        this.onArrowDown = this.onArrowDown.bind(this);
        this.onSelectArrowDown = this.onSelectArrowDown.bind(this);
        this.onDownToBottom = this.onDownToBottom.bind(this);
        this.onArrowRight = this.onArrowRight.bind(this);
        this.onSelectArrowRight = this.onSelectArrowRight.bind(this);
        this.onOverToRight = this.onOverToRight.bind(this);
        this.onArrowLeft = this.onArrowLeft.bind(this);
    }

    componentDidLoad(){
        this.setupEvents();
    }

    componentWillUnload(){
        this.tearDownEvents();
    }

    setupEvents(){
        let myElement = this.getDOMElement();
        this.keyBindings = [
            new KeyBinding(
                'PageUp',
                this.onPageUp,
                true,
                true,
                true
            ),
            new KeyBinding(
                'PageDown',
                this.onPageDown,
                true,
                true,
                true
            ),
            new KeyBinding(
                'altKey+PageUp',
                this.onPageLeft,
                true,
                true,
                true
            ),
            new KeyBinding(
                'altKey+PageDown',
                this.onPageRight,
                true,
                true,
                true
            ),
            new KeyBinding(
                'shiftKey+PageUp',
                this.onSelectPageUp,
                true,
                true,
                true
            ),
            new KeyBinding(
                'shiftKey+PageDown',
                this.onSelectPageDown,
                true,
                true,
                true
            ),
            new KeyBinding(
                'shiftKey+altKey+PageUp',
                this.onSelectPageLeft,
                true,
                true,
                true
            ),
            new KeyBinding(
                'shiftKey+altKey+PageDown',
                this.onSelectPageRight,
                true,
                true,
                true
            ),
            new KeyBinding(
                'ArrowUp',
                this.onArrowUp,
                true,
                true,
                true
            ),
            new KeyBinding(
                'shiftKey+ArrowUp',
                this.onSelectArrowUp,
                true,
                true,
                true
            ),
            new KeyBinding(
                'ctrlKey+ArrowUp',
                this.onUpToTop,
                true,
                true,
                true
            ),
            new KeyBinding(
                'ctrlKey+shiftKey+ArrowUp',
                this.onSelectUpToTop,
                true,
                true,
                true
            ),
            new KeyBinding(
                'ArrowDown',
                this.onArrowDown,
                true,
                true,
                true
            ),
            new KeyBinding(
                'shiftKey+ArrowDown',
                this.onSelectArrowDown,
                true,
                true,
                true
            ),
            new KeyBinding(
                'ctrlKey+ArrowDown',
                this.onDownToBottom,
                true,
                true,
                true
            ),
            new KeyBinding(
                'ctrlKey+shiftKey+ArrowDown',
                this.selectDownToBottom,
                true,
                true,
                true
            ),
            new KeyBinding(
                'ArrowRight',
                this.onArrowRight,
                true,
                true,
                true
            ),
            new KeyBinding(
                'shiftKey+ArrowRight',
                this.onSelectArrowRight,
                true,
                true,
                true
            ),
            new KeyBinding(
                'ctrlKey+ArrowRight',
                this.onOverToRight,
                true,
                true,
                true
            ),
            new KeyBinding(
                'ctrlKey+shiftKey+ArrowRight',
                this.onSelectOverToRight,
                true,
                true,
                true
            ),
            new KeyBinding(
                'ArrowLeft',
                this.onArrowLeft,
                true,
                true,
                true
            ),
            new KeyBinding(
                'shiftKey+ArrowLeft',
                this.onSelectArrowLeft,
                true,
                true,
                true
            ),
            new KeyBinding(
                'ctrlKey+ArrowLeft',
                this.onOverToLeft,
                true,
                true,
                true
            ),
            new KeyBinding(
                'ctrlKey+shiftKey+ArrowLeft',
                this.onSelectOverToLeft,
                true,
                true,
                true
            )
        ];
        this.keyListener = new KeyListener(myElement, this.keyBindings);
        this.keyListener.start();
    }

    tearDownEvents(){
        // Not yet sure what to do here
    }

    render(){
        return h('ap-sheet', {
            id: this.getElementId(),
            class: 'cell sheet-cell',
            'data-cell-id': this.props.id,
            'data-cell-type': 'NewSheet',
            afterCreate: this.afterCreate,
            'locked-rows': this.props.numLockRows,
            'locked-columns': this.props.numLockColumns,
            'total-rows': this.props.totalRows,
            'total-columns': this.props.totalColumns
        }, []);
    }

    afterCreate(element){
        this._cachedNode = element;
        element.setAttribute('rows', 10);
        element.setAttribute('columns', 20);
        element.setAttribute('total-columns', this.props.totalColumns);
        element.setAttribute('total-rows', this.props.totalRows);
        element.setAttribute('locked-rows', this.props.numLockRows);
        element.setAttribute('locked-columns', this.props.numLockColumns);
    }

    /* Event Handlers */

    onPageUp(event){
        console.log('PageUp');
        event.target.selector.pageUp();
    }

    onSelectPageUp(event){
        console.log('PageUp selecting');
        event.target.selector.pageUp(true);
    }

    onPageRight(event){
        console.log('PageRight');
        event.target.selector.pageRight();
    }

    onSelectPageRight(event){
        console.log('PageRight selecting');
        event.target.selector.pageRight(true);
    }

    onPageLeft(event){
        console.log('PageLeft');
        event.target.selector.pageLeft();
    }

    onSelectPageLeft(event){
        console.log('PageLeft selecting');
        event.target.selector.pageLeft(true);
    }

    onPageDown(event){
        console.log('PageDown');
        event.target.selector.pageDown();
    }

    onSelectPageDown(event){
        console.log('PageDown selecting');
        event.target.selector.pageDown(true);
    }

    onArrowUp(event){
        console.log('ArrowUp');
        event.target.selector.moveUpBy(1);
    }

    onSelectArrowUp(event){
        console.log('ArrowUp selecting');
        event.target.selector.moveUpBy(1, true);
    }

    onArrowDown(event){
        console.log('ArrowDown');
        event.target.selector.moveDownBy(1);
    }

    onSelectArrowDown(event){
        console.log('ArrowDown selecting');
        event.target.selector.moveDownBy(1, true);
    }

    onArrowLeft(event){
        console.log('ArrowLeft');
        event.target.selector.moveLeftBy(1);
    }

    onSelectArrowLeft(event){
        console.log('ArrowLeft selecting');
        event.target.selector.moveLeftBy(1, true);
    }

    onArrowRight(event){
        console.log('ArrowRight');
        event.target.selector.moveRightBy(1);
    }

    onSelectArrowRight(event){
        console.log('ArrowRight selecting');
        event.target.selector.moveRightBy(1, true);
    }

    onUpToTop(event){
        console.log('moveToTopEnd');
        event.target.selector.moveToTopEnd();
    }

    onSelectUpToTop(event){
        event.target.selector.moveToTopEnd(true);
    }

    onDownToBottom(event){
        console.log('moveToBottomEnd');
        event.target.selector.moveToBottomEnd();
    }

    onSelecteDownToBottom(event){
        event.target.selector.moveToBottomEnd(true);
    }

    onOverToRight(event){
        console.log('moveToRightEnd');
        event.target.selector.moveToRightEnd();
    }

    onSelectOverToRight(event){
        event.target.selector.moveToRightEnd(true);
    }

    onOverToLeft(event){
        console.log('moveToLeftEnd');
        event.target.selector.moveToLeftEnd();
    }

    onSelectOverToLeft(event){
        event.target.selector.moveToLeftEnd(true);
    }
};

NewSheet.propTypes = {
    rowHeight: {
        description: "Height of the row in pixels.",
        type: PropTypes.oneOf([PropTypes.number])
    },
    colWidth: {
        description: "Width of the column (and cell) in pixels.",
        type: PropTypes.oneOf([PropTypes.number])
    },
    numLockRows: {
        description: "The number of initial (first) rows to lock in place.",
        type: PropTypes.oneOf([PropTypes.number])
    },
    numLockColumns: {
        description: "The number of initial (first) columns to lock in place.",
        type: PropTypes.oneOf([PropTypes.number])
    },
    totalRows: {
        description: "Total number of rows.",
        type: PropTypes.oneOf([PropTypes.number])
    },
    totalColumns: {
        description: "Total number of columns.",
        type: PropTypes.oneOf([PropTypes.number])
    },
    dontFetch: {
        description: "Don't fetch data after load; mostly used for testing.",
        type: PropTypes.oneOf([PropTypes.bool])
    }
};

export {
    NewSheet,
    NewSheet as default
};
