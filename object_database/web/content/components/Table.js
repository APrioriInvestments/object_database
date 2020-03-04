/**
 * Table Cell Component
 */

import {Component} from './Component';
import {PropTypes} from './util/PropertyValidator';
import {h} from 'maquette';

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
class Table extends Component {
    constructor(props, ...args){
        super(props, ...args);

        // Bind context to methods
        this.makeRows = this.makeRows.bind(this);
        this.makeFirstRow = this.makeFirstRow.bind(this);
        this._makeRowElements = this._makeRowElements.bind(this);
        this._getPageDisplayElements = this._getPageDisplayElements.bind(this);
        this._currentPage = this._currentPage.bind(this);
        this._totalPages = this._totalPages.bind(this);
        this.fetchPage = this.fetchPage.bind(this);
        this.handleKeydown = this.handleKeydown.bind(this);
        this.page = this.page.bind(this);
        this.toggleSearchInput = this.toggleSearchInput.bind(this);
        this.sortColumn = this.sortColumn.bind(this);
        this.filterColumn = this.filterColumn.bind(this);
    }

    build(){
        console.dir(this.props.children);
        console.dir(this.props);
        return(
            h('table', {
                id: this.getElementId(),
                onkeydown: this.handleKeydown,
                "data-cell-id": this.props.id,
                "data-cell-type": "Table",
                class: "cell cell-table table-hscroll table-sm table-striped"
            }, [
                h('thead', {},[
                    this.makeFirstRow()
                ]),
                h('tbody', {}, this.makeRows())
            ])
        );
    }

    handleKeydown(event){
        if (event.target.id === `table-${this.props.id}-page`){
            if (event.key === "Enter"){
                let page = parseInt(event.target.value);
                if (!isNaN(page)){
                    this.fetchPage(page);
                }
            }
        }
    }

    page(event){
        let direction = event.target.dataset.direction;
        let clickable = event.target.dataset.clickable;
        if (clickable === "true"){
            let nextPage = parseInt(this.props.currentPage);
            if (direction === "left"){
                nextPage -= 1;
            } else if (direction === "right"){
                nextPage += 1;
            }
            this.fetchPage(nextPage);
        }

    }

    makeHeaderElements(){
        return this.props.columns.map((name) => {
            return h('th', {
                style: "vertical-align:top;",
                key: `${this.props.id}-table-header-${name}`
            }, [this._makeHeaderElement(name)]);
        });
    }

    _makeHeaderElement(name){
        return h("span", {}, [
            h("span", {
                class: "cell octicon octicon-arrow-down",
                id: `table-${this.props.id}-${name}-column-sort`,
                onclick: this.sortColumn,
                style: "color: gray",
                "data-column": name,
                "data-direction": "down",
                "data-type": "column-sort"
            }, []),
            h("span", {class: "column-name"}, [name]),
            h("input", {
                id: `table-${this.props.id}-${name}-search-input`,
                class: "search-input",
                style: "visibility: hidden",
                "data-type": "column-filter",
                "data-column": name,
                oninput: this.filterColumn
            }, []),
            h("span", {
                id: `table-${this.props.id}-${name}-search`,
                class: "cell octicon octicon-search",
                onclick: this.toggleSearchInput
            }, []),
        ]);
    }

    filterColumn(event){
        let element = event.target;
        // call the  server
        cellSocket.sendString(
            JSON.stringify(
                {
                    event: "table-filter-column",
                    target_cell: this.props.id,
                    column: element.dataset.column,
                    expression: element.value
                }
            ));
    }

