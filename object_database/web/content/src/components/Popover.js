/**
 * Popover Cell Cell
 */

import {makeDomElt as h} from './Cell';
import {ConcreteCell} from './ConcreteCell';

/**
 * About Named Children
 * --------------------
 * `content` (single) - The content of the popover
 * `detail` (single) - Detail of the popover
 * `title` (single) - The title for the popover
 */
class Popover extends ConcreteCell {
    constructor(props, ...args){
        super(props, ...args);

        // Bind Cell methods
        this.makeTitle = this.makeTitle.bind(this);
        this.makeContent = this.makeContent.bind(this);
        this.makeDetail = this.makeDetail.bind(this);
        this.popoverSetup = this.popoverSetup.bind(this);
        this.onClickWhenOpen = this.onClickWhenOpen.bind(this);
        this.onClickInPopover = this.onClickInPopover.bind(this);

        this.popoverElement = null;
    }

    cellWillUnload(){
        // If there is an open rendered
        // popover on the screen, remove
        // it.
        let query = `[data-cell-target="${this.identity}"].popover`;
        let found = document.querySelector(query);

        if(found){
            $(found).popover('hide');
        }
    }

    build(){
        this.popoverElement = h('a',
            {
                href: "#popmain_" + this.identity,
                "data-toggle": "popover",
                "data-trigger": "manual",
                "data-bind": "#pop_" + this.identity,
                "data-placement": "bottom",
                role: "button",
                class: "btn btn-xs",
            },
            [this.makeContent()]
        );

        return h('div',
            {
                class: "cell popover-cell",
                id: this.getElementId(),
                "data-cell-id": this.identity,
                "data-cell-type": "Popover"
            }, [
                this.popoverElement,
                h('div', {
                    style: "display:none"
                }, [
                    h("div", {id: "pop_" + this.identity}, [
                        h("div", {class: "data-title"}, [this.makeTitle()]),
                        h("div", {class: "data-content"}, [
                            h("div", {style: "width: " + this.props.width + "px"}, [
                                this.makeDetail()]
                            )
                        ])
                    ])
                ])
            ]
        );
    }

    onFirstInstalled() {
        this.popoverSetup(this.popoverElement);
    }

    makeContent(){
        return this.renderChildNamed('content');
    }

    makeDetail(){
        return this.renderChildNamed('detail');
    }

    makeTitle(){
        return this.renderChildNamed('title');
    }

    onClickWhenOpen(event){
        $('[data-toggle="popover"]').popover('hide');
    }

    onClickInPopover(event){
        event.stopPropagation();
    }

    get template(){
        return `<div class="popover" role="tooltip" data-cell-target="${this.identity}"><div class="arrow"></div><h3 class="popover-header"></h3><div class="popover-body"></div></div>`;
    }

    popoverSetup(element){
        // Note: we use jQuery here as
        // it is a requirement of the
        // Bootstrap popover module
        let thisTemplate = this.template;
        $(element).popover({
            html: true,
            container: 'body',
            title: function () {
                return getChildProp(this, 'title');
            },
            content: function () {
                return getChildProp(this, 'content');
            },
            placement: function (popperEl, triggeringEl) {
                let placement = triggeringEl.dataset.placement;
                if(placement == undefined){
                    return "bottom";
                }
                return placement;
            },
            template: thisTemplate
        });
        $(element).on('click', () => {
            $(element).popover('toggle');
            $(element).on('shown.bs.popover', () => {
                document.addEventListener('click', this.onClickWhenOpen);
                let el = document.querySelector('.popover');
                el.addEventListener('click', this.onClickInPopover);
            });
            $(element).on('hide.bs.popover', () => {
                document.removeEventListener('click', this.onClickWhenOpen);
                document.querySelector('.popover').removeEventListener('click', this.onClickInPopover);
            });
        });
    }
}

export {Popover, Popover as default};
