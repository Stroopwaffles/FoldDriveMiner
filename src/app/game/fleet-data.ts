/**
 * Fleet tuning data: drone types, mech frames and mech parts.
 */
import { OreId } from './config';

// ---------------------------------------------------------------- drones

export type DroneType = 'prospector' | 'cutter' | 'hauler' | 'surveyor' | 'guardian' | 'salvager';

export interface DroneDef {
  id: DroneType;
  name: string;
  role: string;
  baseCost: number;
  costGrowth: number;
  /** Ore per second (mining drones only). */
  orePerSec: number;
  /** Research that unlocks buying it (none = available from the start). */
  research?: string;
  /** Not buyable yet; names the milestone that adds it. */
  teaser?: string;
  color: string;
}

export const DRONES: readonly DroneDef[] = [
  {
    id: 'prospector', name: 'Prospector Mk.I', role: 'Mines the zone mix. The backbone of the fleet.',
    baseCost: 15, costGrowth: 1.15, orePerSec: 0.4, color: '#4fe3ff',
  },
  {
    id: 'cutter', name: 'Cutter', role: 'Less ore overall, but strongly favours the highest-tier ore it can reach.',
    baseCost: 400, costGrowth: 1.15, orePerSec: 1.5, research: 'cutter_drones', color: '#ff7a3d',
  },
  {
    id: 'hauler', name: 'Hauler', role: 'Does not mine. Each one adds +2% cargo capacity.',
    baseCost: 250, costGrowth: 1.15, orePerSec: 0, research: 'hauler_drones', color: '#ffd23f',
  },
  {
    id: 'surveyor', name: 'Surveyor', role: 'Does not mine. Streams Survey Data (+0.02/s each).',
    baseCost: 600, costGrowth: 1.15, orePerSec: 0, research: 'surveyor_drones', color: '#6dff9b',
  },
  {
    id: 'salvager', name: 'Salvager', role: 'Does not mine. +5% crack bonus and better Data Core odds each.',
    baseCost: 800, costGrowth: 1.15, orePerSec: 0, research: 'salvager_drones', color: '#c77dff',
  },
  {
    id: 'guardian', name: 'Guardian', role: 'Does not mine. Fights in raids, soaks fire and shields the swarm from micrometeors.',
    baseCost: 300, costGrowth: 1.15, orePerSec: 0, research: 'guardian_drones', color: '#ff3b3b',
  },
];

export const DRONE_IDS: readonly DroneType[] = DRONES.map((d) => d.id);

export function droneDef(id: DroneType): DroneDef {
  return DRONES.find((d) => d.id === id)!;
}

export const DRONE_EFFECTS = {
  haulerCargoBonus: 0.02,
  surveyorSdPerSec: 0.02,
  salvagerDepletionBonus: 0.05,
  salvagerDataCoreChance: 0.0005,
  salvagerDataCoreCap: 0.05,
};

// ---------------------------------------------------------------- mechs

export type FrameId = 'pickaxe' | 'kestrel' | 'bulwark';
export type SlotId = 'drill' | 'offhand' | 'reactor' | 'thrusters' | 'sensor' | 'armor';
export type MechStat = 'mining' | 'combat' | 'speed' | 'sensors' | 'armor';

export const SLOTS: { id: SlotId; name: string; kana: string }[] = [
  { id: 'drill', name: 'Drill Arm', kana: 'ドリル' },
  { id: 'offhand', name: 'Off-hand', kana: 'サブ' },
  { id: 'reactor', name: 'Reactor', kana: 'ろ' },
  { id: 'thrusters', name: 'Thrusters', kana: 'スラスター' },
  { id: 'sensor', name: 'Sensor Head', kana: 'センサー' },
  { id: 'armor', name: 'Armor Plating', kana: 'そうこう' },
];

export const MECH_STATS: { id: MechStat; name: string; active: boolean }[] = [
  { id: 'mining', name: 'Mining', active: true },
  { id: 'armor', name: 'Armor', active: true },
  { id: 'sensors', name: 'Sensors', active: true },
  { id: 'speed', name: 'Speed', active: false },
  { id: 'combat', name: 'Combat', active: false },
];

export interface FrameDef {
  id: FrameId;
  name: string;
  role: string;
  cost: number;
  /** Base stats before parts. */
  base: Record<MechStat, number>;
  /** Multipliers applied to the final stat. */
  mult: Partial<Record<MechStat, number>>;
  /** Power the frame supplies with no reactor. */
  basePower: number;
  color: string;
  /** Default name of the pilot's special technique with this frame. */
  move: string;
}

