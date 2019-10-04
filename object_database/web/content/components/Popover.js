/**
 * Popover Cell Component
 */

import {Component} from './Component';
import {h} from 'maquette';

/**
 * About Named Children
 * --------------------
 * `content` (single) - The content of the popover
 * `detail` (single) - Detail of the popover
 * `title` (single) - The title for the popover
 */
class Popover extends Component {
    constructor(props, ...args){
        super(props, ...args);

        // Bind component methods
        this.makeTitle = this.makeTitle.bind(this);
        this.makeContent = this.makeContent.bind(this);
        this.makeDetail = this.makeDetail.bind(this);
    }

    build(){
        return h('div',
            {
                class: "cell popover-cell",
                id: this.props.id,
                "data-cell-id": this.props.id,
                "data-cell-type": "Popover"
            }, [
                h('a',
                    {
                        href: "#popmain_" + this.props.id,
                        "data-toggle": "popover",
                        "data-trigger": "focus",
                        "data-bind": "#pop_" + this.props.id,
                        "data-placement": "bottom",
                        role: "button",
                        class: "btn btn-xs"
                    },
                  [this.makeContent()]
                ),
                h('div', {style: "display:none"}, [
                    h("div", {id: "pop_" + this.props.id}, [
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

    makeContent(){
        return this.renderChildNamed('content');
    }

    makeDetail(){
        return this.renderChildNamed('detail');
    }

    makeTitle(){
        return this.renderChildNamed('title');
    }
}

export {Popover, Popover as default};
