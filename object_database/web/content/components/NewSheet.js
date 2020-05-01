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
        this.onArrowUp = this.onArrowUp.bind(this);
        this.onArrowDown = this.onArrowDown.bind(this);
        this.onArrowRight = this.onArrowRight.bind(this);
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
            new KeyBinding('PageUp', this.onPageUp),
            new KeyBinding('PageDown', this.onPageDown),
            new KeyBinding('ArrowUp', this.onArrowUp),
            new KeyBinding('ArrowDown', this.onArrowDown),
            new KeyBinding('ArrowRight', this.onArrowRight),
            new KeyBinding('ArrowLeft', this.onArrowLeft)
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
        console.log(event);
    }

    onPageDown(event){
        console.log(event);
    }

    onArrowUp(event){
        let selecting = event.shiftKey;
        event.target.selector.moveUpBy(1, selecting);
    }

    onArrowDown(event){
        let selecting = event.shiftKey;
        event.target.selector.moveDownBy(1, selecting);
    }

    onArrowLeft(event){
        let selecting = event.shiftKey;
        event.target.selector.moveLeftBy(1, selecting);
    }

    onArrowRight(event){
        let selecting = event.shiftKey;
        event.target.selector.moveRightBy(1, selecting);
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
