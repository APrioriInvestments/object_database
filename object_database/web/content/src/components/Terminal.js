/**
 * Terminal Cell
 */

import {Terminal as XtermTerminal} from "xterm";
import {WebglAddon} from 'xterm-addon-webgl';
import {makeDomElt as h, replaceChildren} from './Cell';
import {ConcreteCell} from './ConcreteCell';

class Terminal extends ConcreteCell {
    constructor(props, ...args){
        super(props, ...args);

        this.div = null;
        this.termDiv = null;
        this.term = null;
        this.renderCount = 0;

        // the maximum size of the terminal we could have at all as [rows, cols]
        this.maxTerminalSize = {rows: 0, cols: 0};

        // the size the server knows
        this.serverEffectiveSize = {rows: 0, cols: 0};

        this.installResizeObserver = this.installResizeObserver.bind(this);
        this.setTerminalSize = this.setTerminalSize.bind(this);
        this.onDisconnected = this.onDisconnected.bind(this);
    }

    onDisconnected() {
        this.div.appendChild(
            h(
                'div', {
                    class: 'terminal-disconnected',
                },
            ["DISCONNECTED"]
            )
        );
    }

    setTerminalSize() {
        let width = this.term._core._renderService.dimensions.css.cell.width;
        let height = this.term._core._renderService.dimensions.css.cell.height;

        if (width == 0) {
            width = 9.0125;
        }
        if (height == 0) {
            height = 17;
        }

        let cols = Math.max(2, Math.floor( (this.lastWidth - 25) / width));
        let rows = Math.max(2, Math.floor(this.lastHeight / height));

        if (this.maxTerminalSize.rows != rows || this.maxTerminalSize.cols != cols) {
            this.maxTerminalSize = {rows: rows, cols: cols};
            this.sendMessage({size: this.maxTerminalSize});
        }

        let sizeToUse = this.serverEffectiveSize;

        if (sizeToUse.rows == 0 && sizeToUse.cols == 0) {
            sizeToUse = this.maxTerminalSize;
        }

        this.term.resize(sizeToUse.cols, sizeToUse.rows);
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

                this.setTerminalSize();
            }
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
    }

    build(){
        if (this.div !== null) {
            return this.div;
        }
        this.termDiv = h('div', {}, []);

        this.div = h('div', {
            style: 'position: relative',
            class: `cell cell-terminal fill-space-horizontal fill-space-vertical`,
            onmousedown: (e) => {
                this.focusReceived();
            },
        }, [this.termDiv]);

        this.term = new XtermTerminal({convertEol: true, cursorBlink: true});
        this.term.open(this.termDiv);

        const addon = new WebglAddon();
        addon.onContextLoss(e => {
          addon.dispose();
        });
        this.term.loadAddon(addon);

        this.term.onData(data => {
            this.sendMessage({data: data});
        });

        return this.div;
    }

    handleMessages(messages) {
        messages.forEach((message) => {
            if (message.data !== undefined) {
                this.term.write(message.data);
            }
            if (message.effectiveSize !== undefined) {
                this.serverEffectiveSize = message.effectiveSize;
                this.setTerminalSize();
            }
            if (message.isDisconnected) {
                this.onDisconnected();
            }
        });
    }

    _computeFillSpacePreferences() {
        return {horizontal: true, vertical: true};
    }
}

export {Terminal, Terminal as default};
