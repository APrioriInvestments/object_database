/**
 * CodeEditor Cell Component
 */

import {Component} from './Component';
import {PropTypes} from './util/PropertyValidator';
import {h} from 'maquette';

class CodeEditor extends Component {
    constructor(props, ...args){
        super(props, ...args);
        this.editor = null;
        // used to schedule regular server updates
        this.SERVER_UPDATE_DELAY_MS = 50;

        this.onChange = this.onChange.bind(this);
        this.handleMouseover = this.handleMouseover.bind(this);
        this._handleMouseover = this._handleMouseover.bind(this);
        this.handleMouseleave = this.handleMouseleave.bind(this);
        this.setupEditor = this.setupEditor.bind(this);
        this.setupKeybindings = this.setupKeybindings.bind(this);
        this.installChangeHandlers = this.installChangeHandlers.bind(this);
        this.setTextFromServer = this.setTextFromServer.bind(this);
        this.lastSentText = null;
        this.mouseoverTimeout = null;
        // keeps track of any highlight related markers
        this.highlightMarker = null;

        // A cached version of the created
        // DOM node will be put here for
        // later reference
        this._cachedDOMNode = null;

        // every time we rebuild ourselves and want to remember our
        // dom element we set this to true
        this._isCachedInPlaceholder = false;
        this._wasFocusedBeforePlaceholder = false;

        // Used to register and deregister
        // any global KeyListener instance
        this.disableEventFiring = false;
        this._onBlur = this._onBlur.bind(this);
        this._onFocus = this._onFocus.bind(this);
        this.onScroll = this.onScroll.bind(this);
        this._highlight = this._highlight.bind(this);
    }

    componentDidLoad() {
        this.setupEditor();

        if (this.editor === null) {
            console.log("editor component loaded but failed to setup editor");
        } else {
            console.log("setting up editor");
            // Note: Ace doens't handle 'mouseleave' events so this listener is
            // bound directly to the code-editor DOM element, see .build() and
            // handleMouseleave() below
            this.editor.on("mousemove", (e) => this.handleMouseover(e));
            this.editor.last_edit_millis = Date.now();
            this.editor.setTheme("ace/theme/textmate");
            this.editor.session.setMode("ace/mode/python");
            // this.editor.setAutoScrollEditorIntoView(true);
            this.editor.session.setUseSoftTabs(true);


            if (this.props.initialText !== null) {
                this.editor.setValue(this.props.initialText, 1);
            }

            if (this.props.currentIteration !== null) {
                this.editor.current_iteration = this.props.currentIteration;
            }

            if (this.props.autocomplete) {
                this.editor.setOptions({enableBasicAutocompletion: true});
                this.editor.setOptions({enableLiveAutocompletion: true});
            }

            if (this.props.noScroll) {
                this.editor.setOption("maxLines", Infinity);
            }

            if (this.props.readOnly) {
                this.editor.setReadOnly(true);
            }

            if (this.props.fontSize !== undefined) {
                this.editor.setOption("fontSize", this.props.fontSize);
            }

            if (this.props.minLines !== undefined) {
                this.editor.setOption("minLines", this.props.minLines);
            } else {
                this.editor.setOption("minLines", Infinity);
            }

            if (this.props.firstVisibleRow !== undefined){
                this.editor.resize(true);
                this.editor.scrollToRow(this.props.firstVisibleRow - 1)
                this.editor.gotoLine(this.props.firstVisibleRow, 0, true);
            }

            if (this.props.initialSelection !== null) {
                this.editor.selection.setSelectionRange(this.props.initialSelection);
                if (this.props.firstVisibleRow !== undefined){
                    this.editor.scrollToRow(this.props.firstVisibleRow - 1)
                }
            }

            if (this.props.highlightRange !== undefined){
                let startRow = this.props.highlightRange["startRow"] || 1;
                let endRow = this.props.highlightRange["endRow"] || 1;
                let highlightColor = this.props.highlightRange["color"] || "red";
                this._highlight(startRow, endRow, highlightColor);
            }

            this.setupKeybindings();
            this.installChangeHandlers();
        }

        if(this.numRenders == 1){
            this._cachedDOMNode = this.getDOMElement();
        }
    }

    componentDidUpdate(projector){
        // Replace the placeholder with the cached
        // DOM element
        if (this._isCachedInPlaceholder) {
            this._isCachedInPlaceholder = false;

            let placeholder = document.getElementById(`placeholder-${this.props.id}`);

            if(placeholder){
                placeholder.replaceWith(this._cachedDOMNode);
            } else {
                throw new Error(`Could not find replacement node for ${this.name}[${this.props.id}]`);
            }

            let newEditor = ace.edit(`editor${this.props.id}`);
            newEditor.setSession(this.editor.session);
            this.editor = newEditor;

            if (this._wasFocusedBeforePlaceholder) {
                this._wasFocusedBeforePlaceholder = false;
                this.editor.focus();
            }
        }
    }

