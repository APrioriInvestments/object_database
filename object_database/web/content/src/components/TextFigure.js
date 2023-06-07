import {makeDomElt as h} from './Cell';


class TextFigure {
    constructor(
        xs,
        ys,
        label,
        color,
        offsets,
        fractionPositions,
        sizes,
        textDiv
    ) {
        this.xs = xs;
        this.ys = ys;
        this.label = label;
        this.color = color;
        this.offsets = offsets;
        this.fractionPositions = fractionPositions;
        this.sizes = sizes;
        this.textDiv = textDiv;

        this.clear = this.clear.bind(this);
        this.drawSelf = this.drawSelf.bind(this);

        if (!(xs instanceof Float64Array)) {
            throw new Error("xs must be a Float64Array");
        }

        if (!(ys instanceof Float64Array)) {
            throw new Error("ys must be a Float64Array");
        }

        if (!(offsets instanceof Float64Array)) {
            throw new Error("offsets must be a Float64Array");
        }

        if (!(fractionPositions instanceof Float64Array)) {
            throw new Error("fractionPositions must be a Float64Array");
        }

        if (!(sizes instanceof Float64Array)) {
            throw new Error("sizes must be a Float64Array");
        }

        if (xs.length != ys.length) {
            throw new Error("xs and ys must have same length");
        }

        if (xs.length != ys.length) {
            throw new Error("xs and ys must have same length");
        }

        if (xs.length != label.length) {
            throw new Error("xs and label must have same length");
        }

        if (xs.length * 2 != fractionPositions.length) {
            throw new Error("xs and pairs in fractionPositions must have same number of elements");
        }

        if (xs.length * 2 != offsets.length) {
            throw new Error("xs and pairs in offsets must have same number of elements");
        }

        if (!(color instanceof Float64Array)) {
            throw new Error("color must be a Float64Array");
        }

        if (color.length != this.xs.length * 4) {
            throw new Error("color must have 4 elements per point");
        }
    }

    clear(renderer) {
        // nothing to do
    }

    drawSelf(renderer) {
        for (let i = 0; i < this.xs.length; i++) {
            let style = [];
            let x = (this.xs[i] - renderer.screenPosition[0]) / renderer.screenSize[0] * renderer.width;
            let y = (1.0 - (this.ys[i] - renderer.screenPosition[1]) / renderer.screenSize[1]) * renderer.height;

            x += this.offsets[i * 2];
            y -= this.offsets[i * 2 + 1];

            let c = this.color.slice(i*4, i*4+4);

            let xTransform = (this.fractionPositions[i*2] * -100 + "%");
            let yTransform = ( ((-1.0 + this.fractionPositions[i*2 + 1]) * 100) + "%");

            style.push('position:absolute');
            style.push('white-space:nowrap');
            style.push('top:' + y + "px");
            style.push('left:' + x + "px");
            style.push('font-size:' + this.sizes[i] + "px");
            style.push('transform:translate(' + xTransform + ',' + yTransform + ')');
            style.push(`color:rgba(${c[0]*255},${c[1]*255},${c[2]*255},${c[3]})`);

            this.textDiv.appendChild(
                h('div', {
                    'style': style.join(';')
                }, [this.label[i]])
            )
        }
    }
}

export {TextFigure};
