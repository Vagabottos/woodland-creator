
export type Season = "spring" | "summer" | "autumn" | "winter";

export interface ISettings {
  season: Season;
  minConnections: number;
  maxConnections: number;
  maxAttempts: number;
  spawnEyrie: boolean;
  spawnMarquise: boolean;
  spawnWoodland: boolean;
  townNames: boolean;
}
