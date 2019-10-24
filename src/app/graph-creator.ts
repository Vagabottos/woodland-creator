
import * as d3 from "d3";

/*
Controls:
- drag/scroll to pan/zoom
- shift click to create a node
- shift click and drag from a node to another node to make a link
- shift click a node to change its title
- click a node or edge then hit backspace to remove
*/

export interface INode {
  title: string;
  id: number;
  x: number;
  y: number;
}

export interface IEdge {
  source: INode;
  target: INode;
}

class GraphConstants {
  public static selectedClass = "selected";
  public static connectClass = "connect-node";
  public static circleGClass = "conceptG";
  public static graphClass = "graph";
  public static activeEditId = "active-editing";
  public static BACKSPACE_KEY = 8;
  public static DELETE_KEY = 46;
  public static ENTER_KEY = 13;
  public static nodeRadius = 50;
}

class GraphState {
  public selectedNode = null;
  public selectedEdge = null;
  public mouseDownNode = null;
  public mouseEnterNode = null;
  public mouseDownLink = null;
  public justDragged = null;
  public justScaleTransGraph = false;
  public lastKeyDown = -1;
  public shiftNodeDrag = false;
  public selectedText = false;
  public graphMouseDown = false;
}

export class GraphCreator {

  private idct = 0;
  private state: GraphState = new GraphState();

  private svgG;
  private dragLine;
  private paths;
  private circles;

  private drag: d3.drag;

  public get graph() {
    return { nodes: this.nodes, edges: this.edges };
  }

  constructor(private svg, private nodes: INode[] = [], private edges: IEdge[] = []) {
    this.init();
  }

  public loadGraph(nodes: INode[], edges: IEdge[]) {
    this.nodes = nodes;
    this.edges = edges;

    this.setIdCt(Math.max(...nodes.map((x) => x.id)) + 1);
    this.updateGraph();
  }

  public resetGraph() {
    this.deleteGraph();
  }

  private init() {
    this.initDefs();
    this.initG();
    this.initDrag();
    this.initKeybinds();
  }

  private initDefs() {
    const defs = this.svg.append("svg:defs");
    defs.append("svg:marker")
      .attr("id", "end-arrow")
      .attr("viewBox", "0 -5 10 10")
      .attr("refX", "32")
      .attr("markerWidth", 3.5)
      .attr("markerHeight", 3.5)
      .attr("orient", "auto")
      .append("svg:path")
      .attr("d", "M0,-5L10,0L0,5");

    // define arrow markers for leading arrow
    defs.append("svg:marker")
      .attr("id", "mark-end-arrow")
      .attr("viewBox", "0 -5 10 10")
      .attr("refX", 7)
      .attr("markerWidth", 3.5)
      .attr("markerHeight", 3.5)
      .attr("orient", "auto")
      .append("svg:path")
      .attr("d", "M0,-5L10,0L0,5");
  }

  private initG() {
    this.svgG = this.svg.append("g")
      .classed(GraphConstants.graphClass, true);

    this.dragLine = this.svgG.append("svg:path")
      .attr("class", "link dragline hidden")
      .attr("d", "M0,0L0,0");

    this.paths = this.svgG.append("g").selectAll("g");
    this.circles = this.svgG.append("g").selectAll("g");
  }

  private initDrag() {
    this.drag = d3.drag()
      .subject((d) => {
        return { x: d.x, y: d.y };
      })
      .on("drag", (d) => {
        this.state.justDragged = true;
        this.dragMove(d);
      })
      .on("end", (d, i, nodes) => {
        if (this.state.shiftNodeDrag) {
          this.dragEnd(d3.select(nodes[i]), this.state.mouseEnterNode);
        }
      });
  }

