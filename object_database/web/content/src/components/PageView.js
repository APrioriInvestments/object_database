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

    build(){
        return h('div', {
            id: this.getElementId(),
            'data-cell-id': this.identity,
            'data-cell-type': "PageView",
            class: 'cell page-view'
        }, [
            this.makeHeader(),
            this.makeMain(),
            this.makeFooter()
        ]);
    }

    makeHeader(){
        let headerContent = this.renderChildNamed('header');
        if(headerContent){
            return h('header', {
                class: 'page-view-header'
            }, [headerContent]);
        } else {
            return null;
        }
    }

    makeMain(){
        return this.renderChildNamed('main');
    }

    makeFooter(){
        let footerContent = this.renderChildNamed('footer');
        if(footerContent){
            return h('footer', {
                class: 'page-view-footer'
            }, [footerContent]);
        } else {
            return null;
        }
    }
}

export {PageView, PageView as default};
