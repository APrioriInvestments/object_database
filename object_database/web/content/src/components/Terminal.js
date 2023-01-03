/**
 * Terminal Cell
 */

import {Terminal as XtermTerminal} from "xterm";
import {makeDomElt as h, replaceChildren} from './Cell';
import {ConcreteCell} from './ConcreteCell';
import { FitAddon } from 'xterm-addon-fit';

class Terminal extends ConcreteCell {
    constructor(props, ...args){
        super(props, ...args);

        this.div = null;
        this.term = null;
        this.fitAddon = null;
        this.renderCount = 0;
        this.installResizeObserver = this.installResizeObserver.bind(this);
    }

    installResizeObserver() {
        let observer = new ResizeObserver(entries => {
            for (let entry of entries) {
                if (entry.contentRect.width == this.lastWidth &&
                    entry.contentRect.height == this.lastHeight) {
                    return
                }

                this.lastWidth = entry.contentRect.width;
                this.lastHeight = entry.contentRect.height;
            }

            this.fitAddon.fit();
        });

        observer.observe(this.div);
    }

    serverKnowsAsFocusedCell() {
        if (this.term !== null) {
            this.term.focus();
        } else {
            this.focusOnCreate = true;
        }
    }

    allottedSpaceIsInfinite(child) {
        return false;
    }

    onFirstInstalled() {
        if (this.focusOnCreate) {
            this.term.focus();
            this.focusOnCreate = false;
        }

        if (this.props.exception) {
            return;
        }

        this.installResizeObserver();

        this.fitAddon.fit();
        this.sendMessage({size: {rows: this.term.rows, cols: this.term.cols}});
    }

    build(){
        if (this.div !== null) {
            return this.div;
        }

        this.div = h('div', {
            class: `cell cell-terminal fill-space-horizontal fill-space-vertical`,
            onmousedown: (e) => {
                this.focusReceived();
            },
        }, []);

        this.fitAddon = new FitAddon();

        this.term = new XtermTerminal({convertEol: true, cursorBlink: true});
        this.term.loadAddon(this.fitAddon);
        this.term.open(this.div);

        this.term.onData(data => {
            this.sendMessage({data: data});
        });

        this.term.onResize(() => {
            this.sendMessage({size: {rows: this.term.rows, cols: this.term.cols}});
        })

        this.term.onRender(() => {
            // for whatever reason, the first couple of renders require
            // us to re-call 'fitAddon' because it doesn't correctly
            // calculate the size of the upcoming terminal, even though the
            // size of the parent div is already set and known.
            this.renderCount += 1;
            if (this.renderCount < 3) {
                this.fitAddon.fit();
            }
        })

        return this.div;
    }

    handleMessages(messages) {
        messages.forEach((message) => {
            if (message.data !== undefined) {
                this.term.write(message.data);
            }
        });
    }

    _computeFillSpacePreferences() {
        return {horizontal: true, vertical: true};
    }
}

export {Terminal, Terminal as default};
