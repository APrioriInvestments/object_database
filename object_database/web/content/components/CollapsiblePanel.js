/**
 * CollapsiblePanel Cell Component
 */
import {Component} from './Component.js';
import {h} from 'maquette';
import {PropTypes} from './util/PropertyValidator.js';

/**
 * About Named Children
 * --------------------
 * `content` (single) - The current content Cell of the panel
 * `panel` (single) - The current (expanded) panel view
 */
class CollapsiblePanel extends Component {
    constructor(props, ...args){
        super(props, ...args);

        // Bind component methods
        this.makePanel = this.makePanel.bind(this);
        this.makeContent = this.makeContent.bind(this);
    }

    build(){
        if(this.props.extraData.isExpanded){
            return(
                h('div', {
                    class: "cell d-flex",
                    "data-cell-id": this.props.id,
                    "data-cell-type": "CollapsiblePanel",
                    "data-expanded": true,
                    id: this.props.id,
                }, [
                    h('div', {class: "row flex-nowrap no-gutters"}, [
                        h('div', {class: "col-md-auto", style: "flex-grow:1"},[
                            this.makePanel()
                        ]),
                        h('div', {class: "col-sm", style: "flex-grow:5"}, [
                            this.makeContent()
                        ])
                    ])
                ])
            );
        } else {
            return (
                h('div', {
                    class: "cell container-fluid",
                    "data-cell-id": this.props.id,
                    "data-cell-type": "CollapsiblePanel",
                    "data-expanded": false,
                    id: this.props.id,
                }, [this.makeContent()])
            );
        }
        return (
            h('div', {
                class: "cell collapsible-panel",
                id: this.props.id,
                "data-cell-id": this.props.id,
                "data-cell-type": "CollapsiblePanel",
                "data-is-expanded": (this.props.isExpanded == true)
            }, [panel, content])
        );
    }

    makeContent(){
        let result = this.renderChildNamed('content');
        return (
            h('div', {class: "collapsible-panel-content"}, [result])
        );
    }

    makePanel(){
        let result = this.renderChildNamed('panel');
        return (
            h('div', {class: "collapsible-panel-panel"}, [result])
        );
    }
}

CollapsiblePanel.propTypes = {
    isExpanded: {
        description: "Whether or not the Panel is expanded (showing)",
        type: PropTypes.boolean
    }
};


export {CollapsiblePanel, CollapsiblePanel as default}
