import { Component, OnInit } from "@angular/core";

import * as d3 from "d3";
import { saveAs } from "file-saver";
import { clamp } from "lodash";

import { GraphCreator } from "./graph-creator";
import { ISettings, Season } from "./interfaces";
import { generateLayout } from "./layout-generator";

const DEFAULT_SETTINGS = {
  maxAttempts: 100,
  maxConnections: 3,
  minConnections: 2,
  season: "summer" as Season,
  townNames: true,
};

@Component({
  selector: "app-root",
  styleUrls: ["./app.component.scss"],
  templateUrl: "app.component.html",
})
export class AppComponent implements OnInit {

  public settings: ISettings = Object.assign({}, DEFAULT_SETTINGS);

  public error: string;

  private graph: GraphCreator;

  public ngOnInit() {
    this.loadSettings();
    this.randomize();
  }

  public save() {

    const state = {
      map: this.graph.graph,
      settings: this.settings,
      size: this.getWidthHeightOfScreen(),
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
        const { settings, map, size } = JSON.parse(reader.result as string);
        this.settings = Object.assign({}, this.settings, settings);

        map.edges = map.edges.map((e) => {
          return {
            source: map.nodes.find((x) => x.id === e.source.id),
            target: map.nodes.find((x) => x.id === e.target.id),
          };
        });

        const mySize = this.getWidthHeightOfScreen();

        const xProp = mySize.width / size.width;
        const yProp = mySize.height / size.height;

        map.nodes.forEach((node) => {
          node.x *= xProp;
          node.y *= yProp;
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

  public changeSeason(season: Season) {
    this.settings.season = season;
    this.saveSettings();
  }

  public changeMinConnections(mod: number) {
    this.settings.minConnections = clamp(1, this.settings.minConnections + mod, this.settings.maxConnections);
    this.saveSettings();
  }

  public changeMaxConnections(mod: number) {
    this.settings.maxConnections = clamp(this.settings.minConnections, this.settings.maxConnections + mod, 5);
    this.saveSettings();
  }

  public loadSettings() {
    try {
      this.settings = JSON.parse(localStorage.getItem("settings")) || Object.assign({}, DEFAULT_SETTINGS);
    } catch {
      this.settings = Object.assign({}, DEFAULT_SETTINGS);
    }
  }

  public saveSettings() {
    localStorage.setItem("settings", JSON.stringify(this.settings));
  }

  public getWidthHeightOfScreen() {
    const docEl = document.documentElement;
    const bodyEl = document.getElementsByTagName("body")[0];

    const width = window.innerWidth || docEl.clientWidth || bodyEl.clientWidth;
    const height = window.innerHeight || docEl.clientHeight || bodyEl.clientHeight;

    return { width, height };
  }

  public randomize() {

    document.querySelectorAll("svg").forEach((svg) => svg.remove());

    const { width, height } = this.getWidthHeightOfScreen();

    // initial node data
    const { nodes, edges, error } = generateLayout(width, height, this.settings);

    this.error = error;

    const svg = d3.select(".map-editor").append("svg")
      .attr("width", width)
      .attr("height", height);

    this.graph = new GraphCreator(svg);
    this.graph.loadGraph(nodes, edges);
  }

}
