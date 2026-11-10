import { OreId, ZoneId } from './config';

export type OreAmounts = Record<OreId, number>;
export type OreFlags = Record<OreId, boolean>;

export interface AsteroidState {
  /** Seed for the asteroid's drawn shape. */
  shapeSeed: number;
  mass: number;
  maxMass: number;
  /** Fraction of each ore; sums to 1. */
  composition: OreAmounts;
  rich: boolean;
  zone: ZoneId;
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
  ingotsRefined: number;
  researchCompleted: number;
}

export interface SectorInfo {
  code: string;
  name: string;
  star: string;
  depth: number;
}

export interface ResearchJob {
  id: string;
  /** The level this job will reach when it finishes. */
  level: number;
  remaining: number;
  duration: number;
  /** What was paid, so cancelling can refund it. */
  paidSd: number;
  paidCr: number;
}

export interface RefinerySlot {
  /** Ore this slot is set to refine (null = unassigned). */
  ore: OreId | null;
  /** Ore currently in the furnace (0 = idle or waiting for ore). */
  batch: number;
  remaining: number;
  duration: number;
  /** Restart automatically when a batch finishes (needs Auto-Refine). */
  repeat: boolean;
}

export interface GameState {
  version: 2;
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
  ingots: OreAmounts;
  cargoLevel: number;

  drill: DrillState;
  drones: { prospector: number };
  asteroid: AsteroidState;
  sector: SectorInfo;
  zone: ZoneId;

  research: {
    levels: Record<string, number>;
    active: ResearchJob[];
  };
  refinery: { slots: RefinerySlot[] };
  autoSell: { ore: OreFlags; ingot: OreFlags; smart: boolean };

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
  surveyData: number;
}

export interface ResearchDone {
  id: string;
  level: number;
  eureka: boolean;
}

/** Things that happened during a tick that the UI may want to announce. */
export interface TickEvents {
  research: ResearchDone[];
  ingots: OreAmounts;
  autoSoldCredits: number;
}

export interface OfflineReport {
  seconds: number;
  cappedSeconds: number;
  efficiency: number;
  gained: OreAmounts;
  ingots: OreAmounts;
  credits: number;
  research: ResearchDone[];
  lost: number;
  cargoFull: boolean;
}
