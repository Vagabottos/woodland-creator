import { Component, OnInit } from "@angular/core";

import * as d3 from "d3";
import { saveAs } from "file-saver";

import { GraphCreator, IEdge, INode } from "./graph-creator";
import { generateLayout } from "./layout-generator";

@Component({
  selector: "app-root",
  styleUrls: ["./app.component.scss"],
  templateUrl: "app.component.html",
})
export class AppComponent implements OnInit {

  public settings = {
    season: "summer",
  };

  private graph: GraphCreator;

  public ngOnInit() {

    const docEl = document.documentElement;
    const bodyEl = document.getElementsByTagName("body")[0];

    const width = window.innerWidth || docEl.clientWidth || bodyEl.clientWidth;
    const height = window.innerHeight || docEl.clientHeight || bodyEl.clientHeight;

    // initial node data
    const { nodes, edges } = this.generateLayout(width, height);

    const svg = d3.select(".map-editor").append("svg")
      .attr("width", width)
      .attr("height", height);

    this.graph = new GraphCreator(svg);
    this.graph.loadGraph(nodes, edges);
  }

  public generateLayout(width, height): { nodes: INode[], edges: IEdge[] } {
    return generateLayout(width, height);
  }

  public save() {
    const state = {
      map: this.graph.graph,
      settings: this.settings,
      version: 1,
    };

    const blob = new Blob([JSON.stringify(state, null, 4)], { type: "text/plain;charset=utf-8" });
    saveAs(blob, `rootmap-${Date.now()}.json`);
  }

  public load($event) {
    const file = $event.target.files[0];
    if (!file) { return; }

    const reader = new FileReader();

    reader.onloadend = (e) => {
      try {
        const { settings, map } = JSON.parse(reader.result as string);
        this.settings = Object.assign({}, this.settings, settings);

        map.edges = map.edges.map((e) => {
          return {
            source: map.nodes.find((x) => x.id === e.source.id),
            target: map.nodes.find((x) => x.id === e.target.id),
          };
        });

        this.graph.resetGraph();
        this.graph.loadGraph(map.nodes, map.edges);

        $event.target.value = "";

      } catch (e) {
        alert("Could not parse map file.");
      }
    };

    reader.readAsText(file);
  }

  public reset() {
    const shouldReset = confirm("Are you sure you want to reset your current map?");
    if (!shouldReset) { return; }

    this.graph.resetGraph();
  }

  public changeSeason(season) {
    this.settings.season = season;
  }

}
