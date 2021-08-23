import {makeDomElt as h} from './Cell';
import * as moment from 'moment';

class AxisRenderer {
    constructor(which, axisDiv, legendDiv, plotData, glRenderer, knownTopAxisSize) {
        this.which = which;
        this.knownTopAxisSize = knownTopAxisSize;
        this.plotData = plotData;
        this.axisDiv = axisDiv;
        this.legendDiv = legendDiv;
        this.axisData = plotData.axes[which];
        this.glRenderer = glRenderer;

        this.render = this.render.bind(this);
        this.renderHorizontalAxis = this.renderHorizontalAxis.bind(this);
        this.renderVerticalAxis = this.renderVerticalAxis.bind(this);
        this.clearAxis = this.clearAxis.bind(this);
        this.smallerTickSize = this.smallerTickSize.bind(this);
        this.largerTickSize = this.largerTickSize.bind(this);
        this.formatNumber = this.formatNumber.bind(this);
        this.colorToString = this.colorToString.bind(this);

        this.pickTickSizeFor = this.pickTickSizeFor.bind(this);
        this.nextTick = this.nextTick.bind(this);
        this.isZeroTick = this.isZeroTick.bind(this);
    }

    render() {
        this.clearAxis();

        if (!this.axisData) {
            return;
        }

        if (this.axisData.space || this.axisData.allowExpand) {
            if (this.which == 'bottom') {
                this.renderHorizontalAxis(true);
            } else if (this.which == 'top') {
                this.renderHorizontalAxis(false);
            } else if (this.which == 'left') {
                this.renderVerticalAxis(false);
            } else if (this.which == 'right') {
                this.renderVerticalAxis(true);
            }
        }
    }

    colorToString(color) {
        return "rgba(" + color[0] * 255 + "," + color[1] * 255 + "," + color[2] * 255 + "," + color[3] + ")";
    }

    pickTickSizeFor(low, high, pixels, minWidth, maxWidth) {
        if (this.axisData.isTimestamp) {
            // make larger because otherwise we don't have enough space
            minWidth *= 2;
            maxWidth *= 2;

            // first see, approximately how many years is it
            let years = (high - low) / (86400 * 365.25);

            let pixelsPerYear = (pixels / years);

            if (pixelsPerYear < minWidth) {
                years = 1;

                while (pixelsPerYear * years < minWidth) {
                    if (years == 1) {
                        years = 2;
                    } else if (years == 2) {
                        years = 5;
                    } else if (years == 5) {
                        years = 10;
                    } else {
                        years = years * 2;
                    }
                }

                return {'years': years}
            }

            if (pixelsPerYear < maxWidth) {
                return {'years': 1}
            }

            let months = (high - low) / (86400 * 30.5);
            let pixelsPerMonth = (pixels / months);

            if (pixelsPerMonth * 6 < maxWidth) {
                return {'months': 6}
            }

            if (pixelsPerMonth * 2 < maxWidth) {
                return {'months': 2}
            }

            if (pixelsPerMonth < maxWidth) {
                return {'months': 1}
            }

            let days = (high - low) / (86400);
            let pixelsPerDay = (pixels / days);

            if (pixelsPerDay * 20 < maxWidth) {
                return {'days': 20}
            }
            if (pixelsPerDay * 10 < maxWidth) {
                return {'days': 10}
            }
            if (pixelsPerDay * 5 < maxWidth) {
                return {'days': 5}
            }
            if (pixelsPerDay * 2 < maxWidth) {
                return {'days': 2}
            }
            if (pixelsPerDay < maxWidth) {
                return {'days': 1}
            }

            let hours = (high - low) / 3600;
            let pixelsPerHour = (pixels / hours);

            if (pixelsPerHour * 12 < maxWidth) {
                return {'hours': 12}
            }
            if (pixelsPerHour * 6 < maxWidth) {
                return {'hours': 6}
            }
            if (pixelsPerHour * 2 < maxWidth) {
                return {'hours': 2}
            }
            if (pixelsPerHour < maxWidth) {
                return {'hours': 1}
            }

            let minutes = (high - low) / 60;
            let pixelsPerMinute = (pixels / minutes);

            if (pixelsPerMinute * 30 < maxWidth) {
                return {'minutes': 30}
            }
            if (pixelsPerMinute * 15 < maxWidth) {
                return {'minutes': 15}
            }
            if (pixelsPerMinute * 5 < maxWidth) {
                return {'minutes': 5}
            }
            if (pixelsPerMinute * 2 < maxWidth) {
                return {'minutes': 2}
            }
            if (pixelsPerMinute < maxWidth) {
                return {'minutes': 1}
            }

            let seconds = (high - low);
            let pixelsPerSecond = (pixels / seconds);

            if (pixelsPerSecond * 30 < maxWidth) {
                return {'seconds': 30}
            }
            if (pixelsPerSecond * 15 < maxWidth) {
                return {'seconds': 15}
            }
            if (pixelsPerSecond * 5 < maxWidth) {
                return {'seconds': 5}
            }
            if (pixelsPerSecond * 2 < maxWidth) {
                return {'seconds': 2}
            }
            if (pixelsPerSecond < maxWidth) {
                return {'seconds': 1}
            }

            // otherwise, just use normal logic since we're on seconds
        }

        let tickWidthPx = pixels;
        let tickSize = high - low;

        while (tickWidthPx > maxWidth || tickWidthPx < minWidth) {
            let newTickSize = tickWidthPx > maxWidth ? this.smallerTickSize(tickSize) : this.largerTickSize(tickSize);
            tickWidthPx *= newTickSize / tickSize;
            tickSize = newTickSize;
        }

        if (this.axisData.isTimestamp) {
            return Math.max(tickSize, 0.001);
        }

        return Math.max(tickSize, 1e-9);
    }

