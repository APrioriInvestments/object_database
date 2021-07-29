/**
 * Base class for all 'ConcreteCell' objects, which are Cells. with a
   fixed set of children. Children can expect that 'renderChildNamed'
   exists and just need to override 'build'.

   The expectation is that 'props' never change, so this dom element
   is stable.
 */

import {Cell, makeDomElt} from './Cell';

class ConcreteCell extends Cell {
    constructor(props, ...args){
        super(props, ...args);

        // Bind context to methods
        this.build = this.build.bind(this);
        this.renderChildNamed = this.renderChildNamed.bind(this);
        this.renderChildArray = this.renderChildArray.bind(this);

        this.domElement = null;

        // maps from 'child name', which is either the name of the child
        // or (name + "#" + i) where 'i' is the index of the child in a
        // named child list. This lets us update children when they recompute
        // without having to remember where we got the rendered child.
        this.childNameToChild = {};
        this.childNameToDomElt = {};
        this.cellIdToChildName = {};
    }

    childChanged(child) {
        if (this.domElement === null) {
            return;
        }

        let childName = this.cellIdToChildName[child.identity];

        if (childName === null) {
            return;
        }

        let newChildDomElement = this.renderChildUncached(this.childNameToChild[childName]);

        this.childNameToDomElt[childName].replaceWith(
            newChildDomElement
        );

        this.childNameToDomElt[childName] = newChildDomElement;
    }

    // subclasses should implement this so that it returns
    // a dom element and uses 'renderChildNamed'.
    build() {
        throw new Error('build not defined for ' + this);
    }

    buildDomElementInner() {
        if (this.domElement === null) {
            this.domElement = this.build();
        }

        return this.domElement;
    }

    renderChildrenNamed(name) {
        let child = this.namedChildren[name];

        if (!child) {
            return null;
        }

        return this.renderChildArray(child, "");
    }

    renderChildArray(childOrArray, suffix) {
        if (Array.isArray(childOrArray)) {
            // this is an array of children or other arrays
            let children = [];

            for (var i = 0; i < childOrArray.length; i += 1) {
                children.push(this.renderChildArray(childOrArray[i], suffix + "#" + i));
            }

            return children;
        } else {
            // this is a concrete child
            this.cellIdToChildName[childOrArray.identity] = name + suffix;
            this.childNameToDomElt[name + suffix] = this.renderChildUncached(childOrArray);
            this.childNameToChild[name + suffix] = childOrArray;

            return this.childNameToDomElt[name + suffix];
        }
    }

    renderChildNamed(name) {
        let child = this.namedChildren[name];

        if (!child) {
            return null;
        }

        this.childNameToChild[name] = child;
        this.cellIdToChildName[child.identity] = name;
        this.childNameToDomElt[name] = this.renderChildUncached(child);

        return this.childNameToDomElt[name];
    }

    // render a child, but if it doesn't return a div,
    // return a 'displayless' div we can use as a placeholder
    // so that if the cell then _does_ render in the future,
    // we know where in the tree to put the div.
    renderChildUncached(child) {
        let div = child.buildDomElement();

        if (div === null) {
            return makeDomElt('div', {
                'style': 'display:none;'
            }, []);
        }

        return div;
    }
}

export {ConcreteCell, ConcreteCell as default};