export const FRAMES: readonly FrameDef[] = [
  {
    id: 'pickaxe', name: 'Pickaxe', role: 'Worker frame. Best miner, strongest Command Link.',
    cost: 25000, base: { mining: 10, combat: 1, speed: 2, sensors: 2, armor: 60 },
    mult: { mining: 1.5 }, basePower: 4, color: '#ffb547', move: 'Mountain Breaker',
  },
  {
    id: 'kestrel', name: 'Kestrel', role: 'Scout frame. Fast with sharp sensors — streams Survey Data.',
    cost: 60000, base: { mining: 4, combat: 3, speed: 8, sensors: 8, armor: 45 },
    mult: { speed: 1.5, sensors: 1.5 }, basePower: 5, color: '#4fe3ff', move: 'Comet Dive',
  },
  {
    id: 'bulwark', name: 'Bulwark', role: 'Heavy frame. Thick armor, slow wear. Built for the fights to come.',
    cost: 90000, base: { mining: 6, combat: 8, speed: 1, sensors: 2, armor: 120 },
    mult: { armor: 1.5, combat: 1.5 }, basePower: 6, color: '#ff3d9a', move: 'Iron Fortress',
  },
];

export function frameDef(id: FrameId): FrameDef {
  return FRAMES.find((f) => f.id === id)!;
}

export interface PartDef {
  id: string;
  name: string;
  slot: SlotId;
  cost: number;
  stats: Partial<Record<MechStat, number>>;
  /** Power drawn (or supplied, for reactors). */
  draw: number;
  supply?: number;
  /** Research needed before the part shows in the shop. */
  research?: string;
  rarity: 'standard' | 'surplus' | 'unique' | 'legendary';
}

export const PARTS: readonly PartDef[] = [
  // Drill arms
  { id: 'hand_drill', name: 'Hand Drill', slot: 'drill', cost: 2000, stats: { mining: 5 }, draw: 2, rarity: 'standard' },
  { id: 'breaker', name: 'Pneumatic Breaker', slot: 'drill', cost: 15000, stats: { mining: 12 }, draw: 5, rarity: 'standard' },
  { id: 'plasma_lance', name: 'Plasma Lance', slot: 'drill', cost: 120000, stats: { mining: 30 }, draw: 10, rarity: 'standard', research: 'mech_engineering' },
  // Off-hand
  { id: 'grapple', name: 'Grapple Claw', slot: 'offhand', cost: 1500, stats: { mining: 3, speed: 1 }, draw: 1, rarity: 'standard' },
  { id: 'probe_launcher', name: 'Probe Launcher', slot: 'offhand', cost: 12000, stats: { sensors: 6 }, draw: 3, rarity: 'standard' },
  { id: 'riot_shield', name: 'Riot Shield', slot: 'offhand', cost: 10000, stats: { armor: 30, combat: 2 }, draw: 2, rarity: 'standard' },
  { id: 'rail_rifle', name: 'Rail Rifle', slot: 'offhand', cost: 40000, stats: { combat: 10 }, draw: 6, rarity: 'standard', research: 'mech_engineering' },
  // Reactors
  { id: 'fusion_cell', name: 'Fusion Cell', slot: 'reactor', cost: 3000, stats: {}, draw: 0, supply: 10, rarity: 'standard' },
  { id: 'twin_core', name: 'Twin-Core Reactor', slot: 'reactor', cost: 25000, stats: {}, draw: 0, supply: 20, rarity: 'standard' },
  { id: 'he3_reactor', name: 'Helium-3 Reactor', slot: 'reactor', cost: 250000, stats: {}, draw: 0, supply: 36, rarity: 'standard', research: 'mech_engineering' },
  // Thrusters
  { id: 'vernier', name: 'Vernier Pack', slot: 'thrusters', cost: 4000, stats: { speed: 4 }, draw: 2, rarity: 'standard' },
  { id: 'booster_wing', name: 'Booster Wing', slot: 'thrusters', cost: 30000, stats: { speed: 10 }, draw: 5, rarity: 'standard' },
  // Sensor heads
  { id: 'optic_visor', name: 'Optic Visor', slot: 'sensor', cost: 2000, stats: { sensors: 4 }, draw: 1, rarity: 'standard' },
  { id: 'radar_dome', name: 'Deep Radar Dome', slot: 'sensor', cost: 30000, stats: { sensors: 12 }, draw: 4, rarity: 'standard' },
  // Armor
  { id: 'plate_mk1', name: 'Plate Mk.I', slot: 'armor', cost: 3000, stats: { armor: 40, speed: -1 }, draw: 0, rarity: 'standard' },
  { id: 'composite_plate', name: 'Composite Plate', slot: 'armor', cost: 30000, stats: { armor: 100 }, draw: 1, rarity: 'standard' },
  // Unique parts: never sold; recovered from the Jackal and pirate bases.
  { id: 'crimson_lance', name: 'Crimson Fang Lance', slot: 'drill', cost: 0, stats: { mining: 40, combat: 15 }, draw: 9, rarity: 'unique' },
  { id: 'vermilion_plating', name: 'Vermilion Plating', slot: 'armor', cost: 0, stats: { armor: 160, speed: 2 }, draw: 1, rarity: 'unique' },
  // Clan and corporate exclusives (Milestone 5b).
  { id: 'halcyon_chrome', name: 'Halcyon Chrome Plating', slot: 'armor', cost: 0, stats: { armor: 130, speed: 6 }, draw: 1, rarity: 'unique' },
  { id: 'meridian_core', name: 'Meridian Prototype Core', slot: 'reactor', cost: 0, stats: {}, draw: 0, supply: 48, rarity: 'unique' },
  { id: 'aster_capacitor', name: 'Aster-Lune Fold Capacitor', slot: 'reactor', cost: 0, stats: { speed: 4 }, draw: 0, supply: 40, rarity: 'unique' },
  { id: 'orrery_array', name: 'Orrery Deep Array', slot: 'sensor', cost: 0, stats: { sensors: 24 }, draw: 3, rarity: 'unique' },
  { id: 'vanguard_aegis', name: 'Vanguard Aegis', slot: 'offhand', cost: 0, stats: { armor: 80, combat: 12 }, draw: 4, rarity: 'unique' },
];