    nextTick(pos, tickSize) {
        if (typeof(tickSize) == 'number') {
            let res = Math.ceil(pos / tickSize + 0.00001) * tickSize;

            return res;
        } else {
            let ts = moment.unix(pos);
            let ts2 = null;

            if (tickSize.years) {
                let years = ts.diff(moment({year: 1970}), 'years')
                years = Math.ceil(years / tickSize.years + 0.001) * tickSize.years;

                ts2 = moment({year: 1970}).add(years, 'years');
            }
            else if (tickSize.months) {
                let months = ts.diff(moment({year: 1970}), 'months')
                months = Math.ceil(months / tickSize.months + 0.001) * tickSize.months;

                ts2 = moment({year: 1970}).add(months, 'months');
            }
            else if (tickSize.days) {
                let days = ts.diff(moment({year: 1970}), 'days')
                days = Math.ceil(days / tickSize.days + 0.001) * tickSize.days;

                ts2 = moment({year: 1970}).add(days, 'days');
            }
            else if (tickSize.hours) {
                let hours = ts.diff(moment({year: 1970}), 'hours')
                hours = Math.ceil(hours / tickSize.hours + 0.001) * tickSize.hours;

                ts2 = moment({year: 1970}).add(hours, 'hours');
            }
            else if (tickSize.minutes) {
                let minutes = ts.diff(moment({year: 1970}), 'minutes')
                minutes = Math.ceil(minutes / tickSize.minutes + 0.001) * tickSize.minutes;

                ts2 = moment({year: 1970}).add(minutes, 'minutes');
            }
            else if (tickSize.seconds) {
                let seconds = ts.diff(moment({year: 1970}), 'seconds')
                seconds = Math.ceil(seconds / tickSize.seconds + 0.001) * tickSize.seconds;

                ts2 = moment({year: 1970}).add(seconds, 'seconds');
            } else {
                throw new Error('Bad tickSize');
            }

            return ts2.unix();
        }
    }

    isZeroTick(pos, tickSize) {
        if (this.axisData.isTimestamp) {
            return false;
        }

        return Math.round(pos / tickSize) == 0.0;
    }

