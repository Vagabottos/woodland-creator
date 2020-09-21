
export type Season = "spring" | "summer" | "autumn" | "winter";

export interface ISettings {
  season: Season;
  minConnections: number;
  maxConnections: number;
  maxAttempts: number;
  townNames: boolean;
}
