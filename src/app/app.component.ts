import { Component, OnInit } from "@angular/core";

import * as d3 from "d3";

import { GraphCreator } from "./graph-creator";

@Component({
  selector: "app-root",
  styleUrls: ["./app.component.scss"],
  templateUrl: "app.component.html",
})
export class AppComponent implements OnInit {

  public settings = {
    season: "summer"
  };

  public ngOnInit() {

    const docEl = document.documentElement;
    const bodyEl = document.getElementsByTagName("body")[0];

    const width = window.innerWidth || docEl.clientWidth || bodyEl.clientWidth;
    const height = window.innerHeight || docEl.clientHeight || bodyEl.clientHeight;

    const xLoc = width / 2 - 25;
    const yLoc = 200;

    // initial node data
    const nodes = [
      {title: "Clearing", id: 0, x: xLoc, y: yLoc},
      {title: "Clearing", id: 1, x: xLoc, y: yLoc + 200},
    ];

    const edges = [
      {source: nodes[1], target: nodes[0]},
    ];

    const svg = d3.select(".map-editor").append("svg")
      .attr("width", width)
      .attr("height", height);

    const graph = new GraphCreator(svg);
    graph.loadGraph(nodes, edges);
  }

  public changeSeason(season) {
    this.settings.season = season;
  }

}