  private initKeybinds() {
    d3.select(window)
      .on("keydown", () => {
        this.svgKeyDown();
      })
      .on("keyup", () => {
        this.svgKeyUp();
      });

    this.svg
      .on("mousedown", () => {
        this.svgMouseDown();
        if (d3.event.shiftKey) {
          d3.event.stopImmediatePropagation();
        }
      })
      .on("mouseup", () => {
        this.svgMouseUp();
      });

    const dragSvg = d3.zoom()
        .on("zoom", () => {
          if (d3.event.sourceEvent.shiftKey) {
            // TODO  the internal d3 state is still changing
            return false;
          } else {
            this.zoomed();
          }
          return true;
        })
        .on("start", () => {
          const ael = d3.select("#" + GraphConstants.activeEditId).node();
          if (ael) {
            ael.blur();
          }
          if (!d3.event.sourceEvent.shiftKey) {
            d3.select("body").style("cursor", "move");
          }
        })
        .on("end", () => {
            d3.select("body").style("cursor", "auto");
        });

    this.svg.call(dragSvg).on("dblclick.zoom", null);

      // listen for resize
    window.onresize = () => {
        this.updateWindow();
      };
  }

  private setIdCt(idct) {
    this.idct = idct;
  }

  private dragMove(d) {
    if (this.state.shiftNodeDrag) {
      this.dragLine.attr(
        "d",
        "M" + d.x + "," + d.y + "L" + d3.mouse(this.svgG.node())[0] + "," + d3.mouse(this.svgG.node())[1],
      );
    } else {
      d.x += d3.event.dx;
      d.y += d3.event.dy;
      this.updateGraph();
    }
  }

  private deleteGraph() {
    this.nodes = [];
    this.edges = [];
    this.updateGraph();
  }

  private selectElementContents(el) {
    const range = document.createRange();
    range.selectNodeContents(el);

    const sel = window.getSelection();
    sel.removeAllRanges();
    sel.addRange(range);
  }

  private insertTitleLinebreaks(gEl, title = "") {
    const words = title.split(/\s+/g);
    const nwords = words.length;
    const el = gEl.append("text")
      .attr("text-anchor", "middle")
      .attr("dy", "-" + (nwords - 1) * 7.5);

    for (let i = 0; i < words.length; i++) {
      const tspan = el.append("tspan").text(words[i]);
      if (i > 0) {
        tspan.attr("x", 0).attr("dy", "15");
      }
    }
  }

  private spliceLinksForNode(node) {
    const toSplice = this.edges.filter((l) => {
      return (l.source === node || l.target === node);
    });

    toSplice.forEach((l) => {
      this.edges.splice(this.edges.indexOf(l), 1);
    });
  }

  private replaceSelectEdge(d3Path, edgeData) {
    d3Path.classed(GraphConstants.selectedClass, true);
    if (this.state.selectedEdge) {
      this.removeSelectFromEdge();
    }
    this.state.selectedEdge = edgeData;
  }

  private removeSelectFromEdge() {
    this.paths
      .filter((cd) => cd === this.state.selectedEdge)
      .classed(GraphConstants.selectedClass, false);
    this.state.selectedEdge = null;
  }

  private replaceSelectNode(d3Node, nodeData) {
    d3Node.classed(GraphConstants.selectedClass, true);
    if (this.state.selectedNode) {
      this.removeSelectFromNode();
    }
    this.state.selectedNode = nodeData;
  }

  private removeSelectFromNode() {
    this.circles
      .filter((cd) => cd.id === this.state.selectedNode.id)
      .classed(GraphConstants.selectedClass, false);

    this.state.selectedNode = null;
  }

  private pathMouseDown(d3path, d) {
    d3.event.stopPropagation();

    this.state.mouseDownLink = d;

    if (this.state.selectedNode) {
      this.removeSelectFromNode();
    }

    const prevEdge = this.state.selectedEdge;
    if (!prevEdge || prevEdge !== d) {
      this.replaceSelectEdge(d3path, d);
    } else {
      this.removeSelectFromEdge();
    }
  }

  private circleMouseDown(d3node, d) {
    d3.event.stopPropagation();

    this.state.mouseDownNode = d;
    if (d3.event.shiftKey) {
      this.state.shiftNodeDrag = d3.event.shiftKey;

      // reposition dragged directed edge
      this.dragLine.classed("hidden", false)
        .attr("d", "M" + d.x + "," + d.y + "L" + d.x + "," + d.y);
    }
  }

