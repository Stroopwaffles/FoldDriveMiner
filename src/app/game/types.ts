import type { AssistantState } from './assistant-rules';
import type { BoosterState } from './booster-rules';
import type { AlloyId } from './alloy-data';
import type { DerelictClass, SpecialKind } from './special-data';
import { OreId, ZoneId } from './config';
import { BackgroundId, PostId, StatId } from './crew-data';
import { DroneType, FrameId, SlotId } from './fleet-data';
import { CaptainId, EventKind, StandingOrders } from './threat-data';
import { AnomalyKind, Approach } from './anomaly-data';
import { BondType, ClanId, ContractType, CorpId, ItemKind, OutfitArchetype } from './trade-data';

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
  /** A special rock (dense, cluster, geode, ice chunk or derelict), or null. */
  special?: SpecialInfo | null;
}

export interface SpecialInfo {
  kind: SpecialKind;
  /** Derelicts: what kind of ship she was. */
  derelict?: DerelictClass;
  /** Element clusters: the one ore. */
  ore?: OreId;
}

export interface DrillState {
  powerLevel: number;
  tier: number;
  heat: number;
  /** Seconds left in an overheat lockout. */
  lockRemaining: number;
  heatSinkLevel: number;
  /** Trigger Clamp owned: holding the mouse button keeps drilling. Kept across Fold Jumps. */
  clamp: boolean;
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
  alloysForged: number;
  /** Special rocks cracked, by kind ('derelict:military' for derelicts). Lifetime. */
  specials?: Record<string, number>;
  researchCompleted: number;
  mechOre: number;
  mechsBuilt: number;
}

export interface SectorInfo {
  /** Seed + depth regenerate the whole sector (see sector-rules.ts). */
  seed: number;
  code: string;
  name: string;
  /** Display label of the star (kept for the title screen's save card). */
  star: string;
  depth: number;
  /** Zones charted by sector scans (zone 1 is always charted). */
  charted: number;
  /** A sector scan underway, charting the next zone. */
  scan: { remaining: number; duration: number; paidSd: number } | null;
}

export interface AnomalyState {
  id: number;
  kind: AnomalyKind;
  zone: ZoneId;
  fixed: boolean;
  /** hidden → signal (detected) → scanned (identified) → active (being worked) → done. */
  status: 'hidden' | 'signal' | 'scanned' | 'active' | 'done';
  /** Passing anomalies: seconds before they slip away. */
  expires?: number;
  /** Fragments decoded, salvage cycles used, expeditions run, or rig deployed. */
  progress: number;
  /** Decode progress / comet time left, in seconds. */
  timer: number;
  /** Golden asteroid hit points. */
  hp?: number;
  hpMax?: number;
}

export interface MissionState {
  id: number;
  anomalyId: number;
  approach: Approach;
  mechId: number | null;
  drones: number;
  remaining: number;
  duration: number;
  chance: number;
}

export interface AnomaliesState {
  list: AnomalyState[];
  /** Seconds until the next passing-anomaly roll. */
  nextIn: number;
  scan: { anomalyId: number; remaining: number; duration: number } | null;
  missions: MissionState[];
  /** Times each kind has been identified (the Codex). */
  codex: Partial<Record<AnomalyKind, number>>;
  /** Silent Beacon fragments decoded (lore). */
  lore: number;
  /** Curios identified, in the order they were found (the Codex's Curios section). */
  curios: string[];
  nextId: number;
  /** Which sector the fixed list belongs to. */
  sectorKey: string;
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
  paidCores?: number;
}

/** The Alloy Forge: one batch at a time, like a furnace. */
export interface AlloyForge {
  alloy: AlloyId | null;
  /** Alloys being made (0 = idle or waiting for ingots). */
  batch: number;
  remaining: number;
  duration: number;
  repeat: boolean;
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

export type MechJob = 'idle' | 'mining' | 'repair' | 'defense' | 'mission';

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
  /** In the repair bay but can't pay (credits or Ferrite/Titanite); not saved as false. */
  repairStalled?: boolean;
  zone: ZoneId;
  pilotId: number | null;
  /** Special Technique: seconds of boost left, and cooldown left. */
  boostRemaining: number;
  cooldown: number;
}

/** A saved mech build (Loadout Memory research), kept through Fold Jumps. */
export interface SavedLoadout {
  id: number;
  name: string;
  frame: FrameId;
  parts: Partial<Record<SlotId, string>>;
  /** Optional crew and orders: pilot, standing job and zone. */
  pilotId: number | null;
  job: 'idle' | 'mining' | 'defense';
  zone: ZoneId | null;
  /** The mech this loadout was saved from or last rebuilt as (stale after a jump). */
  mechId: number | null;
}

