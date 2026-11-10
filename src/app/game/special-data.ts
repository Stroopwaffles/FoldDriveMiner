/**
 * Special asteroids: rare rocks (and wrecks) that drift in instead of a normal
 * asteroid. They pay better than ordinary rock. Where they turn up depends on
 * the zone's site (an old battlefield is full of warship hulks), the sector's
 * traits and star, and how good the ship's sensors are.
 */
import { StarId } from './sector-data';

export type SpecialKind = 'dense' | 'cluster' | 'geode' | 'derelict' | 'ice_chunk';
export type DerelictClass = 'hauler' | 'miner' | 'science' | 'military' | 'ancient';

export interface SpecialDef {
  kind: SpecialKind;
  name: string;
  kana: string;
  desc: string;
  /** Relative odds when a special turns up. */
  weight: number;
  /** Size compared with a normal rock here. */
  massMult: number;
  /** Ore per hit compared with a normal rock. */
  yieldMult: number;
  /** Multiplies the ore bonus when it cracks. */
  crackMult: number;
  color: string;
}

export const SPECIALS: readonly SpecialDef[] = [
  {
    kind: 'dense', name: 'Dense Asteroid', kana: 'こうみつど', color: '#ff9a5a',
    desc: 'Compressed rock: twice the size, more ore per hit, a big payout when it cracks.',
    weight: 3, massMult: 2.2, yieldMult: 1.6, crackMult: 3,
  },
  {
    kind: 'cluster', name: 'Element Cluster', kana: 'たんいつこうせき', color: '#4fe3ff',
    desc: 'A knot of one pure ore. Double ore per hit, all of it valuable.',
    weight: 2, massMult: 1, yieldMult: 2, crackMult: 2,
  },
  {
    kind: 'geode', name: 'Crystal Geode', kana: 'がんどう', color: '#c77dff',
    desc: 'A hollow shell. Crack it fast: the crystals inside are the real prize.',
    weight: 1.5, massMult: 0.6, yieldMult: 1, crackMult: 1,
  },
  {
    kind: 'ice_chunk', name: 'Comet Ice Chunk', kana: 'すいせいのこおり', color: '#a8f0ff',
    desc: 'A shard of comet ice. Helium-3 and Survey Data in every hit.',
    weight: 1.2, massMult: 1.3, yieldMult: 1.4, crackMult: 2,
  },
  {
    kind: 'derelict', name: 'Derelict Ship', kana: 'はいせん', color: '#ffd23f',
    desc: 'A dead ship adrift. Cut through the hull for scrap; the salvage inside depends on what she was.',
    weight: 1.5, massMult: 1.5, yieldMult: 1.2, crackMult: 1.5,
  },
];

export function specialDef(kind: SpecialKind): SpecialDef {
  return SPECIALS.find((s) => s.kind === kind)!;
}

export interface DerelictDef {
  id: DerelictClass;
  name: string;
  /** What the salvage team finds when the hull cracks open. */
  salvage: string;
  weight: number;
  /** Not found shallower than this sector depth. */
  minDepth: number;
}

export const DERELICTS: readonly DerelictDef[] = [
  { id: 'hauler', name: 'Cargo Hauler', salvage: 'a hold full of trade goods (credits)', weight: 4, minDepth: 0 },
  { id: 'miner', name: 'Mining Barge', salvage: 'a full ore bay and working drones', weight: 3, minDepth: 0 },
  { id: 'science', name: 'Survey Vessel', salvage: 'survey archives and sometimes a Data Core', weight: 2, minDepth: 0 },
  { id: 'military', name: 'Warship Hulk', salvage: 'a Data Core, war bonds and sometimes a mech part', weight: 2, minDepth: 0 },
  { id: 'ancient', name: 'Precursor Wreck', salvage: 'Data Cores, ancient star charts and, rarely, a legendary part', weight: 0.3, minDepth: 2 },
];

export function derelictDef(id: DerelictClass): DerelictDef {
  return DERELICTS.find((d) => d.id === id)!;
}

