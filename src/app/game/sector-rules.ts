/**
 * Sector generation (seed + depth → star, ore profile, traits, survey zones,
 * fixed anomalies) and the combined modifiers a sector applies.
 */
import { ORES, ORE_IDS, OreId, ZONES, ZoneDef, oreDef, registerZones } from './config';
import { Rng } from './rng';
import {
  NEUTRAL_MODS,
  PROFILES,
  ProfileDef,
  SECTOR_NAMES,
  SECTOR_TRAITS,
  STARS,
  SectorMods,
  SectorTraitDef,
  StarDef,
  StarId,
  ZONE_MASS,
  ZONE_NAMES,
  ZONE_RESEARCH,
  ZONE_SURVEY,
  ZONE_TEMPLATES,
} from './sector-data';
import { ANOMALIES, AnomalyKind } from './anomaly-data';
import { GameState } from './types';

export interface SectorDef {
  seed: number;
  depth: number;
  code: string;
  name: string;
  stars: StarId[];
  profile: string;
  traits: string[];
  zones: ZoneDef[];
  /** Fixed anomalies: kind and the zone index they sit in. */
  fixed: { kind: AnomalyKind; zone: number }[];
}

const cache = new Map<string, SectorDef>();

function pickWeighted<T extends { weight: number }>(rng: Rng, list: readonly T[]): T {
  const total = list.reduce((s, x) => s + x.weight, 0);
  let roll = rng.next() * total;
  for (const x of list) {
    roll -= x.weight;
    if (roll <= 0) return x;
  }
  return list[list.length - 1];
}

/** Deterministic: the same seed and depth always make the same sector. */
export function generateSector(seed: number, depth: number): SectorDef {
  const key = `${seed}:${depth}`;
  const hit = cache.get(key);
  if (hit) return hit;
  const def = depth === 0 ? homeSector(seed) : buildSector(seed, depth);
  registerZones(def.zones);
  cache.set(key, def);
  return def;
}

/** The home sector: the familiar zones, a yellow star, no traits, and a story-guaranteed Silent Beacon. */
function homeSector(seed: number): SectorDef {
  return {
    seed,
    depth: 0,
    code: '00-H',
    name: 'Home Reach',
    stars: ['yellow'],
    profile: 'balanced',
    traits: [],
    zones: [...ZONES],
    fixed: [
      { kind: 'gravity_lens', zone: 0 },
      { kind: 'derelict', zone: 1 },
      { kind: 'silent_beacon', zone: 2 },
    ],
  };
}

function buildSector(seed: number, depth: number): SectorDef {
  const rng = new Rng((seed ^ Math.imul(depth + 1, 0x9e3779b1)) >>> 0);
  const letter = 'ABCDEFGHJKLMNPRSTVWXYZ'[Math.floor(rng.next() * 22)];
  const code = `${String(depth).padStart(2, '0')}-${letter}`;
  const name = SECTOR_NAMES[Math.floor(rng.next() * SECTOR_NAMES.length)];

  const starOptions = STARS.filter((s) => s.minDepth <= depth && s.id !== 'yellow');
  let star = pickWeighted(rng, starOptions);
  const stars: StarId[] = [star.id];
  if (star.id === 'binary') {
    const a = pickWeighted(rng, starOptions.filter((s) => s.id !== 'binary'));
    let b = pickWeighted(rng, starOptions.filter((s) => s.id !== 'binary'));
    if (b.id === a.id) b = STARS[0];
    stars.splice(0, 1, 'binary', a.id, b.id);
    star = a;
  }

  const profile = PROFILES[Math.floor(rng.next() * PROFILES.length)];

  const traitCount = Math.min(3, 1 + Math.floor(rng.next() * (1 + Math.min(2, depth / 2))));
  const traitPool = SECTOR_TRAITS.filter((t) => t.minDepth <= depth);
  const traits: string[] = [];
  for (let i = 0; i < traitCount && traitPool.length; i++) {
    const t = pickWeighted(rng, traitPool.filter((x) => !traits.includes(x.id)));
    if (t) traits.push(t.id);
  }

  const zoneCount = 3 + Math.floor(rng.next() * 3);
  // Fisher–Yates shuffle with the seeded RNG (deterministic, unlike sort with a random comparator).
  const names = [...ZONE_NAMES];
  for (let i = names.length - 1; i > 0; i--) {
    const j = Math.floor(rng.next() * (i + 1));
    [names[i], names[j]] = [names[j], names[i]];
  }
  const zones: ZoneDef[] = [];
  for (let i = 0; i < zoneCount; i++) {
    const comp: Partial<Record<OreId, number>> = {};
    const template = ZONE_TEMPLATES[Math.min(i, ZONE_TEMPLATES.length - 1)];
    let total = 0;
    for (const id of ORE_IDS) {
      let w = (template[id] ?? 0) * (profile.shift[id] ?? 1) * rng.range(0.75, 1.25);
      // Black holes put Voidglass in the outermost zone.
      if (id === 'voidglass' && i === zoneCount - 1 && stars.includes('black_hole')) w += 0.25;
      if (w > 0) {
        comp[id] = w;
        total += w;
      }
    }
    for (const id of Object.keys(comp) as OreId[]) comp[id] = comp[id]! / total;
    const scale = 1 + depth * 0.25;
    const top = [...ORES].reverse().find((o) => (comp[o.id] ?? 0) > 0.05) ?? ORES[0];
    zones.push({
      id: `${code}:${i}`,
      name: names[i][0],
      kana: names[i][1],
      desc: `${profile.name}. Richest in ${top.name}.`,
      composition: comp,
      massMult: ZONE_MASS[i] * scale,
      surveyData: ZONE_SURVEY[i] * scale,
      research: ZONE_RESEARCH[i],
      color: top.color,
    });
  }

  // Fixed anomalies: more in deeper sectors; an Ancient Survey Marker guarantees a Rare+.
  const fixedCount = 1 + (depth >= 2 ? 1 : 0) + (rng.next() < 0.5 ? 1 : 0);
  const pool = ANOMALIES.filter((a) => a.fixed && a.minDepth <= depth);
  const fixed: SectorDef['fixed'] = [];
  for (let i = 0; i < fixedCount && pool.length; i++) {
    const forceRare = i === 0 && traits.includes('ancient_marker');
    const options = forceRare ? pool.filter((a) => a.rarity === 'rare' || a.rarity === 'legendary') : pool;
    const a = pickWeighted(rng, options.length ? options : pool);
    fixed.push({ kind: a.kind, zone: Math.min(zoneCount - 1, 1 + Math.floor(rng.next() * (zoneCount - 1))) });
  }

  return { seed, depth, code, name, stars, profile: profile.id, traits, zones, fixed };
}

