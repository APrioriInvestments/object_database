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
        console.log(this.props);

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
        return this.props.columns.map((name, colIdx) => {
            return h('th', {
                style: "vertical-align:top;",
                key: `${this.props.id}-table-header-${colIdx}`
            }, [this._makeHeaderElement(name, colIdx.toString())]);
        });
    }

    _makeHeaderElement(name, colIdx){
        return h("span", {}, [
            h("span", {
                id: `table-${this.props.id}-${colIdx}-column-name`,
                "data-column": colIdx,
                class: "column-name"
            }, [name]),
            h("span", {
                class: "cell octicon octicon-arrow-down",
                id: `table-${this.props.id}-${colIdx}-column-sort`,
                onclick: this.sortColumn,
                style: "color: gray",
                "data-column": colIdx,
                "data-direction": "down",
                "data-type": "column-sort"
            }, []),
            h("span", {
                id: `table-${this.props.id}-${colIdx}-search`,
                class: "cell octicon octicon-search",
                "data-column": colIdx,
                onclick: this.toggleSearchInput
            }, []),
            h("input", {
                id: `table-${this.props.id}-${colIdx}-search-input`,
                class: "search-input",
                style: "display: none",
                type: "text",
                "data-type": "column-filter",
                "data-column": colIdx,
                oninput: this.filterColumn
            }, []),
        ]);
    }

    filterColumn(event){
        let element = event.target;
        // call the  server
        cellSocket.sendString(
            JSON.stringify(
                {
                    event: "table-column-filter",
                    target_cell: this.props.id,
                    column: element.dataset.column,
                    expression: element.value
                }
            ));
    }

    sortColumn(event){
        let element = event.target;
        let direction = element.dataset.direction;
        let column = element.dataset.column;
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
        // indicate which column we are talking about
        this.getDOMElement().querySelectorAll(`[data-columm='${column}']`).forEach(el => {
            el.classList.add("active");
        });
        // color our element black
        element.style.color = "black";
        // make sure we know what column is being sorted
        let body = this.getDOMElement().querySelector("tbody");
        body.querySelectorAll(`[data-column='${column}']`).forEach(el => {
            el.classList.add("active-column");
        });
        // call the  server
        cellSocket.sendString(
            JSON.stringify(
                {
                    event: "table-column-sort",
                    target_cell: this.props.id,
                    column: element.dataset.column,
                    direction: element.dataset.direction
                }
            ));
    }

    toggleSearchInput(event) {
        let body = this.getDOMElement().querySelector("tbody");
        let id = event.target.id;
        let input = document.getElementById(id + "-input");
        let columnName = document.getElementById(
            `table-${this.props.id}-${input.dataset.column}-column-name`
        )
        let colIdx = columnName.dataset.column;
        if (input.style.display !== "none"){
            input.style.display = "none";
            event.target.style.fontWeight = "";
            columnName.classList.remove("column-name-small");
            body.querySelectorAll(`[data-column='${colIdx}']`).forEach(el => {
                el.classList.remove("active-column");
            });
        } else {
            input.style.display = "inherit";
            event.target.style.fontWeight = "bold";
            columnName.classList.add("column-name-small");
            body.querySelectorAll(`[data-column='${colIdx}']`).forEach(el => {
                el.classList.add("active-column");
            });
        }
        // make sure all the other sort octicons are gray'd out
        this.getDOMElement().querySelectorAll("[data-type='column-filter']").forEach(el => {
            if (!el.isSameNode(input)){
                el.style.display = "none";
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
                        key: `${this.props.id}-td-${rowIdx}-${colIdx}`,
                        "data-column": `${colIdx}`
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
        } else {
            headerElements.unshift(h('th', {}, []));
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
