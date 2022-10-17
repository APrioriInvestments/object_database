
class CellsTree extends Object {
    constructor(data) {
        super();

        this.data = data;

        // basic view settings
        // TODO: maybe these should be passed as params to the constructor
        this.duration = 750;
        this.rectW = 60;
        this.rectH=30;

        // bound methods
        this.setupTree = this.setupTree.bind(this);
        this.update = this.update.bind(this);
        this.collapse = this.collapse.bind(this);
        this.redraw = this.redraw.bind(this);
        this.onDblclick = this.onDblclick.bind(this);
        this.onClick = this.onClick.bind(this);
        this.onMouseover = this.onMouseover.bind(this);
        this.onMouseleave = this.onMouseleave.bind(this);
    }

    setupTree(){
        this.tree = d3.layout.tree().nodeSize([70, 40]);
        const zm = d3.behavior.zoom()
            .scaleExtent([1,3])
            .on("zoom", this.redraw)
        // the main svg container for the tree
        this.svg = d3.select("#main").append("svg")
            .attr("width", "100%")
            .attr("height", 1000)
            .call(zm)
            .append("g")
            .attr(
                "transform",
                `translate(${350},${20})`
            );
        //necessary so that zoom knows where to zoom and unzoom from
        zm.translate([350, 20]);
 
        this.data.x0 = 0;
        this.data.y0 = 700 / 2;

        // collapse all children for now
        // TODO do we want this?
        this.data.children.forEach(this.collapse);

        // build the tree
        this.update(this.data);
    }

    update(source) {
        // need to define these in method scope since a number of the
        // callbacks are not bound to the class. TODO
        let id = 0;
        const rectW = this.rectW;
        const rectH = this.rectH;

        const diagonal = d3.svg.diagonal()
            .projection(function (d) {
                return [d.x + rectW / 2, d.y + rectH / 2];
            });
        // Compute the new tree layout.
        const nodes = this.tree.nodes(this.data).reverse();
        const links = this.tree.links(nodes);

        // Normalize for fixed-depth.
        nodes.forEach(function (d) {
            d.y = d.depth * 180;
        });

        // Update the nodes…
        const node = this.svg.selectAll("g.node")
            .data(nodes, function (d) {
                return d.id = ++id;
            }
        );

        // Enter any new nodes at the parent's previous position.
        const nodeEnter = node.enter().append("g")
            .attr("class", "node")
            .attr("transform", function (d) {
                return `translate(${source.x0},${source.y0})`;
            })
            .on("dblclick", this.onDblclick)
            .on("click", this.onClick)
            .on("mouseover", this.onMouseover)
            .on("mouseleave", this.onMouseleave);


        nodeEnter.append("rect")
            .attr("width", this.rectW)
            .attr("height", this.rectH)
            .attr("stroke", "black")
            .attr("stroke-width", 1)
            .style("fill", function (d) {
                return d._children ? "lightsteelblue" : "#fff";
            }
        );

        nodeEnter.append("text")
            .attr("x", this.rectW / 2)
            .attr("y", this.rectH / 2)
            .attr("dy", ".35em")
            .attr("text-anchor", "middle")
            .text(function (d) {
                return d.name;
            }
        );

        // Transition nodes to their new position.
        const nodeUpdate = node.transition()
            .duration(this.duration)
            .attr("transform", function (d) {
                return `translate(${d.x},${d.y})`;
            }
        );

        nodeUpdate.select("rect")
            .attr("width", this.rectW)
            .attr("height", this.rectH)
            .attr("stroke", "black")
            .attr("stroke-width", 1)
            .style("fill", function (d) {
                return d._children ? "lightsteelblue" : "#fff";
            }
        );

        nodeUpdate.select("text")
            .style("fill-opacity", 1);

        // Transition exiting nodes to the parent's new position.
        const nodeExit = node.exit().transition()
            .duration(this.duration)
            .attr("transform", function (d) {
                return `translate(${source.x},${source.y})`;
            }
        ).remove();

        nodeExit.select("rect")
            .attr("width", this.rectW)
            .attr("height", this.rectH)
            .attr("stroke", "black")
            .attr("stroke-width", 1);

        nodeExit.select("text");

        // Update the links…
        const link = this.svg.selectAll("path.link")
            .data(links, function (d) {
                return d.target.id;
            }
        );

        // Enter any new links at the parent's previous position.
        link.enter().insert("path", "g")
            .attr("class", "link")
            .attr("x", this.rectW / 2)
            .attr("y", this.rectH / 2)
            .attr("d", function (d) {
            const o = {
                x: source.x0,
                y: source.y0
            };
            return diagonal({
                source: o,
                target: o
            });
        });

        // Transition links to their new position.
        link.transition()
            .duration(this.duration)
            .attr("d", diagonal);

        // Transition exiting nodes to the parent's new position.
        link.exit().transition()
            .duration(this.duration)
            .attr("d", function (d) {
            const o = {
                x: source.x,
                y: source.y
            };
            return diagonal({
                source: o,
                target: o
            });
        })
            .remove();

        // Stash the old positions for transition.
        nodes.forEach(function (d) {
            d.x0 = d.x;
            d.y0 = d.y;
        });
    }

    collapse(d) {
        if (d.children) {
            d._children = d.children.slice();
            d._children.forEach(this.collapse);
            d.children = null;
        }
    }


    // Toggle children on click.
    onDblclick(d) {
        // prevent the default zooming in/out behavior
        d3.event.stopPropagation();
        if (d.children) {
            d._children = d.children.slice();
            d.children = null;
        } else {
            d.children = d._children.slice();
            d._children = null;
        }
        this.update(d);
    }

    onClick(event){
        // update the cell data
        // probably should be handled by a different class
        const infoDiv = document.getElementById("cell-info")
        infoDiv.textContent = `${event.name} (id: ${event.identity})`;
    }

    onMouseover(event){
        // highlighte the corresponding element in the target window
        chrome.devtools.inspectedWindow.eval(
            `document.querySelector("[data-cell-id='${event.identity}']").classList.add('devtools-inspect')'`
        );
    }

    onMouseleave(event){
        console.log(event);
        // highlighte the corresponding element in the target window
        chrome.devtools.inspectedWindow.eval(
            `document.querySelector("[data-cell-id='${event.identity}']").classList.remove('devtools-inspect')'`
        );
    }
    //Redraw for zoom
    redraw() {
        this.svg.attr("transform",
                      `translate(${d3.event.translate})`
                      +`scale(${d3.event.scale})`
                     );
    }
}


export {
    CellsTree,
    CellsTree as default
}