    sortColumn(event){
        let element = event.target;
        let direction = element.dataset.direction;
        if (direction === "down"){
            element.classList.remove("octicon-arrow-down");
            element.classList.add("octicon-arrow-up");
            element.dataset.direction = "up";
        } else {
            element.classList.remove("octicon-arrow-up");
            element.classList.add("octicon-arrow-down");
            element.dataset.direction = "down";
        }
        // make sure all the other sort octicons are gray'd out
        this.getDOMElement().querySelectorAll("[data-type='column-sort']").forEach(el => {
            el.style.color="gray";
        });
        // color our element black
        element.style.color = "black";
        // call the  server
        cellSocket.sendString(
            JSON.stringify(
                {
                    event: "table-sort-column",
                    target_cell: this.props.id,
                    column: element.dataset.column,
                    direction: element.dataset.direction
                }
            ));
    }

    toggleSearchInput(event) {
        let id = event.target.id;
        let input = document.getElementById(id + "-input");
        if (input.style.visibility !== "hidden"){
            input.style.visibility = "hidden";
            event.target.style.fontWeight = "";
        } else {
            input.style.visibility = "";
            event.target.style.fontWeight = "bold";
        }
        // make sure all the other sort octicons are gray'd out
        this.getDOMElement().querySelectorAll("[data-type='column-filter']").forEach(el => {
            if (!el.isSameNode(input)){
                el.style.visibility = "hidden";
            }
        });
    }

    makeRows(){
        return this._makeRowElements(this.renderChildrenNamed('dataCells'));
    }

    _makeRowElements(elements){
        // Note: rows are the *first* dimension
        // in the 2-dimensional array returned
        // by getting the `child` replacement elements.
        return elements.map((row, rowIdx) => {
            let columns = row.map((childElement, colIdx) => {
                return (
                    h('td', {
                        key: `${this.props.id}-td-${rowIdx}-${colIdx}`
                    }, [childElement])
                );
            });
            let pageRows = (this.props.currentPage - 1) * this.props.rowsPerPage;
            let relativeIndex = rowIdx + 1 + pageRows;
            let indexElement = h('td', {}, [`${relativeIndex}`]);
            return (
                h('tr', {key: `${this.props.id}-tr-${rowIdx}`}, [indexElement, ...columns])
            );
        });
    }

    makeFirstRow(){
        let headerElements = this.makeHeaderElements();
        if (this.props.totalPages > 1){
            headerElements.unshift(h('th', {}, [...this._getPageDisplayElements()]));
        }
        return(
            h('tr', {}, headerElements)
        );
    }

    _getPageDisplayElements(){
        return [
            this._pageArrows('left'),
            this._currentPage(),
            this._totalPages(),
            this._pageArrows('right')
        ];
    }

    _pageArrows(direction){
        let style = "";
        let clickable = (
        (direction === 'left' && parseInt(this.props.currentPage) > 1)
            ||
            (direction === 'right' && parseInt(this.props.currentPage) < this.props.totalPages)
        );
        if (!clickable){
            style = "color: lightgray";
        }
        let classes = `cell octicon octicon-triangle-${direction}`;
        return h('span', {
            class: classes,
            style: style,
            'data-direction': direction,
            'data-clickable': clickable.toString(),
            onclick: this.page
        }, []);
    }

    _currentPage(){
        return h('input', {
            id: `table-${this.props.id}-page`,
            value: this.props.currentPage,
            size: this.props.currentPage.length,
            oninput: this.handleKeydown
        }, [])
    }

    _totalPages(){
        return h('span', {class: "cell-table-pages"}, [`of ${this.props.totalPages}`]);
    }

    fetchPage(page){
        cellSocket.sendString(
            JSON.stringify(
                {
                    event: "table-set-page",
                    target_cell: this.props.id,
                    page: page
                }
            ));
    }
}

Table.propTypes = {
    totalPages: {
        type: PropTypes.number,
        description: "Total number of pages the Table can display"
    },
    currentPage: {
        type: PropTypes.number,
        description: "The current page number being displayed"
    },
    columns: {
        type: PropTypes.array,
        description: "Array of column names"
    },
    numRows: {
        type: PropTypes.number,
        description: "The total number of rows the table has"
    },
    rowsPerPage: {
        type: PropTypes.number,
        description: "The maximum number of rows to display on teach page"
    }
}

export {Table, Table as default};
