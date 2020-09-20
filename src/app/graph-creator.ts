
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
      .on("drag", (event, d) => {
        this.state.justDragged = true;
        this.dragMove(event, d);
      })
      .on("end", (event ) => {
        if (this.state.shiftNodeDrag) {
          this.dragEnd(d3.select(event.currentTarget), this.state.mouseEnterNode);
        }
      });
  }

  private initKeybinds() {
    d3.select(window)
      .on("keydown", (event) => {
        this.svgKeyDown(event);
      })
      .on("keyup", (event) => {
        this.svgKeyUp(event);
      });

    this.svg
      .on("mousedown", (event) => {
        this.svgMouseDown();
        if (event.shiftKey) {
          event.stopImmediatePropagation();
        }
      })
      .on("mouseup", (event) => {
        this.svgMouseUp(event);
      });

    const dragSvg = d3.zoom()
        .on("zoom", (event) => {
          if (event.sourceEvent.shiftKey) {
            // TODO  the internal d3 state is still changing
            return false;
          } else {
            this.zoomed(event);
          }
          return true;
        })
        .on("start", (event) => {
          const ael = d3.select("#" + GraphConstants.activeEditId).node();
          if (ael) {
            ael.blur();
          }
          if (!event.sourceEvent.shiftKey) {
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

  private dragMove(event, d) {
    if (this.state.shiftNodeDrag) {
      const [x, y] = d3.pointer(event, this.svgG.node());
      this.dragLine.attr(
        "d",
        "M" + d.x + "," + d.y + "L" + x + "," + y,
      );
    } else {
      d.x += event.dx;
      d.y += event.dy;
      this.updateGraph();
    }
  }

  private deleteGraph() {
    this.nodes = [];
    this.edges = [];
    this.updateGraph();
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

  private pathMouseDown(event, d3path, d) {
    event.stopPropagation();

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

  private circleMouseDown(event, d3node, d) {
    event.stopPropagation();

    this.state.mouseDownNode = d;
    if (event.shiftKey) {
      this.state.shiftNodeDrag = event.shiftKey;

      // reposition dragged directed edge
      this.dragLine.classed("hidden", false)
        .attr("d", "M" + d.x + "," + d.y + "L" + d.x + "," + d.y);
    }
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

  private circleMouseUp(event, d3node, d) {
    // reset the states
    this.state.shiftNodeDrag = false;
    d3node.classed(GraphConstants.connectClass, false);

    if (event.shiftKey) {
      // shift-clicked node: edit text content
      this.renameNode(d);
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

  private svgMouseUp(event) {

    if (this.state.justScaleTransGraph) {
      // dragged not clicked
      this.state.justScaleTransGraph = false;

    } else if (this.state.graphMouseDown && event.shiftKey) {
      // clicked not dragged from svg
      const xycoords = d3.pointer(event, this.svgG.node());
      const d = { id: this.idct++, title: "New Clearing", x: xycoords[0], y: xycoords[1] };
      this.nodes.push(d);
      this.updateGraph();

      this.renameNode(d);

    } else if (this.state.shiftNodeDrag) {
      // dragged from node
      this.state.shiftNodeDrag = false;
      this.dragLine.classed("hidden", true);
    }

    this.state.graphMouseDown = false;
  }

  private svgKeyDown(event) {
    if (this.state.lastKeyDown !== -1) { return; }

    this.state.lastKeyDown = event.keyCode;
    const selectedNode = this.state.selectedNode;
    const selectedEdge = this.state.selectedEdge;

    switch (event.keyCode) {
      case GraphConstants.BACKSPACE_KEY:
      case GraphConstants.DELETE_KEY:
        event.preventDefault();
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

  private svgKeyUp(event) {
    this.state.lastKeyDown = -1;
  }

  private zoomed(event) {
    this.state.justScaleTransGraph = true;
    d3.select("." + GraphConstants.graphClass)
      .attr("transform", event.transform);
  }

  private updateWindow() {
    const docEl = document.documentElement;
    const bodyEl = document.getElementsByTagName("body")[0];
    const x = window.innerWidth || docEl.clientWidth || bodyEl.clientWidth;
    const y = window.innerHeight || docEl.clientHeight || bodyEl.clientHeight;
    this.svg.attr("width", x).attr("height", y);
  }

  private updateGraph() {

    const paths = this.paths.data(this.edges, (d) => String(d.source.id) + "+" + String(d.target.id));

    // update existing paths
    paths
      .classed(GraphConstants.selectedClass, (d) => d === this.state.selectedEdge)
      .attr("d", (d) => "M" + d.source.x + "," + d.source.y + "L" + d.target.x  + "," + d.target.y);

    // remove old links
    paths.exit().remove();

    // add new paths
    const newPaths = paths
      .enter()
      .append("path")
      .classed("link", true)
      .attr("d", (d) => "M" + d.source.x + "," + d.source.y + "L" + d.target.x  + "," + d.target.y)
      .merge(paths)
      .on("mousedown", (event, d) => {
        this.pathMouseDown(event, d3.select(event.currentTarget), d);
      });

    this.paths = newPaths;

    // update existing nodes
    const circles = this.circles.data(this.nodes, (d) => d.id);

    // remove old nodes
    this.svg.selectAll(".conceptG circle").remove();
    this.svg.selectAll(".conceptG text").remove();

    // add new nodes
    const newGs = circles
      .attr("transform", (d) => "translate(" + d.x + "," + d.y + ")")
      .enter()
      .append("g")
      .merge(circles);

    newGs
      .classed(GraphConstants.circleGClass, true)
      .attr("transform", (d) => "translate(" + d.x + "," + d.y + ")")
      .on("mouseover", (event, d) => {
        this.state.mouseEnterNode = d;
        if (this.state.shiftNodeDrag) {
          d3.select(event.currentTarget).classed(GraphConstants.connectClass, true);
        }
      })
      .on("mouseout", (event) => {
        this.state.mouseEnterNode = null;
        d3.select(event.currentTarget).classed(GraphConstants.connectClass, false);
      })
      .on("mousedown", (event, d) => {
        this.circleMouseDown(event, d3.select(event.currentTarget), d);
      })
      .call(this.drag)
      .on("click", (event, d) => {
        this.circleMouseUp(event, d3.select(event.currentTarget), d);
      })
      .each((d, i, nodes) => {
        d3.select(nodes[i])
          .append("circle")
          .attr("r", String(GraphConstants.nodeRadius));

        this.insertTitleLinebreaks(d3.select(nodes[i]), d.title);
      });

    this.circles = newGs;
  }

  private renameNode(d) {
    const newName = prompt("What would you like to name this clearing?");
    if (!newName) { return; }

    d.title = newName;
    this.updateGraph();
  }

}
