/**
 * Timestamp Cell Cell
 */

import {makeDomElt as h} from './Cell';
import {ConcreteCell} from './ConcreteCell';

import * as moment from 'moment';

/**
 * About Named Children
 * Thi Cell contains no named children
 */
class Timestamp extends ConcreteCell {
    constructor(props, ...args){
        super(props, ...args);

        this.timeformat = 'YYYY-MM-D HH:mm:ss';
        this.timezone = this.getCurrentTimeZone();
        this.timestamp = moment.unix(this.props.timestamp);
        // make sure user knows to hover over
        this.style = "cursor: default";

        // Bind Cell methods
        this.handleMouseover = this.handleMouseover.bind(this);
        this.getMilliseconds = this.getMilliseconds.bind(this);
    }

    build(){
        return h('span',
            {
                class: "cell",
                style: this.style,
                id: this.getElementId(),
                "data-cell-id": this.identity,
                "data-cell-type": "Timestamp",
                onmouseover: this.handleMouseover
            }, [
        h('span', {}, [this.timestamp.format(this.timeformat)]), // Date + time
        h('span', {style: "font-weight: 150"}, ["." + this.getMilliseconds()]), // Milliseconds in lighter font
        // h('span', {}, [this.timestamp.format(' A')]), // AM/PM
    ]);
    }

    getMilliseconds() {
        let ms = this.timestamp.milliseconds();
        ms = ms.toString();
        if (ms.length === 2) {
            ms = "0" + ms;
        } else if(ms.length === 1) {
            ms = "00" + ms;
        }
        return ms;
    }

    getCurrentTimeZone(){
        let now = new Date();
        // ex format: "14:16:26 GMT-0400 (Eastern Daylight Time)"
        now = now.toTimeString();
        // ex format: "Eastern Daylight Time"
        let tz = now.split("(")[1].slice(0, -1);
        return tz;
    }

    /**
     * Dynamically update the title attribute with every
     * hover/mouseover to display the current time and this.timestamp
     */
    handleMouseover(event) {
        let timediff = moment().diff(this.timestamp, "seconds");
        event.target.title = this._timediffString(timediff) + "(" + this.timezone + ")";
    }

    /**
     * Takes a time difference in seconds (!) and returns a user-friendly string
     */
    _timediffString(timediff) {
        if (timediff === 1){
            return timediff + " second ago ";
        } else if(timediff < 60){
            return timediff + " seconds ago ";
        } else if (timediff < 3600) {
            let minutediff = Math.round(timediff/60);
            if (minutediff === 1) {
                return minutediff + " minute ago ";
            } else {
                return minutediff + " minutes ago ";
            }
        } else {
            let hourdiff = Math.round(timediff/3600);
            if (hourdiff === 1) {
                return hourdiff + " hour ago ";
            } else {
                return hourdiff + " hours ago ";
            }
        }
    }
}

export {Timestamp, Timestamp as default};
