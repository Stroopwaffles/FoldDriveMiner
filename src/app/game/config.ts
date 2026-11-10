/**
 * All tuning numbers for Fold Drive Miner live here.
 * Balance the game by editing this file, not the engine.
 */

import type { SiteId } from './special-data';

export type OreId = 'ferrite' | 'titanite' | 'iridium' | 'helium3' | 'voidglass';

export interface OreDef {
  id: OreId;
  /** 3-letter ticker code shown in the HUD. */
  code: string;
  name: string;
  tier: number;
  baseValue: number;
  color: string;
}

export const ORES: readonly OreDef[] = [
  { id: 'ferrite', code: 'FER', name: 'Ferrite', tier: 1, baseValue: 1, color: '#d98a4e' },
  { id: 'titanite', code: 'TTN', name: 'Titanite', tier: 2, baseValue: 8, color: '#4fd8ec' },
  { id: 'iridium', code: 'IRD', name: 'Iridium', tier: 3, baseValue: 60, color: '#c77dff' },
  { id: 'helium3', code: 'HE3', name: 'Helium-3', tier: 4, baseValue: 450, color: '#9dff8a' },
  { id: 'voidglass', code: 'VDG', name: 'Voidglass', tier: 5, baseValue: 4000, color: '#ff5fa2' },
];

export const ORE_IDS: readonly OreId[] = ORES.map((o) => o.id);

export function oreDef(id: OreId): OreDef {
  return ORES.find((o) => o.id === id)!;
}

/** Home zones use readable ids (inner, trojan…); generated sectors use '<code>:<index>'. */
export type ZoneId = string;

export interface ZoneDef {
  id: ZoneId;
  name: string;
  kana: string;
  desc: string;
  /** Ore mix for asteroids and drones in this zone; sums to 1. */
  composition: Partial<Record<OreId, number>>;
  massMult: number;
  /** Survey Data per cracked asteroid, before bonuses. */
  surveyData: number;
  /** Position in the sector, inner (0) to outer. Zone 0 is open; the rest are charted by sector scans. */
  index: number;
  color: string;
  /** What this zone used to be: makes some special rocks more common here. */
  site?: SiteId;
}

/** Survey zones of the home sector (procedural zones arrive with sector generation). */
export const ZONES: readonly ZoneDef[] = [
  {
    id: 'inner',
    index: 0,
    name: 'Inner Belt',
    kana: 'ないそくたい',
    desc: 'Close, safe and Ferrite-heavy. Where every prospector starts.',
    composition: { ferrite: 0.85, titanite: 0.15 },
    massMult: 1,
    surveyData: 1,
    color: '#ffd23f',
  },
  {
    id: 'trojan',
    index: 1,
    name: 'Trojan Cluster',
    kana: 'トロヤぐん',
    desc: 'Rocks trapped in a gravity well. Rich in Titanite, traces of Iridium.',
    composition: { ferrite: 0.55, titanite: 0.35, iridium: 0.1 },
    massMult: 2.5,
    surveyData: 2,
    color: '#4fe3ff',
    site: 'shipping_lane',
  },
  {
    id: 'ring',
    index: 2,
    name: 'Ring Debris',
    kana: 'リングのはへん',
    desc: 'Shattered moonlets in a wide ring. Dense Iridium veins.',
    composition: { ferrite: 0.3, titanite: 0.4, iridium: 0.3 },
    massMult: 5,
    surveyData: 4,
    color: '#c77dff',
    site: 'battlefield',
  },
  {
    id: 'ice',
    index: 3,
    name: 'Ice Halo',
    kana: 'こおりのわ',
    desc: 'Frozen bodies at the edge of the system. Helium-3 locked in the ice.',
    composition: { titanite: 0.25, iridium: 0.35, helium3: 0.4 },
    massMult: 10,
    surveyData: 8,
    color: '#9dff8a',
    site: 'comet_trail',
  },
  {
    id: 'deep',
    index: 4,
    name: 'Deep Field',
    kana: 'しんえん',
    desc: 'The dark edge of the system. Voidglass glitters in the oldest rock.',
    composition: { iridium: 0.35, helium3: 0.45, voidglass: 0.2 },
    massMult: 20,
    surveyData: 16,
    color: '#ff5fa2',
  },
];

/** Zones of generated sectors, registered when a sector is generated. */
const generatedZones = new Map<string, ZoneDef>();

export function registerZones(zones: readonly ZoneDef[]): void {
  for (const z of zones) generatedZones.set(z.id, z);
}