/** Sector-unique parts sold by merchants: 'sx:<sector seed>:<base part id>'. Stats ×1.3 of the base. */
export function sectorPartId(sectorSeed: number, baseId: string): string {
  return `sx:${sectorSeed >>> 0}:${baseId}`;
}

const SECTOR_PART_WORDS = ['Kestrel', 'Halo', 'Drift', 'Tempest', 'Reef', 'Cinder', 'Lantern', 'Expanse', 'Crown', 'Orrery', 'Tidewater', 'Ember', 'Lattice', 'Margin', 'Maw', 'Choir', 'Ashfall', 'Mirror', 'Vesper', 'Thorn'];

function sectorPart(id: string): PartDef | undefined {
  const m = /^sx:(\d+):(.+)$/.exec(id);
  if (!m) return undefined;
  const base = PARTS.find((p) => p.id === m[2]);
  if (!base) return undefined;
  const word = SECTOR_PART_WORDS[Number(m[1]) % SECTOR_PART_WORDS.length];
  const stats: PartDef['stats'] = {};
  for (const [k, v] of Object.entries(base.stats)) stats[k as MechStat] = Math.round((v as number) * 1.3);
  return {
    ...base,
    id,
    name: `${word} ${base.name}`,
    cost: base.cost * 2,
    stats,
    supply: base.supply ? Math.round(base.supply * 1.3) : undefined,
    rarity: 'unique',
    research: undefined,
  };
}

export function partDef(id: string): PartDef {
  const p = PARTS.find((x) => x.id === id) ?? sectorPart(id);
  if (!p) throw new Error(`Unknown part: ${id}`);
  return p;
}

export const MECH = {
  /** Ore per second per point of Mining. */
  orePerMining: 2,
  /** Drone bonus in the mech's zone per point of Mining (Command Link), and its cap. */
  commandLinkPerMining: 0.005,
  commandLinkCap: 1,
  /** Survey Data per second per point of Sensors. */
  sdPerSensor: 0.004,
  /** Unpiloted mechs run on autopilot at this efficiency. */
  autopilot: 0.5,
  /** Armor lost per minute while mining, as a fraction of max. Never below the floor. */
  wearPerMin: 0.015,
  wearFloor: 0.2,
  /** Repair speed per minute (fraction of max) and price per armor point. */
  repairPerMin: 0.1,
  repairCreditsPerPoint: 20,
  repairOrePerPoint: 2,
  /** Auto-repair sends a mining mech to the bay below this fraction. */
  autoRepairBelow: 0.4,
  techniqueBoost: 5,
  techniqueSec: 30,
  techniqueCooldownSec: 600,
  /** Ore used for repairs, cheapest first. */
  repairOres: ['ferrite', 'titanite'] as OreId[],
};

export const CONDITION = [
  { id: 'operational', name: 'Operational', min: 0.5, mult: 1, color: '#6dff9b' },
  { id: 'damaged', name: 'Damaged', min: 0.25, mult: 0.75, color: '#ffd23f' },
  { id: 'critical', name: 'Critical', min: 0.0001, mult: 0.5, color: '#ff7a3d' },
  { id: 'disabled', name: 'Disabled', min: -1, mult: 0, color: '#ff3b3b' },
] as const;