  private changeTextOfNode(d3node, d) {

    const htmlEl = d3node.node();
    d3node.selectAll("text").remove();

    const nodeBCR = htmlEl.getBoundingClientRect();
    const curScale = nodeBCR.width / GraphConstants.nodeRadius;
    const placePad = 5 * curScale;
    const useHW = curScale > 1 ? nodeBCR.width * 0.71 : GraphConstants.nodeRadius * 1.42;

    const d3txt = this.svg.selectAll("foreignObject")
      .data([d])
      .enter()
        .append("foreignObject")
          .attr("x", nodeBCR.left + placePad)
          .attr("y", nodeBCR.top + placePad)
          .attr("height", 2 * useHW)
          .attr("width", useHW)
          .append("xhtml:p")
            .attr("id", GraphConstants.activeEditId)
            .attr("contentEditable", "true")
            .text(d.title)
            .on("mousedown", () => {
              d3.event.stopPropagation();
            })
            .on("keydown", (_, i, nodes) => {
              d3.event.stopPropagation();
              if (d3.event.keyCode === GraphConstants.ENTER_KEY && !d3.event.shiftKey) {
                d3.select(nodes[i]).blur();
              }
            })
            .on("blur", (_, i, nodes) => {
              d.title = document.getElementById("active-editing").textContent;
              this.insertTitleLinebreaks(d3node, d.title);
              d3.select(nodes[i].parentElement).remove();
            });

    return d3txt;
  }

  private dragEnd(d3node, d) {

    // reset the states
    this.state.shiftNodeDrag = false;
    d3node.classed(GraphConstants.connectClass, false);

    const mouseDownNode = this.state.mouseDownNode;
    const mouseEnterNode = this.state.mouseEnterNode;

    if (this.state.justDragged) {
      // dragged, not clicked
      this.state.justDragged = false;
    }

    this.dragLine.classed("hidden", true);

    if (!mouseDownNode || !mouseEnterNode) { return; }

    if (mouseDownNode !== d) {
      // we're in a different node: create new edge for mousedown edge and add to graph
      const newEdge = { source: mouseDownNode, target: d };
      const filtRes = this.paths.filter((dd) => {
        if (dd.source === newEdge.target && dd.target === newEdge.source) {
          this.edges.splice(this.edges.indexOf(dd), 1);
        }

        return d.source === newEdge.source && d.target === newEdge.target;
      });

      if (!filtRes || !filtRes[0] || !filtRes[0].length) {
        this.edges.push(newEdge);
        this.updateGraph();
      }
    }

    this.state.mouseDownNode = null;
    this.state.mouseEnterNode = null;
  }

  private circleMouseUp(d3node, d) {
    // reset the states
    this.state.shiftNodeDrag = false;
    d3node.classed(GraphConstants.connectClass, false);

    if (d3.event.shiftKey) {
      // shift-clicked node: edit text content
      const d3txt = this.changeTextOfNode(d3node, d);
      const txtNode = d3txt.node();
      this.selectElementContents(txtNode);
      txtNode.focus();
    } else {
      if (this.state.selectedEdge) {
        this.removeSelectFromEdge();
      }
    }

    const prevNode = this.state.selectedNode;
    if (!prevNode || prevNode.id !== d.id) {
      this.replaceSelectNode(d3node, d);
    } else {
      this.removeSelectFromNode();
    }
  }

  private svgMouseDown() {
    this.state.graphMouseDown = true;
  }

  private svgMouseUp() {

    if (this.state.justScaleTransGraph) {
      // dragged not clicked
      this.state.justScaleTransGraph = false;

    } else if (this.state.graphMouseDown && d3.event.shiftKey) {
      // clicked not dragged from svg
      const xycoords = d3.mouse(this.svgG.node());
      const d = { id: this.idct++, title: "Clearing", x: xycoords[0], y: xycoords[1] };
      this.nodes.push(d);
      this.updateGraph();
      // make title of text immediently editable
      const d3txt = this.changeTextOfNode(this.circles.filter((dval) => dval.id === d.id), d);

      const txtNode = d3txt.node();
      this.selectElementContents(txtNode);
      txtNode.focus();

    } else if (this.state.shiftNodeDrag) {
      // dragged from node
      this.state.shiftNodeDrag = false;
      this.dragLine.classed("hidden", true);
    }

    this.state.graphMouseDown = false;
  }

