/**
 * CollapsiblePanel Cell Cell
 */
import {makeDomElt as h} from './Cell';
import {ConcreteCell} from './ConcreteCell';

/**
 * About Named Children
 * --------------------
 * `content` (single) - The current content Cell of the panel
 * `panel` (single) - The current (expanded) panel view
 */
class CollapsiblePanel extends ConcreteCell {
    constructor(props, ...args){
        super(props, ...args);

        // Bind Cell methods
        this.makePanel = this.makePanel.bind(this);
        this.makeContent = this.makeContent.bind(this);
    }

    build(){
        let content = this.makeContent();
        let panel = null;
        if(this.props.isExpanded){
            panel = this.makePanel();
        }
        return (
            h('div', {
                class: "cell flex-child collapsible-panel",
                id: this.getElementId(),
                "data-cell-id": this.identity,
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

export {CollapsiblePanel, CollapsiblePanel as default}
