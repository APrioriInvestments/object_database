/**
 * HeaderBar Cell Component
 */

import {Component} from './Component';
import {h} from 'maquette';

/**
 * About Named Children
 * --------------------
 * `leftItems` (array) - The items that will be on the left
 * `centerItems` (array) - The items that will be in the center
 * `rightItems` (array) - The items that will be on the right
 */
class HeaderBar extends Component {
    constructor(props, ...args){
        super(props, ...args);

        // Bind context to methods
        this.makeElements = this.makeElements.bind(this);
        this.makeRight = this.makeRight.bind(this);
        this.makeLeft = this.makeLeft.bind(this);
        this.makeCenter = this.makeCenter.bind(this);
    }

    build(){
        return (
            h('div', {
                id: this.getElementId(),
                class: "cell header-bar bg-light",
                "data-cell-id": this.props.id,
                "data-cell-type": "HeaderBar"
            }, [
                this.makeLeft(),
                this.makeCenter(),
                this.makeRight()
            ])
        );
    }

    makeLeft(){
        let innerElements = [];
        if(this.props.namedChildren.leftItems){
            innerElements = this.makeElements('left');
        }
        return (
            h('div', {class: "flex-item", style: "flex-grow:0;"}, [
                h('div', {
                    class: "flex-container",
                    style: 'display:flex;justify-content:center;align-items:baseline;'
                }, innerElements)
            ])
        );
    }

    makeCenter(){
        let innerElements = [];
        if(this.props.namedChildren.centerItems){
            innerElements = this.makeElements('center');
        }
        return (
            h('div', {class: "flex-item", style: "flex-grow:1;"}, [
                h('div', {
                    class: "flex-container",
                    style: 'display:flex;justify-content:center;align-items:baseline;'
                }, innerElements)
            ])
        );
    }

    makeRight(){
        let innerElements = [];
        if(this.props.namedChildren.rightItems){
            innerElements = this.makeElements('right');
        }
        return (
            h('div', {class: "flex-item", style: "flex-grow:0;"}, [
                h('div', {
                    class: "flex-container",
                    style: 'display:flex;justify-content:center;align-items:baseline;'
                }, innerElements)
            ])
        );
    }

    makeElements(position){
        return this.renderChildrenNamed(`${position}Items`).map(element => {
            return (
                h('span', {class: "flex-item px-3"}, [element])
            );
        });
    }
}

export {HeaderBar, HeaderBar as default};