    renderVerticalAxis(isFar) {
        if (this.axisData.label) {
            this.legendDiv.appendChild(
                h('div', {style: 'height:100%;display:flex;flex-direction:column;justify-content:center;pointer-events:none'}, [
                    h('div', {style: 'text-align:center;min-width:40px;padding-right:3px;pointer-events:none'}, [this.axisData.label])
                ])
            )
        }

        let topAxisHeight = this.knownTopAxisSize;

        let plotWidthPx = this.glRenderer.canvas.width;
        let plotHeightPx = this.glRenderer.canvas.height;

        let axisLabelAreaWidth = this.axisData.space;

        this.axisDiv.style.width = axisLabelAreaWidth + "px";
        this.axisDiv.style.position = 'relative'
        this.axisDiv.style.top = topAxisHeight + "px";
        this.axisDiv.style.height = plotHeightPx + "px";

        // these are the coordinates in the actual data display
        let y0 = this.glRenderer.screenPosition[1];
        let y1 = y0 + this.glRenderer.screenSize[1];

        // map these coordinates to the coordinates we want to display
        y0 = this.axisData.offset + y0 * this.axisData.scale;
        y1 = this.axisData.offset + y1 * this.axisData.scale;

        // determine the tick width we want to show - we want to show gridmarks between
        // 100 and 250 pixels on values at a 10, 20, 50, or 100
        let tickSize = this.pickTickSizeFor(y0, y1, plotHeightPx, 49, 126);

        // draw tickmarks
        let y0Tick = this.nextTick(y0, tickSize);

        let ct = 0;

        let labelDivs = [];
        let lineDivs = [];

        while (y0Tick < y1) {
            ct += 1;
            if (ct > 10000) {
                throw new Error("Somehow, we added 10000 ticks? TickSize is " + tickSize);
            }

            let pxPosition = plotHeightPx * (y0Tick - y0) / (y1 - y0);

            let lineDiv = h('div', {style:
                'height:1px;position:absolute;left:' + (
                    axisLabelAreaWidth + (isFar ? -plotWidthPx : 0)
                )
                + 'px;width:' + plotWidthPx + 'px;bottom:' + pxPosition + "px;"
                + 'background-color:' + this.colorToString(
                    this.isZeroTick(y0Tick, tickSize) ? this.axisData.zeroColor : this.axisData.ticklineColor
                )
            }, []);

            this.axisDiv.appendChild(lineDiv);
            lineDivs.push(lineDiv);

            let labelDiv = h('div', {style:
                    'white-space:nowrap;pointer-events:none;position:absolute;bottom:' + pxPosition + "px;"
                    + (
                        isFar ?
                          "transform:translate(0%,50%);"
                        : "left:" + (axisLabelAreaWidth - 5) + "px;transform:translate(-100%,50%);"
                    )
            }, [this.formatNumber(y0Tick, tickSize)]);

            this.axisDiv.appendChild(labelDiv);
            labelDivs.push(labelDiv);

            y0Tick = this.nextTick(y0Tick, tickSize);
        }

        if (this.axisData.allowExpand) {
            let maxWidth = 0;

            for (let i = 0; i < labelDivs.length; i++) {
                maxWidth = Math.max(maxWidth, labelDivs[i].clientWidth);
            }

            let newWidth = Math.max(maxWidth + 10, axisLabelAreaWidth);

            if (newWidth != axisLabelAreaWidth) {
                this.axisDiv.style.width = newWidth + "px";

                if (!isFar) {
                    labelDivs.forEach(div => {
                        div.style.left = (newWidth - 5) + "px";
                    });
                }

                lineDivs.forEach(div => {
                    div.style.left = (newWidth + (isFar ? -plotWidthPx : 0)) + "px";
                });
            }
        }
    }

