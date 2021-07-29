/**
 * AsyncDropdown Cell Cell
 */

import {makeDomElt as h} from './Cell';
import {ConcreteCell} from './ConcreteCell';

/**
 * About Named Children
 * --------------------
 * `content` (single) - Usually an AsyncDropdownContent cell
 * `loadingIndicator` (single) - A Cell that displays that the content is loading
 */
class AsyncDropdown extends ConcreteCell {
    constructor(props, ...args){
        super(props, ...args);

        // Bind context to methods
        this.makeContent = this.makeContent.bind(this);
        this.buttonDiv = null;
    }

    build(){
        this.buttonDiv = h('button', {
            class: "btn btn-xs btn-outline-secondary dropdown-toggle dropdown-toggle-split",
            type: "button",
            id: `${this.identity}-dropdownMenuButton`,
            "data-toggle": "dropdown",
            "data-firstclick": "true"
        });

        return (
            h('div', {
                id: this.getElementId(),
                "data-cell-id": this.identity,
                "data-cell-type": "AsyncDropdown",
                class: "cell btn-group"
            }, [
                h('a', {class: "btn btn-xs btn-outline-secondary"}, [this.props.labelText]),
                this.buttonDiv,
                h('div', {
                    id: `${this.identity}-dropdownContentWrapper`,
                    class: "dropdown-menu"
                }, [this.makeContent()])
            ])
        );
    }

    onFirstInstalled(){
        let parentEl = this.buttonDiv.parentElement;
        let Cell = this;
        let firstTimeClicked = (this.buttonDiv.dataset.firstclick == "true");

        if (firstTimeClicked) {
            $(parentEl).on('show.bs.dropdown', () => {
                this.sendMessage({event: 'dropdown', isOpen: false});
            });

            $(parentEl).on('hide.bs.dropdown', () => {
                this.sendMessage({event: 'dropdown', isOpen: true});
            });

            this.buttonDiv.dataset.firstclick = false;
        }
    }

    makeContent(){
        return this.renderChildNamed('content');
    }
}

/**
 * About Named Children
 * ---------------------
 * `content` (single) - A Cell that comprises the dropdown content
 * `loadingIndicator` (single) - A Cell that represents a visual
 *       indicating that the content is loading
 */
class AsyncDropdownContent extends ConcreteCell {
    constructor(props, ...args){
        super(props, ...args);

        // Bind Cell methods
        this.makeContent = this.makeContent.bind(this);
    }

    build(){
        return (
            h('div', {
                id: `${this.identity}`,
                "data-cell-id": this.identity,
                "data-cell-type": "AsyncDropdownContent"
            }, [this.makeContent()])
        );
    }

    makeContent(){
        return this.renderChildNamed('content');
    }
}


export {
    AsyncDropdown,
    AsyncDropdownContent,
    AsyncDropdown as default
};
