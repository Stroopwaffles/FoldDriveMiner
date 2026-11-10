/**
 * All tuning numbers for Fold Drive Miner live here.
 * Balance the game by editing this file, not the engine.
 */

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
    maxTier: 2,
    tierUpgrades: [{ tier: 2, name: 'Drill Mk.II', cost: 1500 }],
  },

  heat: {
    perClick: 7,
    decayPerSec: 30,
    max: 100,
    /** Heat at or above this (but below max) triggers OVERDRIVE. */
    overdriveMin: 70,
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
  },

  asteroid: {
    baseMass: 25,
    /** Each cracked asteroid makes the next one this fraction heavier. */
    massGrowthPerCrack: 0.04,
    maxMassMult: 20,
    depletionBonusFrac: 0.25,
    dataCoreChance: 0.015,
    surveyDataPerCrack: 1,
    richChance: 0.1,
  },

  /** Average ore mix of the home sector field (drones mine this). */
  homeField: { ferrite: 0.85, titanite: 0.15 } as Partial<Record<OreId, number>>,

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