export function zoneDef(id: ZoneId): ZoneDef {
  return ZONES.find((z) => z.id === id) ?? generatedZones.get(id) ?? ZONES[0];
}

export const CONFIG = {
  /** Logic tick length in milliseconds (10 Hz). */
  tickMs: 100,
  /** In-session gaps longer than this are treated as offline time. */
  offlineThresholdSec: 60,

  drill: {
    basePower: 1,
    /** Flat power added per Drill Power level. */
    powerPerLevel: 1,
    /** Power doubles every N levels. */
    powerDoublingEvery: 10,
    powerCostBase: 12,
    powerCostGrowth: 1.45,
    /** Highest drill tier reachable in this build (Mk.III+ arrives with research). */
    /** Mk.II is bought with credits; Mk.III and Mk.IV come from research. */
    tierUpgrades: [{ tier: 2, name: 'Drill Mk.II', cost: 1500 }],
  },

  heat: {
    perClick: 7,
    decayPerSec: 30,
    max: 100,
    /**
     * OVERDRIVE is the cool zone: a click that leaves heat at or below this
     * hits at the Overdrive multiplier. Click too fast, heat climbs past it and
     * Overdrive is lost; at max the drill locks out. Heat sinks vent faster,
     * so you can click faster and still stay cool.
     */
    overdriveMax: 40,
    overdriveMult: 3,
    lockSec: 3,
    sinkDecayBonus: 0.15,
    sinkCostBase: 150,
    sinkCostGrowth: 2,
    sinkMaxLevel: 5,
  },

  drones: {
    prospector: {
      name: 'Prospector Drone Mk.I',
      baseCost: 15,
      costGrowth: 1.15,
      orePerSec: 0.4,
    },
    /** Owning this many drones doubles their output (each threshold). */
    milestones: [25, 50, 100, 150, 200, 250, 300, 400, 500],
  },

  cargo: {
    baseCapacity: 100,
    capacityGrowth: 1.75,
    costBase: 40,
    costGrowth: 2.1,
    /** Expand Hold stops here, and no mix of bonuses lifts the hold past maxCapacity tonnes. */
    maxLevel: 24,
    maxCapacity: 250_000_000,
  },

  /** Trigger Clamp: hold the mouse button to keep drilling. */
  hold: {
    cost: 2500,
    /** Seconds between held hits before Servo Actuators research. */
    baseIntervalSec: 0.5,
    /** Each Servo Actuators level multiplies the interval by this. */
    servoFactor: 0.85,
  },

  asteroid: {
    baseMass: 60,
    /** Every asteroid takes at least this many normal clicks at the current drill power. */
    minClicks: 30,
    /** Each cracked asteroid makes the next one this fraction heavier. */
    massGrowthPerCrack: 0.04,
    maxMassMult: 20,
    depletionBonusFrac: 0.25,
    dataCoreChance: 0.015,
    surveyDataPerCrack: 1,
    richChance: 0.1,
  },

  refinery: {
    /** Ore one furnace can take per batch, and the Furnace Capacity upgrade (credits). */
    baseBatch: 50,
    batchGrowth: 1.6,
    batchCostBase: 500,
    batchCostGrowth: 2.2,
    /** Furnace Capacity stops at this level. */
    maxBatchLevel: 18,
    baseDurationSec: 30,
    /** Each Refinery Speed level multiplies batch time by this. */
    speedFactor: 0.85,
    /** Ore per ingot; each Yield level removes one, down to the minimum. */
    baseRatio: 10,
    minRatio: 7,
    /** An ingot is worth this many times the ore's base value. */
    ingotValueMult: 14,
  },

  research: {
    baseLabSlots: 1,
    /** Chance a finished project refunds its full cost. */
    eurekaChance: 0.05,
  },

  bonuses: {
    overdrivePerLevel: 0.5,
    depletionPerLevel: 0.25,
    surveyDataPerLevel: 0.5,
    cargoPerLevel: 0.25,
    dronePerLevel: 0.25,
    offlineEfficiencyPerLevel: 0.1,
    offlineCapHoursPerLevel: 2,
  },

  market: {
    /** Slow and fast price waves, in seconds. Combined swing is about ±20%. */
    slowPeriodSec: 180,
    slowAmp: 0.12,
    fastPeriodSec: 47,
    fastAmp: 0.08,
  },

  offline: {
    efficiency: 0.5,
    capHours: 8,
  },

  save: {
    autosaveSec: 30,
    /** Rotate a backup every N saves (30 s × 10 = 5 min). */
    backupEvery: 10,
    backupCount: 3,
  },
} as const;