export interface LoadoutsState {
  saved: SavedLoadout[];
  /** Rebuild saved loadouts automatically after a Fold Jump once credits allow. */
  auto: boolean;
  /** Set by a Fold Jump while auto is on; cleared when every loadout is built. */
  pending: boolean;
  nextId: number;
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
  /** Raids: a rival pirate captain leading it (or flying as the Jackal's lieutenant). */
  captain?: CaptainId;
  /** A Meridian Security raid (after Break the Cycle). */
  corporate?: boolean;
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
  /** A rival captain leading the enemy. */
  captain?: CaptainId;
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
  /** Raids led by a named captain (the Jackal or a rival), and raids since the last one. */
  captainRaids: number;
  raidsSinceCaptain: number;
  /** Encounters with each rival captain. */
  captains: Partial<Record<CaptainId, number>>;
  /** Seconds left of pirate harassment (no drone or mech mining). */
  harassSec: number;
  lastSortie: SortieReport | null;
  /** Fractional wreck recovery by Salvagers carried between ticks. */
  salvageAcc: number;
  nextEventId: number;
}

export interface StockItem {
  id: number;
  kind: ItemKind;
  label: string;
  desc: string;
  /** Credit price (0 = pay another way). */
  price: number;
  dataCores?: number;
  /** Barter alternative: pay this much of an ore instead. */
  barterOre?: OreId;
  barterAmount?: number;
  partId?: string;
  drone?: DroneType;
  count?: number;
  ore?: OreId;
  trait?: string;
  sold: boolean;
}

export interface MerchantFleet {
  clan: ClanId;
  /** Seconds before they fold out. */
  remaining: number;
  stock: StockItem[];
  /** Captain's favor: deliver ore before they leave. */
  favor: { ore: OreId; amount: number; done: boolean } | null;
  escortDone: boolean;
}

export interface TradeState {
  fleet: MerchantFleet | null;
  nextIn: number;
  /** A convoy arrived while you were away and is waiting for you. */
  pending: boolean;
  visits: number;
  rep: Record<ClanId, number>;
  inventory: { repair_kit: number; medkit: number; fold_cell: number };
  /** Seconds left on an Overdrive cell / deterrent beacon. */
  overdriveCell: number;
  deterrent: number;
  /** Seconds left on a Collegium research grant. */
  researchGrant: number;
  /** Purchases that only last for the current sector. */
  sectorBuffs: { key: string; sell: Partial<Record<OreId, number>>; cancelled: string[] };
  /** Permanent unlocks (clan exclusives and the like). */
  perks: string[];
  nextId: number;
}

export interface Contract {
  id: number;
  issuer: { kind: 'corp' | 'local'; id: string };
  type: ContractType;
  title: string;
  ore?: OreId;
  target: number;
  progress: number;
  /** Seconds left (counts down only while you're playing). */
  deadline: number;
  duration: number;
  reward: { credits: number; surveyData: number; dataCores: number };
  /** For counters (raids won, scans, cracks) at the moment you accepted. */
  baseline: number;
  /** Sustain contracts: seconds above the target so far. */
  held: number;
}

export interface LocalOutfit {
  id: string;
  name: string;
  archetype: OutfitArchetype;
  standing: number;
  legacyClaimed: boolean;
}

export interface ContractsState {
  board: Contract[];
  active: Contract[];
  refreshIn: number;
  standing: Record<CorpId, number>;
  /** Corporate exclusives already granted. */
  exclusives: CorpId[];
  local: LocalOutfit[];
  localKey: string;
  completed: number;
  failed: number;
  nextId: number;
}

export interface Bond {
  a: number;
  b: number;
  type: BondType;
}

export interface LogSnap {
  credits: number;
  ore: number;
  raids: number;
  anomalies: number;
  contracts: number;
}

/** One sector in the Sector Logbook. */
export interface LogEntry {
  code: string;
  name: string;
  star: string;
  depth: number;
  profile: string;
  traits: string[];
  /** Playtime seconds on arrival / departure (null while still here). */
  arrived: number;
  left: number | null;
  start: LogSnap;
  end: LogSnap | null;
  /** Fold Resonance earned by the jump out of this sector. */
  resonance: number;
}

/** A pilot who left the roster, kept in the Archive. */
export interface DossierEntry {
  name: string;
  callsign: string;
  background: string;
  level: number;
  portraitSeed: number;
  left: number;
}

export interface StoryState {
  /** Highest episode that has arrived, and the highest one watched. */
  unlocked: number;
  watched: number;
  /** Pacing: playtime and jump count when the last episode arrived. */
  lastUnlockAt: number;
  beatJumps: number;
  choice: 'break' | 'master' | null;
  /** Side stories unlocked (one per jump after the finale) and watched. */
  side: number;
  sideWatched: number;
  /** Commendations earned: id → playtime second. */
  medals: Record<string, number>;
  logbook: LogEntry[];
  dismissed: DossierEntry[];
}