    build(){
        if(this.hasRenderedBefore){
            console.log(`Cached re-render of ${this.name}[${this.props.id}]`);

            this._isCachedInPlaceholder = true;
            this._wasFocusedBeforePlaceholder = this.editor.isFocused();

            return h('div', {
                class: "cell-placeholder",
                id: `placeholder-${this.props.id}`
            }, []);
        } else {
            console.log(`Initial render of ${this.name}[${this.props.id}]`);
            return h('div',
            {
                class: "cell code-editor",
                id: this.getElementId(),
                "data-cell-id": this.props.id,
                "data-cell-type": "CodeEditor",
                key: this
            },
                 [h('div', {
                     id: "editor" + this.props.id,
                     class: "code-editor-inner",
                     onmouseleave: this.handleMouseleave
                 }, [])
        ]);
        }
    }

    handleMouseover(e){
        clearTimeout(this.mouseoverTimeout);
        this.mouseoverTimeout = setTimeout(this._handleMouseover, this.props.mouseoverTimeout, e);
    }

    _handleMouseover(e){
        let pos = e.getDocumentPosition();
        let line = e.editor.session.getLine(pos["row"]);
        let token = e.editor.session.getTokenAt(pos["row"], pos["column"]);
        let val = "";
        if (token) {
            val = token.value;
        }
        let responseData = {
            event: 'mouseover',
            'target_cell': this.props.id,
            row: pos["row"],
            column: pos["column"],
            line: line,
            token: val
        };
        cellSocket.sendString(JSON.stringify(responseData));
    }

    handleMouseleave(){
        clearTimeout(this.mouseoverTimeout);
    }

    setupEditor(){
        let editorId = "editor" + this.props.id;
        // TODO These are global var defined in page.html
        // we should do something about this.

        // here we bing and inset the editor into the div rendered by
        // this.render()
        this.editor = ace.edit(editorId);
        // TODO: deal with this global editor list
        aceEditorComponents[editorId] = this;

        // force a focus. it would be better to pick a better way to trigger
        // this from the serverside after an action
        this.editor.focus();

    }

    /* I handle data updating for the CodeEditor.
     */
    _updateData(dataInfos, projector) {
        dataInfos.map((dataInfo) => {
            if (dataInfo.firstVisibleRow) {
                console.log("CodeEditor updating first visible row to " + dataInfo.firstVisibleRow)
                let row = parseInt(dataInfo.firstVisibleRow);
                this.editor.resize(true);
                this.editor.scrollToRow(row - 1)
                this.editor.gotoLine(row, 0, true);
            } else if(dataInfo.highlight === true) {
                let startRow = this.dataInfo.startRow || 1;
                let endRow = this.dataInfo.endRow || 1;
                let highlightColor = this.dataInfo.color || "red";
                this._highlight(startRow, endRow, highlightColor);
            } else if (dataInfo.highlight === false){
                // remove the highlighting
                if (this.highlightMarker !== null){
                    this.session.removeMarker(this.highlightMarker);
                }
            } else if (dataInfo.selection) {
                console.log("CodeEditor updating selection to " + dataInfo.selection)
                this.editor.selection.setSelectionRange(dataInfo.selection);
            } else if (dataInfo.focusNow) {
                this.editor.focus();
            }
        })
    }

    setTextFromServer(iteration, newBufferText) {
        this.editor.last_edit_millis = Date.now();
        this.editor.current_iteration = iteration;
        this.editor.lastSentText = newBufferText;

        var curRange = this.editor.selection.getRange();
        this.lastSentText = newBufferText;

        console.log("Resetting editor text to " + newBufferText.length
            + " because it changed on the server" +
            " Cur iteration is " + iteration + ".");

        try {
            this.disableEventFiring = true;
            this.editor.setValue(newBufferText, 1);
            this.editor.selection.setSelectionRange(curRange);
        } finally {
            this.disableEventFiring = false;
        }
    }

