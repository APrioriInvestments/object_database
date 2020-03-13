/**
 * TablePaginator Cell Component
 */
import {Component} from './Component';
import {PropTypes} from './util/PropertyValidator';
import {h} from 'maquette';

/**
 * About Named Children
 * --------------------
 */
class TablePaginator extends Component {
    constructor(props, ...args){
        super(props, ...args);

        // Bind component methods
        this.makePageInput = this.makePageInput.bind(this);
        this.makePageOfPageArea = this.makePageOfPageArea.bind(this);
        this.makeLeftButton = this.makeLeftButton.bind(this);
        this.makeRightButton = this.makeRightButton.bind(this);
        this.handleInputChange = this.handleInputChange.bind(this);
        this.handlePageRight = this.handlePageRight.bind(this);
        this.handlePageLeft = this.handlePageLeft.bind(this);
    }

    render(){
        let elements = [];
        if(this.props.totalPages > 1){
            elements.push(this.makeLeftButton());
            elements.push(this.makePageOfPageArea());
            elements.push(this.makeRightButton());
        } else {
            elements.push(this.makePageOfPageArea());
        }
        return(
            h('div', {
                id: this.getElementId(),
                class: 'cell table-paginator',
                'data-cell-id': this.props.id,
                'data-cell-type': "TablePaginator"
            }, elements)
        );
    }

    makeLeftButton(){
        let iconAttributes = {
            class: 'octicon octicon-triangle-left'
        };
        let disabled = false;
        if(this.props.currentPage == 1){
            disabled = true;
            iconAttributes.style = "color:lightgray;";
        }
        let icon = h('span', iconAttributes, []);
        return h('div', {
            class: 'clickable table-paginator-button',
            'data-disabled': disabled,
            onclick: this.handlePageLeft
        }, [icon]);
    }

    makeRightButton(){
        let iconAttributes = {
            class: 'octicon octicon-triangle-right'
        };
        let disabled = false;
        if(this.props.currentPage == this.props.totalPages){
            disabled = true;
            iconAttributes.style = "color:lightgray;";
        }
        let icon = h('span', iconAttributes, []);
        return h('div', {
            class: 'clickable table-paginator-button',
            'data-disabled': disabled,
            onclick: this.handlePageRight
        }, [icon]);
    }

    makePageOfPageArea(){
        let suffix;
        let suffixText = `of ${this.props.totalPages}`;
        if(this.props.totalPages == 1){
            suffixText = `1 ${suffixText}`;
            suffix = h('span', {}, suffixText);
            return h('div', {
                class: 'table-paginator-pagecount'
            }, [suffix]);
        } else {
            suffix = h('span', {}, suffixText);
            let input = this.makePageInput();
            return h('div', {
                class: 'table-paginator-pagecount'
            }, [input, suffix]);
        }

    }

    makePageInput(){
        return h('input', {
            type: 'text',
            pattern: "[0-9]+",
            value: this.props.currentPage.toString(),
            onchange: this.onInputChange
        });
    }

    handleInputChange(event){
        let pageNum = parseInt(event.target.value);
        if(pageNum <=0 || pageNum > this.props.totalPages){
            event.target.value = this.props.currentPage.toString();
            return;
        }
        let message = {
            event: "table-set-page",
            page: pageNum
        };
        self.sendMessage(message);
    }

    handlePageRight(event){
        if(this.props.currentPage < this.props.totalPages){
            let message = {
                event: "table-set-page",
                page: this.props.currentPage + 1
            };
            self.sendMessage(message);
        }
    }

    handlePageLeft(event){
        if(this.props.currentPage > 1){
            let message = {
                event: "table-set-page",
                page: this.props.currentPage - 1
            };
            self.sendMessage(message);
        }
    }
}

TablePaginator.propTypes = {
    currentPage: {
        type: PropTypes.number,
        description: "The current page index"
    },
    totalPages: {
        type: PropTypes.number,
        description: "The total number of pages"
    }
};

export {
    TablePaginator as default,
    TablePaginator
};