/**
 * Zone sites: what a zone used to be, or what passes through it. Each one
 * makes some specials more common there.
 */
export type SiteId = 'battlefield' | 'shipping_lane' | 'graveyard' | 'compression_belt' | 'crystal_bloom' | 'comet_trail';

export interface SiteDef {
  id: SiteId;
  name: string;
  desc: string;
  /** Multiplies how often any special turns up in this zone. */
  chanceMult: number;
  /** Extra weight for special kinds and derelict classes here. */
  kinds?: Partial<Record<SpecialKind, number>>;
  derelicts?: Partial<Record<DerelictClass, number>>;
}

export const SITES: readonly SiteDef[] = [
  { id: 'battlefield', name: 'Old Battlefield', desc: 'Warship hulks from a forgotten war.', chanceMult: 1.6, kinds: { derelict: 4 }, derelicts: { military: 5, ancient: 1.5 } },
  { id: 'shipping_lane', name: 'Shipping Lane', desc: 'Lost haulers drift along the old trade route.', chanceMult: 1.4, kinds: { derelict: 3 }, derelicts: { hauler: 3, miner: 1.5 } },
  { id: 'graveyard', name: 'Ship Graveyard', desc: 'Where ships come to die. Wrecks of every kind.', chanceMult: 1.8, kinds: { derelict: 5 }, derelicts: { science: 2, ancient: 2 } },
  { id: 'compression_belt', name: 'Compression Belt', desc: 'Tidal forces crush rock dense.', chanceMult: 1.5, kinds: { dense: 4, cluster: 1.5 } },
  { id: 'crystal_bloom', name: 'Crystal Bloom', desc: 'Geodes and pure-ore clusters grow here.', chanceMult: 1.5, kinds: { geode: 4, cluster: 3 } },
  { id: 'comet_trail', name: 'Comet Trail', desc: 'An old comet shed its ice along this path.', chanceMult: 1.4, kinds: { ice_chunk: 5, geode: 1.5 } },
];

export function siteDef(id: SiteId): SiteDef {
  return SITES.find((s) => s.id === id)!;
}

/** Sector traits and stars that tilt the odds. */
export const TRAIT_SPECIALS: Record<string, { chanceMult?: number; kinds?: Partial<Record<SpecialKind, number>>; derelicts?: Partial<Record<DerelictClass, number>> }> = {
  dense_field: { kinds: { dense: 3 } },
  pirate_haven: { kinds: { derelict: 1.5 }, derelicts: { military: 2, hauler: 1.5 } },
  trade_hub: { kinds: { derelict: 1.5 }, derelicts: { hauler: 2.5 } },
  ancient_marker: { chanceMult: 1.2, derelicts: { ancient: 3 } },
  micrometeor_swarm: { kinds: { geode: 2 } },
};

export const STAR_SPECIALS: Partial<Record<StarId, { chanceMult?: number; kinds?: Partial<Record<SpecialKind, number>> }>> = {
  nebula: { chanceMult: 1.3, kinds: { cluster: 2, geode: 1.5 } },
  blue_giant: { kinds: { cluster: 1.5 } },
  black_hole: { kinds: { dense: 2.5 } },
  red_dwarf: { kinds: { ice_chunk: 2 } },
};

export const SPECIAL = {
  /** Chance a new rock is special, before sites, traits and sensors. */
  baseChance: 0.05,
  /** Never above this, however good the sensors. */
  maxChance: 0.35,
  /** Signature Scanner research: +30% per level. */
  scannerPerLevel: 0.3,
  /** Each Surveyor drone: +1%, up to +40%. */
  surveyorEach: 0.01,
  surveyorCap: 0.4,
  /** Sensor Array upgrade (credits): +10% per level. */
  arrayPerLevel: 0.1,
  arrayMaxLevel: 5,
  arrayCostBase: 5000,
  arrayCostGrowth: 3.2,
  /** Chance a generated zone has a site. */
  siteChance: 0.45,
};