    onChange() {
        // if we're setting this as a part of a server update, we don't want to
        // immediately fire an event back to the server.
        if (this.disableEventFiring) {
            return;
        }

        //record that we just edited
        this.editor.last_edit_millis = Date.now();

        //schedule a function to run in 'SERVER_UPDATE_DELAY_MS'ms
        //that will update the server, but only if the user has stopped typing.
        window.setTimeout(() => {
            if (Date.now() - this.editor.last_edit_millis >= this.SERVER_UPDATE_DELAY_MS) {
                //save our current state to the remote buffer
                console.log("Updating server state for CodeEditor(" + this.props.id + ")");

                this.editor.current_iteration += 1;
                this.editor.last_edit_millis = Date.now();

                var bufferToSend = null;

                // don't send the buffer again if it hasn't changed.
                if (this.editor.getValue() != this.lastSentText) {
                    bufferToSend = this.editor.getValue();
                    this.lastSentText = bufferToSend;
                }

                let responseData = {
                    event: 'editing',
                    'target_cell': this.props.id,
                    buffer: bufferToSend,
                    selection: this.editor.selection.getRange(),
                    iteration: this.editor.current_iteration
                };

                cellSocket.sendString(JSON.stringify(responseData));
            }
        }, this.SERVER_UPDATE_DELAY_MS + 2); //note the 2ms grace period
    }

    onScroll(event){
        let responseData = {
            event: 'scrolling',
            'target_cell': this.props.id,
            'firstVisibleRow': this.editor.getFirstVisibleRow() + 1,
            'lastVisibleRow': this.editor.getLastVisibleRow() + 1
        };

        cellSocket.sendString(JSON.stringify(responseData));
    }

    installChangeHandlers() {

        //any time we do anything, update the server
        this.editor.selection.on("changeCursor", this.onChange);
        this.editor.selection.on("changeSelection", this.onChange);
        this.editor.session.on("change", this.onChange);
        this.editor.session.on("changeScrollTop", this.onScroll);
    }

    setupKeybindings() {
        this.props.keybindings.map((kb) => {
            this.editor.commands.addCommand(
                {
                    name: 'cmd' + kb,
                    bindKey: {win: 'Ctrl-' + kb,  mac: 'Command-' + kb},
                    readOnly: true,
                    exec: () => {
                        this.editor.current_iteration += 1;
                        this.editor.last_edit_millis = Date.now();
                        this.editor.lastSentText = this.editor.getValue();

                        // WS
                        let responseData = {
                            event: 'keybinding',
                            'target_cell': this.props.id,
                            'key': kb,
                            'buffer': this.editor.getValue(),
                            'selection': this.editor.selection.getRange(),
                            'iteration': this.editor.current_iteration
                        };
                        cellSocket.sendString(JSON.stringify(responseData));
                    }
                }
            );
        });
    }

    _onBlur(event){
        if(this.constructor.keyListener){
            this.constructor.keyListener.start();
        }
    }

    _onFocus(event){
        if(this.constructor.keyListener){
            this.constructor.keyListener.pause();
        }
    }

    /* I highlight rows by specififying their background color.
     * Note: I use the ace.addMarker API which limits me to adding
     * specific css classes, so as of writing the available colors are
     * 'red' 'blue' and 'green.'
     */
    _highlight(startRow, endRow, color){
        let Range = ace.require('ace/range').Range;
        let highlightRange = new Range(startRow - 1, 0, endRow - 1, 0);
        this.highlightMarker = this.editor.session.addMarker(
             highlightRange,
            `ace_active-line highlight-${color}`,
            "fullLine"
        );
    }
}

CodeEditor.propTypes = {
    keybindings: {
        description: "An array of keys bound to the primary control key for the OS",
        type: PropTypes.array
    },

    initialText: {
        description: "The initial text to show in the Ace Editor",
        type: PropTypes.string
    },

    initialSelection: {
        description: "The initial selection state to show in the Ace Editor",
        type: PropTypes.object
    },

    autocomplete: {
        description: "Whether or not the Ace Editor should enable autocomplete mode",
        type: PropTypes.boolean
    },

    noScroll: {
        description: "If true, sets Ace Editor's maxLines to Infinity",
        type: PropTypes.boolean
    },

    readOnly: {
        description: "If true, sets Ace Editor's readOnly to True",
        type: PropTypes.boolean
    },

    fontSize: {
        description: "Set the font size for the Ace Editor",
        type: PropTypes.oneOf([PropTypes.number, PropTypes.string])
    },

    mouseoverTimeout: {
        description: "Timeout for the mouseover event used to delay the callback",
        type: PropTypes.oneOf(PropTypes.number)
    },

    firstVisibleRow: {
        description: "Set the first visible row of the Editor",
        type: PropTypes.number
    },

    minLines: {
        description: "Sets the minimum number of lines in the Ace Editor",
        type: PropTypes.number
    },

    highlightRange: {
        description: "A dictionary object containing 'startRow' 'startColumn' 'endRow' 'endColumn' for code highlighting",
        type: PropTypes.object
    }
};

export {CodeEditor, CodeEditor as default};
