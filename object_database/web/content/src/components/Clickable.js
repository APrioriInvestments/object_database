/**
 * Clickable Cell Cell
 */
import {makeDomElt as h} from './Cell';
import {ConcreteCell} from './ConcreteCell';

/**
 * About Named Children
 * --------------------
 * `content` (single) - The cell that can go inside the clickable
 *        Cell
 */
class Clickable extends ConcreteCell {
    constructor(props, ...args){
        super(props, ...args);

        // Bind context to methods
        this.makeContent = this.makeContent.bind(this);
        this.getStyle = this.getStyle.bind(this);
        this.onClick = this.onClick.bind(this);
    }

    build(){
        return(
            h('div', {
                id: this.getElementId(),
                class: "cell clickable allow-child-to-fill-space",
                "data-cell-id": this.identity,
                "data-cell-type": "Clickable",
                onclick: this.onClick,
                tabindex: -1,
                onmousedown: (event) => {
                    // prevent the event from causing us to focus since we just want a
                    // click
                    event.preventDefault();
                },
                style: this.getStyle()
            }, [
                this.makeContent()
            ]
            )
        );
    }

    capturesClicks() {
        return true;
    }

    getStyle(){
        if(this.props.bold){
            return "cursor:pointer;*cursor:hand;font-weight:bold;";
        } else {
            return "";
        }
    }

    _computeFillSpacePreferences() {
        return this.namedChildren['content'].getFillSpacePreferences();
    }

    makeContent(){
        return this.renderChildNamed('content');
    }

    onClick(event) {
        event.stopPropagation();

        if (this.props.url) {
            if (event.ctrlKey) {
                window.open(this.props.url, "_blank");
            }
            else if (this.props.target) {
                window.open(this.props.url, this.props.target);
            } else {
                window.location.href = this.props.url;
            }
        } else {
            if (event.ctrlKey) {
                this.sendMessage({'event': 'ctrlClick'});
            }
            else {
                this.sendMessage({'event': 'click'});
            }
        }
    }

    handleMessages(messages) {
        messages.forEach(msg => {
            if (msg.action == 'redirect') {
                if (msg.target) {
                    window.open(msg.url, msg.target);
                } else {
                    window.location.href = msg.url;
                }
            }
        });
    }
}

export {Clickable, Clickable as default};
