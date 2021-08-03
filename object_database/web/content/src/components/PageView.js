/**
 * PageView Cell Cell
 * Used for dividing up main views,
 * with optional header and footer.
 */

import {makeDomElt as h} from './Cell';
import {ConcreteCell} from './ConcreteCell';


/**
 * About Named Children
 * `header` - An optional header cell
 * `main` - A required main content cell
 * `footer` - An optional footer cell
 */
class PageView extends ConcreteCell {
    constructor(props, ...args){
        super(props, ...args);

        // Bind Cell methods
        this.makeHeader = this.makeHeader.bind(this);
        this.makeMain = this.makeMain.bind(this);
        this.makeFooter = this.makeFooter.bind(this);
    }

    _computeFillSpacePreferences() {
        return {horizontal: true, vertical: true};
    }

    build(){
        return h('div', {
            id: this.getElementId(),
            'data-cell-id': this.identity,
            'data-cell-type': "PageView",
            class: 'cell page-view sequence sequence-vertical fill-space-vertical fill-space-horizontal'
        }, [
            this.makeHeader(),
            this.makeMain(),
            this.makeFooter()
        ]);
    }

    makeHeader(){
        let headerContent = this.renderChildNamed('header');

        if(headerContent){
            return h('div', {
                class: 'page-view-header fill-space-horizontal allow-child-to-fill-space'
            }, [headerContent]);
        } else {
            return null;
        }
    }

    makeMain(){
        let bodyContent = this.renderChildNamed('main');

        return h('div', {
            class: 'page-view-body fill-space-vertical fill-space-horizontal allow-child-to-fill-space'
        }, [bodyContent])
    }

    makeFooter(){
        let footerContent = this.renderChildNamed('footer');
        if(footerContent){
            return h('div', {
                class: 'page-view-footer fill-space-horizontal allow-child-to-fill-space'
            }, [footerContent]);
        } else {
            return null;
        }
    }
}

export {PageView, PageView as default};
