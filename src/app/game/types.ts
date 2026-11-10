import { OreId, ZoneId } from './config';
import { BackgroundId, PostId, StatId } from './crew-data';
import { DroneType, FrameId, SlotId } from './fleet-data';
import { EventKind, StandingOrders } from './threat-data';

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
  mechOre: number;
  mechsBuilt: number;
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

export type MechJob = 'idle' | 'mining' | 'repair' | 'defense';

export interface MechState {
  id: number;
  name: string;
  designation: string;
  frame: FrameId;
  parts: Partial<Record<SlotId, string>>;
  armor: number;
  job: MechJob;
  /** Job to go back to after an automatic repair. */
  returnJob: MechJob | null;
  zone: ZoneId;
  pilotId: number | null;
  /** Special Technique: seconds of boost left, and cooldown left. */
  boostRemaining: number;
  cooldown: number;
}

export interface PilotState {
  id: number;
  name: string;
  callsign: string;
  background: BackgroundId;
  /** Story pilot key (juno, kit…) or null for generated pilots. */
  story: string | null;
  portraitSeed: number;
  /** Stats at level 1; growth is applied from the background. */
  baseStats: Record<StatId, number>;
  traits: string[];
  level: number;
  xp: number;
  /** Seconds spent piloting each frame type. */
  sync: Record<FrameId, number>;
  /** Two traits to choose from after a milestone level, or null. */
  traitChoice: string[] | null;
  /** Seconds until recovered from injury (Milestone 4 damage). */
  injuredRemaining: number;
}

export interface ActiveEvent {
  id: number;
  kind: EventKind;
  /** 'warning' counts down to impact; 'active' counts down the effect's duration. */
  phase: 'warning' | 'active';
  remaining: number;
  /** Market events: the affected ore. */
  ore?: OreId;
  /** Raids: enemy strength and whether the Jackal leads them. */
  strength?: number;
  jackal?: boolean;
  /** Rogue asteroids: HP left and total. */
  rogueHp?: number;
  rogueMax?: number;
  /** Flares: how the player chose to respond (else the standing order). */
  response?: string;
  /** Micrometeor storms: fractional drone losses carried between ticks. */
  acc?: number;
}

export interface SortieRound {
  playerDamage: number;
  enemyDamage: number;
  enemyHpFrac: number;
  lines: string[];
  /** Pilot who used a Special Technique this round. */
  technique?: { pilotId: number; name: string };
}

export interface SortieReport {
  id: number;
  title: string;
  enemy: string;
  units: { name: string; count: number }[];
  jackal: boolean;
  strike: boolean;
  mechIds: number[];
  guardians: number;
  rounds: SortieRound[];
  outcome: 'victory' | 'costly' | 'defeat' | 'surrender';
  rewards: string[];
  losses: string[];
}

export interface ThreatLogEntry {
  at: number;
  kind: EventKind | 'strike';
  text: string;
  good: boolean;
}

export interface ThreatState {
  events: ActiveEvent[];
  /** Seconds until the next event roll. */
  nextIn: number;
  /** Game seconds elapsed (including offline), for the grace period. */
  clock: number;
  heat: number;
  orders: StandingOrders;
  log: ThreatLogEntry[];
  raids: number;
  raidsWon: number;
  raidsLost: number;
  winsSinceBase: number;
  baseFound: boolean;
  strikesWon: number;
  jackalEncounters: number;
  jackalDefeats: number;
  raidsSinceJackal: number;
  lastSortie: SortieReport | null;
  /** Fractional wreck recovery by Salvagers carried between ticks. */
  salvageAcc: number;
  nextEventId: number;
}

export interface GameState {
  version: 4;
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
  drones: Record<DroneType, number>;
  /** Fleet Dispatch weights per zone (0–100). Empty = all drones follow the ship. */
  dispatch: Partial<Record<ZoneId, number>>;
  mechs: MechState[];
  parts: Record<string, number>;
  pilots: PilotState[];
  recruits: PilotState[];
  recruitRefresh: number;
  posts: Partial<Record<PostId, number>>;
  nextId: number;
  /** Lost drones, rebuildable at a discount until they drift away. */
  wrecks: Record<DroneType, number>;
  threats: ThreatState;
  asteroid: AsteroidState;
  sector: SectorInfo;
  zone: ZoneId;

  research: {
    levels: Record<string, number>;
    active: ResearchJob[];
  };
  /** capacityLevel: Furnace Capacity upgrades bought (bigger batches). */
  refinery: { slots: RefinerySlot[]; capacityLevel: number };
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
  levelUps: { pilotId: number; level: number }[];
  /** Threat events that started, warnings that began and things that resolved. */
  threatStarted: ActiveEvent[];
  threatResolved: { kind: EventKind; text: string; good: boolean; sortie?: SortieReport }[];
  syncUps: { pilotId: number; frame: FrameId; level: number }[];
  autoRepairs: number[];
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
  /** Threat outcomes while away. */
  threats: string[];
}