    renderHorizontalAxis(isFar) {
        if (this.axisData.label) {
            this.legendDiv.appendChild(
                h('div', {style: 'text-align: center;pointer-events:none'}, [this.axisData.label])
            )
        }

        this.axisDiv.style.height = this.axisData.space + "px";

        let plotWidthPx = this.glRenderer.canvas.width;
        let plotHeightPx = this.glRenderer.canvas.height;

        // these are the coordinates in the actual data display
        let x0 = this.glRenderer.screenPosition[0];
        let x1 = x0 + this.glRenderer.screenSize[0];

        // map these coordinates to the coordinates we want to display
        x0 = this.axisData.offset + x0 * this.axisData.scale;
        x1 = this.axisData.offset + x1 * this.axisData.scale;

        // determine the tick width we want to show - we want to show gridmarks between
        // 100 and 250 pixels on values at a 10, 20, 50, or 100
        let tickSize = this.pickTickSizeFor(x0, x1, plotWidthPx, 99, 251);

        // draw tickmarks
        let x0Tick = this.nextTick(x0, tickSize);

        let ct = 0;

        let labelDivs = [];
        let lineDivs = [];

        while (x0Tick < x1) {
            ct += 1;
            if (ct > 10000) {
                throw new Error("Somehow, we added 10000 ticks? tickSize is " + JSON.stringify(tickSize));
            }

            let pxPosition = plotWidthPx * (x0Tick - x0) / (x1 - x0);


            let lineDiv = h('div', {style:
                    'width:1px;pointer-events:none;position:absolute;top:' + (
                        isFar ? -plotHeightPx : this.axisData.space
                    )
                    + 'px;height:' + plotHeightPx + 'px;left:' + pxPosition + "px;"
                    + 'background-color:' + this.colorToString(
                        this.isZeroTick(x0Tick, tickSize) ? this.axisData.zeroColor : this.axisData.ticklineColor
                    )
            }, [])

            this.axisDiv.appendChild(lineDiv);
            lineDivs.push(lineDiv);

            let labelDiv = h('div', {style:
                'white-space:nowrap;pointer-events:none;position:absolute;left:' + pxPosition + "px;"
                + (
                    isFar ?
                      "top: 0px; transform:translate(-50%,0%);"
                    : "top:" + this.axisData.space + "px;transform:translate(-50%,-100%);"
                )
            }, [this.formatNumber(x0Tick, tickSize)]);

            this.axisDiv.appendChild(labelDiv);
            labelDivs.push(labelDiv);

            x0Tick = this.nextTick(x0Tick, tickSize);
        }

        if (this.axisData.allowExpand) {
            let maxHeight = 0;

            for (let i = 0; i < labelDivs.length; i++) {
                maxHeight = Math.max(maxHeight, labelDivs[i].clientHeight);
            }

            let newHeight = Math.max(maxHeight + 10, this.axisData.space);

            if (newHeight != this.axisData.space) {
                this.axisDiv.style.height = newHeight + "px";

                if (isFar) {
                    // this is the bottom
                    labelDivs.forEach(div => {
                        div.style.top = 0 + "px";
                    });

                    lineDivs.forEach(div => {
                        div.style.top = -plotHeightPx + "px";
                    });
                } else  {
                    labelDivs.forEach(div => {
                        div.style.top = newHeight + "px";
                    });

                    lineDivs.forEach(div => {
                        div.style.top = newHeight + "px";
                    });
                }
            }
        }
    }

    formatNumber(number, tickSize) {
        if (this.axisData.isTimestamp) {
            let ts = moment.unix(number);
            if (tickSize.years) {
                return ts.format('YYYY');
            }
            if (tickSize.months) {
                return ts.format('YYYY-MM');
            }
            if (tickSize.days) {
                return ts.format('YYYY-MM-DD');
            }
            if (tickSize.hours || tickSize.minutes || tickSize.seconds) {
                return ts.format('YYYY-MM-DD HH:mm:ss');
            }

            return ts.format('YYYY-MM-DD HH:mm:ss') + "." + ts.milliseconds().toString().padStart(3, '0')
        } else {
            let digits = Math.max(0, -Math.floor(Math.log10(tickSize)))
            return number.toFixed(digits);
        }
    }

    smallerTickSize(tickSize) {
        let above = Math.pow(10, Math.ceil(Math.log10(tickSize)));

        if (above < tickSize) {
            return above;
        }

        if (above * .5 < tickSize) {
            return above * .5;
        }

        if (above * .2 < tickSize) {
            return above * .2;
        }

        if (above * .1 < tickSize) {
            return above * .1;
        }

        return above * .05;
    }

    largerTickSize(tickSize) {
        let below = Math.pow(10, Math.floor(Math.log10(tickSize)));

        if (below > tickSize) {
            return below;
        }

        if (below * 2 > tickSize) {
            return below * 2;
        }

        if (below * 5 > tickSize) {
            return below * 5;
        }

        if (below * 10 > tickSize) {
            return below * 10;
        }

        return below * 20;
    }

    clearAxis() {
        if (this.which == 'bottom' || this.which == 'top') {
            this.axisDiv.style.height = "0px";
        } else {
            this.axisDiv.style.width = "0px";
        }

        while (this.axisDiv.firstChild) {
            this.axisDiv.removeChild(this.axisDiv.lastChild);
        }

        while (this.legendDiv.firstChild) {
            this.legendDiv.removeChild(this.legendDiv.lastChild);
        }
    }
};

export {AxisRenderer};