  private svgKeyDown() {
    if (this.state.lastKeyDown !== -1) { return; }

    this.state.lastKeyDown = d3.event.keyCode;
    const selectedNode = this.state.selectedNode;
    const selectedEdge = this.state.selectedEdge;

    switch (d3.event.keyCode) {
      case GraphConstants.BACKSPACE_KEY:
      case GraphConstants.DELETE_KEY:
        d3.event.preventDefault();
        if (selectedNode) {
          this.nodes.splice(this.nodes.indexOf(selectedNode), 1);
          this.spliceLinksForNode(selectedNode);
          this.state.selectedNode = null;
          this.updateGraph();
        } else if (selectedEdge) {
          this.edges.splice(this.edges.indexOf(selectedEdge), 1);
          this.state.selectedEdge = null;
          this.updateGraph();
        }
        break;
    }
  }

  private svgKeyUp() {
    this.state.lastKeyDown = -1;
  }

  private zoomed() {
    this.state.justScaleTransGraph = true;
    d3.select("." + GraphConstants.graphClass)
      .attr("transform", d3.event.transform);
  }

  private updateWindow() {
    const docEl = document.documentElement;
    const bodyEl = document.getElementsByTagName("body")[0];
    const x = window.innerWidth || docEl.clientWidth || bodyEl.clientWidth;
    const y = window.innerHeight || docEl.clientHeight || bodyEl.clientHeight;
    this.svg.attr("width", x).attr("height", y);
  }

  private updateGraph() {

    this.paths = this.paths.data(this.edges, (d) => {
      return String(d.source.id) + "+" + String(d.target.id);
    });

    let paths = this.paths;

    // update existing paths
    paths
      .classed(GraphConstants.selectedClass, (d) => {
        return d === this.state.selectedEdge;
      })
      .attr("d", (d) => {
        return "M" + d.source.x + "," + d.source.y + "L" + d.target.x  + "," + d.target.y;
      });

    // remove old links
    paths.exit().remove();

    // add new paths
    paths = paths.enter()
      .append("path")
      .classed("link", true)
      .attr("d", (d) => {
          return "M" + d.source.x + "," + d.source.y + "L" + d.target.x  + "," + d.target.y;
      })
      .merge(paths)
      .on("mousedown", (d, i, nodes) => {
        this.pathMouseDown(d3.select(nodes[i]), d);
      });

    this.paths = paths;

    // update existing nodes
    this.circles = this.circles.data(this.nodes, (d) => d.id);

    // remove old nodes
    this.circles.exit().remove();

    this.circles.attr("transform", (d) => "translate(" + d.x + "," + d.y + ")");

    // add new nodes
    const newGs = this.circles.enter()
      .append("g").merge(this.circles);

    newGs.classed(GraphConstants.circleGClass, true)
      .attr("transform", (d) => {
          return "translate(" + d.x + "," + d.y + ")";
      })
      .on("mouseover", (d, i, nodes) => {
        this.state.mouseEnterNode = d;
        if (this.state.shiftNodeDrag) {
            d3.select(nodes[i]).classed(GraphConstants.connectClass, true);
        }
      })
      .on("mouseout", (d, i, nodes) => {
        this.state.mouseEnterNode = null;
        d3.select(nodes[i]).classed(GraphConstants.connectClass, false);
      })
      .on("mousedown", (d, i, nodes) => {
        this.circleMouseDown(d3.select(nodes[i]), d);
      })
      .call(this.drag)
      .on("click", (d, i, nodes) => {
        this.circleMouseUp(d3.select(nodes[i]), d);
      });

    this.circles = newGs;

    newGs.each((d, i, nodes) => {
      d3.select(nodes[i])
        .append("circle")
        .attr("r", String(GraphConstants.nodeRadius));

      this.insertTitleLinebreaks(d3.select(nodes[i]), d.title);
    });
  }

}
