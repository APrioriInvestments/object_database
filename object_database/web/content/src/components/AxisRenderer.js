import {makeDomElt as h} from './Cell';

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

    renderVerticalAxis(isFar) {
        if (this.axisData.label) {
            this.legendDiv.appendChild(
                h('div', {style: 'height:100%;display:flex;flex-direction:column;justify-content:center'}, [
                    h('div', {style: 'text-align:center;min-width:40px;padding-right: 3px'}, [this.axisData.label])
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
        let tickWidthPx = plotHeightPx;
        let tickSize = y1 - y0;

        while (tickWidthPx > 126 || tickWidthPx < 49) {
            let newTickSize = tickWidthPx > 126 ? this.smallerTickSize(tickSize) : this.largerTickSize(tickSize);
            tickWidthPx *= newTickSize / tickSize;
            tickSize = newTickSize;
        }

        // draw tickmarks
        let y0Tick = Math.ceil(y0 / tickSize) * tickSize;

        let ct = 0;

        let labelDivs = [];
        let lineDivs = [];

        while (y0Tick < y1) {
            ct += 1;
            if (ct > 100) {
                throw new Error("Somehow, we added 100 ticks?");
            }

            let pxPosition = plotHeightPx * (y0Tick - y0) / (y1 - y0);

            let lineDiv = h('div', {style:
                'height:1px;position:absolute;left:' + (
                    axisLabelAreaWidth + (isFar ? -plotWidthPx : 0)
                )
                + 'px;width:' + plotWidthPx + 'px;bottom:' + pxPosition + "px;"
                + 'background-color:' + this.colorToString(
                    Math.round(y0Tick / tickSize) == 0.0 ? this.axisData.zeroColor : this.axisData.ticklineColor
                )
            }, []);

            this.axisDiv.appendChild(lineDiv);
            lineDivs.push(lineDiv);

            let labelDiv = h('div', {style:
                    'position:absolute;bottom:' + pxPosition + "px;"
                    + (
                        isFar ?
                          "transform:translate(0%,50%);"
                        : "left:" + (axisLabelAreaWidth - 5) + "px;transform:translate(-100%,50%);"
                    )
            }, [this.formatNumber(Math.round(y0Tick / tickSize) * tickSize, tickSize)]);

            this.axisDiv.appendChild(labelDiv);
            labelDivs.push(labelDiv);

            y0Tick += tickSize;
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
                h('div', {style: 'text-align: center'}, [this.axisData.label])
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
        let tickWidthPx = plotWidthPx;
        let tickSize = x1 - x0;

        while (tickWidthPx > 251 || tickWidthPx < 99) {
            let newTickSize = tickWidthPx > 251 ? this.smallerTickSize(tickSize) : this.largerTickSize(tickSize);
            tickWidthPx *= newTickSize / tickSize;
            tickSize = newTickSize;
        }

        // draw tickmarks
        let x0Tick = Math.ceil(x0 / tickSize) * tickSize;

        let ct = 0;

        let labelDivs = [];
        let lineDivs = [];

        while (x0Tick < x1) {
            ct += 1;
            if (ct > 100) {
                throw new Error("Somehow, we added 100 ticks?");
            }

            let pxPosition = plotWidthPx * (x0Tick - x0) / (x1 - x0);


            let lineDiv = h('div', {style:
                    'width:1px;position:absolute;top:' + (
                        isFar ? -plotHeightPx : this.axisData.space
                    )
                    + 'px;height:' + plotHeightPx + 'px;left:' + pxPosition + "px;"
                    + 'background-color:' + this.colorToString(
                        Math.round(x0Tick / tickSize) == 0.0 ? this.axisData.zeroColor : this.axisData.ticklineColor
                    )
            }, [])

            this.axisDiv.appendChild(lineDiv);
            lineDivs.push(lineDiv);

            let labelDiv = h('div', {style:
                'position:absolute;left:' + pxPosition + "px;"
                + (
                    isFar ?
                      "top: 0px; transform:translate(-50%,0%);"
                    : "top:" + this.axisData.space + "px;transform:translate(-50%,-100%);"
                )
            }, [this.formatNumber(Math.round(x0Tick / tickSize) * tickSize, tickSize)]);

            this.axisDiv.appendChild(labelDiv);
            labelDivs.push(labelDiv);

            x0Tick += tickSize;
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
        let digits = Math.max(0, -Math.floor(Math.log10(tickSize)))
        return number.toFixed(digits);
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
