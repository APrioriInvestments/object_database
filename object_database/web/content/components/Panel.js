/**
 * Panel Cell Component
 */
import {Component} from './Component';
import {h} from 'maquette';

/**
 * About Named Children
 * --------------------
 * `content` (single) - The content Cell in the Panel
 */
class Panel extends Component {
    constructor(props, ...args){
        super(props, ...args);

        // Bind component methods
        this.getClasses = this.getClasses.bind(this);
    }

    build(){
        return h('div', {
            id: this.props.id,
            "data-cell-id": this.props.id,
            "data-cell-type": "Panel",
            style: this.props.divStyle,
            class: this.getClasses()
        }, [this.renderChildNamed('content')]);
    }

    getClasses(){
        if (this.props.applyBorder) {
            return "cell cell-panel cell-panel-border";
        } else {
            return "cell cell-panel";
        }
    }
}

export {
    Panel,
    Panel as default
};
