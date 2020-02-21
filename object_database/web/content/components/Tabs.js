/**
 * Tabs Cell Component
 */

import {Component} from './Component';
import {h} from 'maquette';

/**
 * About Named Children
 * --------------------
 * `display` (single) - The Cell that gets displayed when
 *      the tabs are showing
 * `headers` (array) - An array of cells that serve as
 *     the tab headers
 */
class Tabs extends Component {
    constructor(props, ...args){
        super(props, ...args);

        // Bind component methods
        this.makeHeaders = this.makeHeaders.bind(this);
        this.makeDisplay = this.makeDisplay.bind(this);
    }

    build(){
        return (
            h('div', {
                id: this.getElementId(),
                "data-cell-id": this.props.id,
                "data-cell-type": "Tabs",
                class: "container-fluid mb-3"
            }, [
                h('ul', {class: "nav nav-tabs", role: "tablist"}, this.makeHeaders()),
                h('div', {class: "tab-content"}, [
                    h('div', {class: "tab-pane fade show active", role: "tabpanel"}, [
                        this.makeDisplay()
                    ])
                ])
            ])
        );
    }

    makeDisplay(){
        return this.renderChildNamed('display');
    }

    makeHeaders(){
        return this.renderChildrenNamed('headers');
    }
}


export {Tabs, Tabs as default};