export interface FoldState {
  /** Drive charge: 1 = 100% (can go higher with over-charge capacitors). */
  charge: number;
  /** Pull Helium-3 and Voidglass from the hold into the drive automatically. */
  autoFeed: boolean;
  /** Unspent Fold Resonance, and everything ever earned (drives the passive bonus). */
  resonance: number;
  lifetimeResonance: number;
  jumps: number;
  /** Jump Core upgrade levels. */
  core: Record<string, number>;
  /** How many runs each permanent-eligible research node has been owned in. */
  qolCounts: Record<string, number>;
  /** Mech frames built at least once (cheap to rebuild after a jump). */
  blueprints: FrameId[];
  /** Lifetime credits at the start of this run. */
  runStartCredits: number;
  /** Research nodes chosen for the Research Archive. */
  archive: string[];
  /** Destination picked for the next jump (index into the long-range scan). */
  destination: number;
  /** Deep Fold (after Master the Cycle): Echoes earned and Deep Folds made. */
  echoes: number;
  deepFolds: number;
}

export interface GameState {
  version: 13;
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
  /** Core Matrix levels, bought with Data Cores (kept through Fold Jumps). */
  matrix: Record<string, number>;
  /** Finished alloys (1 t each). */
  alloys: Record<AlloyId, number>;
  forge: AlloyForge;
  cargoLevel: number;
  /** Long-Range Sensor Array level (credits): finds special rocks more often. */
  sensorArray: number;
  /** Hyperthought Engine: burns Survey Data for research speed (Ops). */
  booster: BoosterState;

  drill: DrillState;
  drones: Record<DroneType, number>;
  /** Fleet Dispatch weights per zone (0–100). Empty = all drones follow the ship. */
  dispatch: Partial<Record<ZoneId, number>>;
  mechs: MechState[];
  parts: Record<string, number>;
  /** Saved mech loadouts (Loadout Memory). */
  loadouts: LoadoutsState;
  pilots: PilotState[];
  recruits: PilotState[];
  recruitRefresh: number;
  posts: Partial<Record<PostId, number>>;
  nextId: number;
  /** Lost drones, rebuildable at a discount until they drift away. */
  wrecks: Record<DroneType, number>;
  threats: ThreatState;
  anomalies: AnomaliesState;
  trade: TradeState;
  contracts: ContractsState;
  bonds: Bond[];
  fold: FoldState;
  /** Episodes, commendations, the Sector Logbook and dossiers (all persist across jumps). */
  story: StoryState;
  asteroid: AsteroidState;
  sector: SectorInfo;
  zone: ZoneId;

  research: {
    levels: Record<string, number>;
    active: ResearchJob[];
    /** ARIA, the research assistant: on/off, mode and her queue. */
    assistant: AssistantState;
  };
  /** capacityLevel: Furnace Capacity upgrades bought (bigger batches). */
  refinery: { slots: RefinerySlot[]; capacityLevel: number };
  autoSell: { ore: OreFlags; ingot: OreFlags; alloy: Record<AlloyId, boolean>; smart: boolean };

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
  /** A special rock cracked: its name and what was salvaged. */
  special?: { name: string; salvage: string; kind: SpecialKind };
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
  /** Anomaly news: detections, scans, mission results, lore. */
  anomaly: { text: string; good: boolean; kind: AnomalyKind; lore?: number }[];
  /** Merchant and contract news. */
  trade: { text: string; good: boolean; from?: 'merchant' | 'corp' | 'vesper' }[];
  syncUps: { pilotId: number; frame: FrameId; level: number }[];
  autoRepairs: number[];
  /** Saved loadouts that auto-rebuild built this tick (loadout names). */
  rebuilt?: string[];
  /** Research ARIA started on empty benches this tick. */
  assistantStarted?: string[];
  /** Mechs whose repair just stalled for lack of credits or ore. */
  repairStalled?: number[];
  ingots: OreAmounts;
  /** Alloys the forge finished. */
  alloys: number;
  /** Zones a sector scan charted. */
  charted: string[];
  autoSoldCredits: number;
  /** Episodes that arrived and commendations earned. */
  story: { kind: 'episode' | 'medal'; id: string; text: string }[];
}

export interface OfflineReport {
  seconds: number;
  cappedSeconds: number;
  efficiency: number;
  gained: OreAmounts;
  ingots: OreAmounts;
  alloys: number;
  credits: number;
  research: ResearchDone[];
  lost: number;
  cargoFull: boolean;
  /** Threat outcomes while away. */
  threats: string[];
}
