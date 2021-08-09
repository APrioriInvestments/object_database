/**
 * Tabs Cell Cell
 */

import {makeDomElt as h} from './Cell';
import {ConcreteCell} from './ConcreteCell';

/**
 * About Named Children
 * --------------------
 * `display` (single) - The Cell that gets displayed when
 *      the tabs are showing
 * `headers` (array) - An array of cells that serve as
 *     the tab headers
 */
class Tabs extends ConcreteCell {
    constructor(props, ...args){
        super(props, ...args);

        // Bind Cell methods
        this.makeHeaders = this.makeHeaders.bind(this);
        this.makeDisplay = this.makeDisplay.bind(this);
    }

    _computeFillSpacePreferences() {
        return {horizontal: true, vertical: true}
    }

    build(){
        return (
            h('div', {
                id: this.getElementId(),
                "data-cell-id": this.identity,
                "data-cell-type": "Tabs",
                class: "sequence sequence-vertical"
            }, [
                h('ul', {class: "nav nav-tabs", role: "tablist"}, this.makeHeaders()),
                h('div', {class: "tab-content fill-space-vertical", style: 'position:relative; top:0;left:0'}, [
                    h('div', {class: "tab-pane fade show active allow-child-to-fill-space",
                            role: "tabpanel",
                            style: 'height:100%;width:100%;position:absolute;top:0;left:0'}, [
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
