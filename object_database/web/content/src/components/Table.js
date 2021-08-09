/**
 * Table Cell Cell
 */

import {makeDomElt as h} from './Cell';
import {ConcreteCell} from './ConcreteCell';

/**
 * About Named Children
 * --------------------
 * `headers` (array) - An array of table header cells
 * `dataCells` (array-of-array) - A 2-dimensional array
 *    structures as rows by columns that contains the
 *    table data cells
 * `page` (single) - A cell that tells which page of the
 *     table we are looking at
 * `left` (single) - A cell that shows the number on the left
 * `right` (single) - A cell that show the number on the right
 */
class Table extends ConcreteCell {
    constructor(props, ...args){
        super(props, ...args);

        this.tableDiv = null;
    }

    _computeFillSpacePreferences() {
        return {horizontal: this.props.fillWidth, vertical: this.props.fillHeight};
    }

    build(){
        let tableStyle = [];

        if (this.props.fillWidth) {
            tableStyle.push('overflow-x:auto');
        }

        if (this.props.fillHeight) {
            tableStyle.push('overflow-y:auto');
        }

        this.tableDiv = h('table', {
            "class": "cell table-sm table-striped",
            "style": "height:auto"
        }, [
            this.renderChildNamed('header'),
            h('tbody', {}, this.renderChildrenNamed('rows'))
        ]);

        let res = h('div', {
            id: this.getElementId(),
            "data-cell-id": this.identity,
            "data-cell-type": "Table",
            "class": "allow-child-to-fill-space",
            "style": tableStyle.join(';')
        }, [
            this.tableDiv
        ]);

        this.applySpacePreferencesToClassList(res);
        this.applySpacePreferencesToClassList(this.tableDiv);

        return res;
    }

    onOwnSpacePrefsChanged() {
        this.applySpacePreferencesToClassList(this.domElement);
        this.applySpacePreferencesToClassList(this.tableDiv);
    }
}

class TableRow extends ConcreteCell {
    constructor(props, ...args){
        super(props, ...args);
    }

    build() {
        return h('tr', {}, this.renderChildrenNamed('cells').map((elt, colIndex) => {
            return (
                h('td', {}, [elt])
            );
        }));
    }
}

class TableHeader extends ConcreteCell {
    constructor(props, ...args){
        super(props, ...args);
    }

    build() {
        return h('thead',
            {style:
                "border-bottom: black;border-bottom-style:solid;border-bottom-width:thin;"
            },
            this.renderChildrenNamed('cells').map((elt, colIndex) => {
                return h(
                    'th',
                    {style: 'vertical-align:top;position:sticky; top:0; left:0;z-index:1;background-color:white'},
                    [elt]
                );
            })
        );
    }
};

export {Table, TableRow, TableHeader, Table as default};
