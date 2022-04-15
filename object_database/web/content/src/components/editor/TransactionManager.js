class TransactionManager {
    constructor(dataModel, constants, onEvent=null, editSessionId='id', initBaseEventIndex=0) {
        this.dataModel = dataModel;
        this.constants = constants;
        this.editSessionId = editSessionId;

        // the base event of the current state the server knows
        this.topEventIndex = initBaseEventIndex;

        // events before the base event index
        this.priorEvents = [];

        // any unconsumed events
        this.events = [];

        this.undo = this.undo.bind(this);
        this.redo = this.redo.bind(this);
        this.snapshot = this.snapshot.bind(this);
        this.pushEvent = this.pushEvent.bind(this);
        this.pushBaseEvent = this.pushBaseEvent.bind(this);
        this.reverseEvent = this.reverseEvent.bind(this);
        this.computeNextUndo = this.computeNextUndo.bind(this);
        this.computeNextRedo = this.computeNextRedo.bind(this);

        this.eventsAreInSameUndoStream = this.eventsAreInSameUndoStream.bind(this);

        // should take (topEventIndex, relativeEventIndex, event)
        this.onEvent = onEvent;
    }

    snapshot(reason='unknown') {
        let event = this.dataModel.collectChanges(this.editSessionId, reason);

        if (event.changes.length > 0) {
            this.events.push(event);

            if (this.onEvent !== null) {
                this.onEvent(this.topEventIndex, this.events.length - 1, event);
            }
        }
    }

    // return a copy of the event that reverse its effects.
    // if 'isForUndo', then it becomes an 'undo' event with a new timestamp
    reverseEvent(event, isForUndo) {
        let undoState = null;
        if (isForUndo) {
            if (event.undoState == 'undo') {
                undoState = 'redo'
            } else if (event.undoState == 'redo') {
                undoState = 'undo'
            } else {
                undoState = 'undo'
            }
        }

        return {
            changes: event.changes.map((change) => {
                return {
                    oldLines: change.newLines,
                    newLines: change.oldLines,
                    lineIndex: change.lineIndex
                }
            }).reverse(),
            startCursors: event.newCursors,
            newCursors: event.startCursors,
            timestamp: isForUndo ? Date.now() / 1000.0 : event.timestamp,
            undoState: undoState,
            editSessionId: isForUndo ? this.editSessionId : event.editSessionId,
            reason: event.reason
        };
    }

    static eventLineBounds(event) {
        let changeIx = event.changes.length - 1;

        // compute an inclusive range of line indices that were affected.
        // we have to start at the last transaction and work backward
        let startIx = event.changes[changeIx].lineIndex;
        let endIx = startIx + event.changes[changeIx].oldLines.length - 1;

        changeIx--;
        while (changeIx >= 0) {
            let chg = event.changes[changeIx];

            if (chg.lineIndex < startIx) {
                startIx = chg.lineIndex;
                endIx += chg.newLines.length - chg.oldLines.length;
            } else if (chg.lineIndex > endIx) {
                endIx = Math.max(
                    chg.lineIndex + chg.oldLines.length - 1,
                    endIx + chg.newLines.length - chg.oldLines.length
                );
            }

            changeIx--;
        }

        return {lowIx: startIx, highIx: endIx}
    }

    static offsetEvent(event, lineCount) {
        return {
            changes: event.changes.map((change) => {
                return {
                    oldLines: change.oldLines,
                    newLines: change.newLines,
                    lineIndex: change.lineIndex + lineCount
                }
            }).reverse(),
            startCursors: event.newCursors,
            newCursors: event.startCursors,
            timestamp: event.timestamp,
            undoState: event.undoState,
            editSessionId: event.editSessionId,
            reason: event.reason
        };
    }

    static relativeLineCount(event) {
        let lc = 0;

        event.changes.forEach(
            (change) => { lc += change.newLines.length - change.oldLines.length; }
        );
        return lc;
    }

    // the server is telling us about a committed event
    pushBaseEvent(event) {
        if (this.events.length) {
            // see if this is our event
            if (event.editSessionId == this.editSessionId) {
                if (this.events.length && JSON.stringify(event) == JSON.stringify(this.events[0])) {
                    // it is - we can just pop our event off the front of the queue.
                    this.topEventIndex++;
                    this.priorEvents.push(this.events[0]);
                    this.events.splice(0, 1);
                    return false;
                }
            }

            // its not our top event!
            // for the moment, just roll back our edits - you have to do them
            // in reverse.

            // Note that 'reverse' mutates 'events'
            this.events.reverse().forEach((event) => {
                this.dataModel.pushEvent(
                    this.reverseEvent(event)
                );
            });

            let eventsToRebase = this.events.reverse();
            this.events = [];

            this.dataModel.pushEventButRetainCursors(event);
            this.topEventIndex += 1;

            // now attempt to push our events back on top in order, bailing as soon
            // as we have a conflict
            let relativeLineCount = TransactionManager.relativeLineCount(event);

            let rebaseBounds = TransactionManager.eventLineBounds(event);

            for (let i = 0; i < eventsToRebase.length; i++) {
                let e = eventsToRebase[i];

                let bounds = TransactionManager.eventLineBounds(e);

                if (bounds.lowIx > rebaseBounds.highIx || bounds.highIx < rebaseBounds.lowIx) {
                    // this edit was not contiguous with our edit, so we can apply it
                    if (bounds.lowIx > rebaseBounds.highIx) {
                        // it was below us so we need to offset it by the edits line delta
                        e = TransactionManager.offsetEvent(e, relativeLineCount);
                    } else {
                        // it was ABOVE us, so we need to move down our notion of the
                        // area of effect of 'edit'
                        let lineDelta = TransactionManager.relativeLineCount(e);
                        rebaseBounds.highIx += lineDelta;
                        rebaseBounds.lowIx += lineDelta;
                    }

                    this.pushEvent(e);
                } else {
                    // these events conflicted
                    console.log("Ignoring unrebasable event " + i + " out of " + eventsToRebase.length);
                    break;
                }
            }
        } else {
            this.priorEvents.push(event);
            if (event.editSessionId == this.editSessionId) {
                this.dataModel.pushEvent(event);
            } else {
                this.dataModel.pushEventButRetainCursors(event);
            }
            this.topEventIndex += 1;
        }

        return true;
    }

    // apply an event to the dataModel. It must be in an unedited state.
    pushEvent(event) {
        this.dataModel.pushEvent(event);
        this.events.push(event);

        if (this.onEvent !== null) {
            this.onEvent(this.topEventIndex, this.events.length - 1, event);
        }
    }

    eventByIx(ix) {
        if (ix < this.priorEvents.length) {
            return this.priorEvents[ix];
        }
        return this.events[ix - this.priorEvents.length];
    }

    //determine if two events (by index) should be considered part of the same 'undo' action
    //generally this is only true if the two events have edits that don't add/remove lines,
    //all edits are on the same lines, the cursor states at beginning/end are the same,
    //exactly one key was pressed, and the key was not the space bar
    eventsAreInSameUndoStream(ix1, ix2) {
        let e1 = this.eventByIx(ix1);
        let e2 = this.eventByIx(ix2);

        if (JSON.stringify(e1.startCursors) == JSON.stringify(e2.newCursors)) {
            if (e1.reason.keystroke !== undefined && e2.reason.keystroke !== undefined) {
                let catFor = (stroke) => {
                    if (stroke == ' ') {
                        return 'space';
                    }
                    if (stroke == 'Enter') {
                        return 'newline';
                    }
                    return 'char';
                }

                return catFor(e1.reason.keystroke) == catFor(e2.reason.keystroke);
            }
        }

        return false;
    }

    //return the index of the next event we'd want to 'undo'
    computeNextUndo() {
        // our event stream contains all the undo/redo events in the sequence
        // we can think of this as a stream of 'E' for event (e.g. typing something, which
        // erases the redo buffer), 'U' for undo, and 'R' for redo. A sequence might look
        // like EEEEEUU, meaning several events were pushed in and then two undos. If we
        // undo and then redo, its UR and if we undo, redo, and type its URE.
        // this stream completely encapsulates the state of the system, and lets us

        // how many events we still need to undo
        let pendingUndos = 1;

        let i = this.priorEvents.length + this.events.length - 1;

        while (i >= 0 && pendingUndos > 0) {
            if (this.eventByIx(i).undoState === null) {
                i -= 1;
                pendingUndos -= 1;
            } else if (this.eventByIx(i).undoState == 'undo') {
                i -= 1;
                pendingUndos += 1;
            } else if (this.eventByIx(i).undoState == 'redo') {
                i -= 1;
                pendingUndos -= 1;
            }
        }

        if (pendingUndos > 0) {
            return -1;
        }

        return i + 1;
    }

    //return the index of the next event we'd want to 'redo'
    computeNextRedo() {
        // how many events we want to redo
        let pendingRedos = 1;

        let i = this.priorEvents.length + this.events.length - 1;

        while (i >= 0 && pendingRedos > 0) {
            if (this.eventByIx(i).undoState === null) {
                return -1;
            } else if (this.eventByIx(i).undoState == 'undo') {
                i -= 1;
                pendingRedos -= 1;
            } else if (this.eventByIx(i).undoState == 'redo') {
                i -= 1;
                pendingRedos += 1;
            }
        }

        if (pendingRedos > 0) {
            return -1;
        }

        return i + 1;
    }

    undo() {
        let index = this.computeNextUndo();

        if (index == -1) {
            return false;
        }

        this.pushEvent(
            this.reverseEvent(this.eventByIx(index), true)
        );

        while (true) {
            let nextIndex = this.computeNextUndo();

            if (nextIndex == -1) {
                return true;
            }

            if (!this.eventsAreInSameUndoStream(index, nextIndex)) {
                return true;
            }

            this.pushEvent(
                this.reverseEvent(this.eventByIx(nextIndex), true)
            );

            index = nextIndex;
        }
    }

    redo() {
        let index = this.computeNextRedo();

        if (index == -1) {
            return false;
        }

        this.pushEvent(
            this.reverseEvent(this.eventByIx(index), true)
        );

        while (true) {
            let nextIndex = this.computeNextRedo();

            if (nextIndex == -1) {
                return true;
            }

            if (!this.eventsAreInSameUndoStream(index, nextIndex)) {
                return true;
            }

            this.pushEvent(
                this.reverseEvent(this.eventByIx(nextIndex), true)
            );

            index = nextIndex;
        }

        return true;
    }
}


export {TransactionManager}
