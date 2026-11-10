import { OreId } from './config';

export type OreAmounts = Record<OreId, number>;

export interface AsteroidState {
  /** Seed for the asteroid's drawn shape. */
  shapeSeed: number;
  mass: number;
  maxMass: number;
  /** Fraction of each ore; sums to 1. */
  composition: OreAmounts;
  rich: boolean;
}

export interface DrillState {
  powerLevel: number;
  tier: number;
  heat: number;
  /** Seconds left in an overheat lockout. */
  lockRemaining: number;
  heatSinkLevel: number;
}

export interface GameStats {
  clicks: number;
  oreMined: number;
  oreLost: number;
  asteroidsCracked: number;
  overdriveClicks: number;
  overheats: number;
  creditsEarned: number;
}

export interface SectorInfo {
  code: string;
  name: string;
  star: string;
  depth: number;
}

export interface GameState {
  version: 1;
  commander: string;
  ship: string;
  createdAt: number;
  /** Wall-clock time of the last save/tick, used for offline progress. */
  lastSeen: number;
  playtimeSec: number;
  /** Game clock driving market prices (only advances while simulated). */
  marketClock: number;
  rng: number;

  credits: number;
  dataCores: number;
  surveyData: number;
  cargo: OreAmounts;
  cargoLevel: number;

  drill: DrillState;
  drones: { prospector: number };
  asteroid: AsteroidState;
  sector: SectorInfo;

  stats: GameStats;
  /** One-time tutorial / story flags. */
  flags: Record<string, boolean>;
}

export interface ClickResult {
  locked: boolean;
  overheated: boolean;
  overdrive: boolean;
  gained: OreAmounts;
  slag: number;
  lost: number;
  cracked: boolean;
  dataCore: boolean;
}

export interface OfflineReport {
  seconds: number;
  cappedSeconds: number;
  gained: OreAmounts;
  lost: number;
  cargoFull: boolean;
}
