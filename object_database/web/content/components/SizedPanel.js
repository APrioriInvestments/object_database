/**
 * SizedPanel Cell Component
 */
import {Component} from './Component';
import {PropTypes} from './util/PropertyValidator';
import {h} from 'maquette';

/**
 * About Named Children
 * --------------------
 * `content` (single) - The content Cell in the SizedPanel
 */
class SizedPanel extends Component {
    constructor(props, ...args){
        super(props, ...args);

        // Bind component methods
        this.getClasses = this.getClasses.bind(this);
        this.getStyle = this.getStyle.bind(this);
    }

    build(){
        return h('div', {
            id: this.getElementId(),
            "data-cell-id": this.props.id,
            "data-cell-type": "SizedPanel",
            class: this.getClasses(),
            style: this.getStyle()
        }, [this.renderChildNamed('content')]);
    }

    getClasses(){
        if (this.props.applyBorder) {
            return "cell cell-panel cell-panel-border";
        } else {
            return "cell cell-panel";
        }
    }

    getStyle(){
        let style = `width:${this.props.width}px;`;
        style += `height:${this.props.height}px;`;
        return style;
    }
}

SizedPanel.propTypes = {
    width: {
        type: PropTypes.number,
        description: "The desired width, in pixels"
    },
    height: {
        type: PropTypes.number,
        description: "The desired height, in pixels"
    }
}

export {
    SizedPanel,
    SizedPanel as default
};