// ---------------------------------------------------------------- the current sector

export function sectorOf(state: GameState): SectorDef {
  return generateSector(state.sector.seed, state.sector.depth);
}

export function sectorZones(state: GameState): ZoneDef[] {
  return sectorOf(state).zones;
}

export function starDef(id: StarId): StarDef {
  return STARS.find((s) => s.id === id)!;
}

export function profileDef(id: string): ProfileDef {
  return PROFILES.find((p) => p.id === id) ?? PROFILES[0];
}

export function sectorTraitDef(id: string): SectorTraitDef {
  return SECTOR_TRAITS.find((t) => t.id === id)!;
}

/** The main star (for binaries, the first partner). */
export function mainStar(def: SectorDef): StarDef {
  return starDef(def.stars.find((s) => s !== 'binary') ?? 'yellow');
}

export function starLabel(def: SectorDef): string {
  if (def.stars[0] === 'binary') return `Binary: ${def.stars.slice(1).map((s) => starDef(s).name).join(' + ')}`;
  return starDef(def.stars[0]).name;
}

const modsCache = new Map<string, SectorMods>();

/** All of the sector's effects combined (stars, profile, traits). */
export function sectorMods(state: GameState): SectorMods {
  const cancelled = state.trade?.sectorBuffs?.cancelled ?? [];
  const key = `${state.sector.seed}:${state.sector.depth}:${cancelled.join(',')}`;
  const hit = modsCache.get(key);
  if (hit) return hit;
  const def = sectorOf(state);
  const parts: Partial<SectorMods>[] = [
    ...def.stars.map((s) => starDef(s).mods),
    profileDef(def.profile).mods,
    ...def.traits.filter((t) => !cancelled.includes(t)).map((t) => sectorTraitDef(t).mods),
  ];
  const out: SectorMods = { ...NEUTRAL_MODS, eventWeights: {} };
  for (const p of parts) {
    for (const k of ['droneOutput', 'clickPower', 'asteroidMass', 'crackBonus', 'refinerySpeed', 'sellPrice', 'marketAmp', 'eventInterval', 'anomalyChance', 'scanSpeed', 'heatPerClick'] as const) {
      if (p[k] !== undefined) out[k] *= p[k] as number;
    }
    if (p.offlineBonus) out.offlineBonus += p.offlineBonus;
    if (p.overdriveBonus) out.overdriveBonus += p.overdriveBonus;
    if (p.pulsar) out.pulsar = true;
    for (const [k, v] of Object.entries(p.eventWeights ?? {})) {
      out.eventWeights[k as keyof SectorMods['eventWeights']] = (out.eventWeights[k as keyof SectorMods['eventWeights']] ?? 1) * (v as number);
    }
  }
  modsCache.set(key, out);
  return out;
}

/** Pulsar surge: ×2 production for 30 s in every 180 s of game time. */
export function pulsarSurge(state: GameState): boolean {
  return sectorMods(state).pulsar && state.threats.clock % 180 < 30;
}

// ---------------------------------------------------------------- long-range scan

/** Seeds for the next sectors a Fold Jump could reach (Milestone 6). */
export function destinationSeeds(state: GameState, count = 3): number[] {
  const rng = new Rng((state.sector.seed ^ 0x5bd1e995 ^ Math.imul(state.sector.depth + 7, 0x27d4eb2d)) >>> 0);
  return Array.from({ length: count }, () => (rng.next() * 4294967296) >>> 0);
}

export function destinationPreview(state: GameState, count = 3, revealed = 1): { def: SectorDef; revealed: number }[] {
  return destinationSeeds(state, count).map((seed) => ({
    def: generateSector(seed, state.sector.depth + 1),
    // Long-range sensors only see the first trait(s); the rest are '???'.
    revealed,
  }));
}

export function oreName(ore: OreId): string {
  return oreDef(ore).name;
}
