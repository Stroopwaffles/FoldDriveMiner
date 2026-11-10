/**
 * Special asteroids: rolling one up when a new rock drifts in, what it's made
 * of, and the salvage when it cracks.
 */
import { ORE_IDS, OreId, ZoneDef } from './config';
import { emptyOre, oreReachable, researchLevel } from './common';
import { relicsLeft } from './core-rules';
import { orePrice, surveyDataPerCrack } from './engine';
import { partDef, PARTS } from './fleet-data';
import { Rng } from './rng';
import { sectorOf } from './sector-rules';
import {
  DERELICTS,
  DerelictClass,
  SPECIAL,
  SPECIALS,
  STAR_SPECIALS,
  SiteDef,
  SpecialKind,
  TRAIT_SPECIALS,
  derelictDef,
  siteDef,
  specialDef,
} from './special-data';
import { AsteroidState, GameState, OreAmounts, SpecialInfo } from './types';

// ---------------------------------------------------------------- odds

export function zoneSite(zone: ZoneDef): SiteDef | null {
  return zone.site ? siteDef(zone.site) : null;
}

/** Sector traits and stars that apply here. */
function sectorTilts(state: GameState) {
  const def = sectorOf(state);
  const tilts = [
    ...def.traits.map((t) => TRAIT_SPECIALS[t]).filter((x) => !!x),
    ...def.stars.map((s) => STAR_SPECIALS[s]).filter((x) => !!x),
  ];
  return tilts as { chanceMult?: number; kinds?: Partial<Record<SpecialKind, number>>; derelicts?: Partial<Record<DerelictClass, number>> }[];
}

/** How much the ship's sensors raise the odds (1 = no bonus). */
export function sensorMult(state: GameState): number {
  const scanner = researchLevel(state, 'signature_scanner') * SPECIAL.scannerPerLevel;
  const surveyors = Math.min(SPECIAL.surveyorCap, state.drones.surveyor * SPECIAL.surveyorEach);
  const array = (state.sensorArray ?? 0) * SPECIAL.arrayPerLevel;
  return 1 + scanner + surveyors + array;
}

/** Chance the next rock in a zone is special. */
export function specialChance(state: GameState, zone: ZoneDef): number {
  let c = SPECIAL.baseChance * (zoneSite(zone)?.chanceMult ?? 1);
  for (const t of sectorTilts(state)) c *= t.chanceMult ?? 1;
  return Math.min(SPECIAL.maxChance, c * sensorMult(state));
}

/** Relative odds of each kind in a zone (for rolling and for the Map). */
export function kindWeights(state: GameState, zone: ZoneDef): Record<SpecialKind, number> {
  const site = zoneSite(zone);
  const tilts = sectorTilts(state);
  const out = {} as Record<SpecialKind, number>;
  for (const s of SPECIALS) {
    let w = s.weight * (site?.kinds?.[s.kind] ?? 1);
    for (const t of tilts) w *= t.kinds?.[s.kind] ?? 1;
    out[s.kind] = w;
  }
  return out;
}

function derelictWeights(state: GameState, zone: ZoneDef): Record<DerelictClass, number> {
  const site = zoneSite(zone);
  const tilts = sectorTilts(state);
  const out = {} as Record<DerelictClass, number>;
  for (const d of DERELICTS) {
    if (d.minDepth > state.sector.depth) {
      out[d.id] = 0;
      continue;
    }
    let w = d.weight * (site?.derelicts?.[d.id] ?? 1);
    for (const t of tilts) w *= t.derelicts?.[d.id] ?? 1;
    out[d.id] = w;
  }
  return out;
}

function pick<K extends string>(rng: Rng, weights: Record<K, number>): K {
  const entries = Object.entries(weights) as [K, number][];
  const total = entries.reduce((a, [, w]) => a + w, 0);
  let r = rng.next() * total;
  for (const [k, w] of entries) {
    r -= w;
    if (r <= 0) return k;
  }
  return entries[entries.length - 1][0];
}

/** The most valuable ore the drill can cut in this zone (or nearby). */
function bestOre(state: GameState, zone: ZoneDef): OreId {
  const here = ORE_IDS.filter((o) => (zone.composition[o] ?? 0) > 0 && oreReachable(state, o));
  return here.length ? here[here.length - 1] : 'ferrite';
}

/** Maybe turns the next rock special. Returns null for an ordinary rock. */
export function rollSpecial(state: GameState, rng: Rng, zone: ZoneDef): SpecialInfo | null {
  if (rng.next() >= specialChance(state, zone)) return null;
  const kind = pick(rng, kindWeights(state, zone));
  const info: SpecialInfo = { kind };
  if (kind === 'derelict') info.derelict = pick(rng, derelictWeights(state, zone));
  if (kind === 'cluster') {
    // One pure ore: something this zone has, now and then the next ore up.
    const here = ORE_IDS.filter((o) => (zone.composition[o] ?? 0) > 0 && oreReachable(state, o));
    const best = bestOre(state, zone);
    const up = ORE_IDS[ORE_IDS.indexOf(best) + 1];
    if (up && oreReachable(state, up) && rng.next() < 0.3) info.ore = up;
    else info.ore = here.length ? here[Math.floor(rng.next() * here.length)] : 'ferrite';
  }
  return info;
}

/** The ore mix of a special rock. */
export function specialComposition(state: GameState, info: SpecialInfo, base: OreAmounts): OreAmounts {
  const out = emptyOre();
  if (info.kind === 'cluster') {
    out[info.ore ?? 'ferrite'] = 1;
    return out;
  }
  if (info.kind === 'derelict') {
    // Hull plate: mostly Ferrite, with Titanite framing when the drill can cut it.
    if (oreReachable(state, 'titanite')) {
      out.ferrite = 0.6;
      out.titanite = 0.4;
    } else out.ferrite = 1;
    return out;
  }
  if (info.kind === 'ice_chunk' && oreReachable(state, 'helium3')) {
    for (const id of ORE_IDS) out[id] = base[id] * 0.4;
    out.helium3 += 0.6;
    return out;
  }
  return { ...base };
}

export function specialName(info: SpecialInfo): string {
  if (info.kind === 'derelict' && info.derelict) return `Derelict ${derelictDef(info.derelict).name}`;
  if (info.kind === 'cluster' && info.ore) return `${info.ore === 'helium3' ? 'Helium-3' : info.ore[0].toUpperCase() + info.ore.slice(1)} Cluster`;
  return specialDef(info.kind).name;
}

// ---------------------------------------------------------------- salvage

export interface Salvage {
  text: string;
  ore: OreAmounts;
  credits: number;
  surveyData: number;
  dataCores: number;
  drones: number;
  part?: string;
}

/** What one tonne of this zone's ore is worth right now. */
function zoneValue(state: GameState, zone: ZoneDef): number {
  let v = 0;
  for (const id of ORE_IDS) if (oreReachable(state, id)) v += (zone.composition[id] ?? 0) * orePrice(state, id);
  return Math.max(v, orePrice(state, 'ferrite'));
}

/** The extra reward when a special rock cracks (on top of the normal crack bonus). */
export function crackSalvage(state: GameState, a: AsteroidState, zone: ZoneDef, rng: Rng): Salvage {
  const info = a.special!;
  const s: Salvage = { text: '', ore: emptyOre(), credits: 0, surveyData: 0, dataCores: 0, drones: 0 };
  const sd = surveyDataPerCrack(state);
  const bits: string[] = [];
  switch (info.kind) {
    case 'geode': {
      const ore = bestOre(state, zone);
      s.ore[ore] = a.maxMass * 4;
      bits.push(`a geode full of ${ore === 'helium3' ? 'Helium-3' : ore} crystals`);
      if (rng.next() < 0.2) s.dataCores = 1;
      break;
    }
    case 'ice_chunk':
      s.surveyData = sd * 4;
      bits.push('comet ice full of survey readings');
      break;
    case 'derelict':
      switch (info.derelict) {
        case 'hauler':
          s.credits = a.maxMass * zoneValue(state, zone) * 4;
          bits.push('cargo manifest sold');
          break;
        case 'miner':
          for (const id of ORE_IDS) if (oreReachable(state, id)) s.ore[id] = a.maxMass * 2 * (zone.composition[id] ?? 0);
          s.drones = 2 + Math.floor(rng.next() * 4);
          bits.push(`a full ore bay and ${s.drones} working drones`);
          break;
        case 'science':
          s.surveyData = sd * 12;
          if (rng.next() < 0.35) s.dataCores = 1;
          bits.push('survey archives');
          break;
        case 'military':
          s.credits = a.maxMass * zoneValue(state, zone) * 2;
          s.dataCores = 1;
          bits.push('war bonds and a sealed Data Core');
          if (rng.next() < 0.35) {
            const unique = rng.next() < 0.15;
            const pool = PARTS.filter((p) => (unique ? p.rarity === 'unique' : p.rarity === 'standard' && !p.research));
            s.part = pool[Math.floor(rng.next() * pool.length)].id;
          }
          break;
        case 'ancient': {
          s.dataCores = 2 + Math.floor(rng.next() * 3);
          s.surveyData = sd * 20;
          bits.push('precursor star charts');
          const left = relicsLeft(state);
          if (left.length && rng.next() < 0.12) s.part = left[Math.floor(rng.next() * left.length)];
          break;
        }
      }
      break;
  }
  if (s.credits) bits.push(`+${Math.round(s.credits).toLocaleString()} cr`);
  if (s.surveyData) bits.push(`+${Math.round(s.surveyData)} Survey Data`);
  if (s.dataCores) bits.push(`+${s.dataCores} Data Core${s.dataCores > 1 ? 's' : ''}`);
  if (s.part) bits.push(`part: ${partDef(s.part).name}`);
  s.text = bits.join(' · ');
  return s;
}

/** Applies salvage (except ore, which the engine adds to the haul). */
export function applySalvage(state: GameState, s: Salvage): void {
  state.credits += s.credits;
  state.stats.creditsEarned += s.credits;
  state.surveyData += s.surveyData;
  state.dataCores += s.dataCores;
  state.drones.prospector += s.drones;
  if (s.part) state.parts[s.part] = (state.parts[s.part] ?? 0) + 1;
}

// ---------------------------------------------------------------- the Sensor Array upgrade

export function sensorArrayCost(state: GameState): number | null {
  const lvl = state.sensorArray ?? 0;
  if (lvl >= SPECIAL.arrayMaxLevel) return null;
  return Math.ceil(SPECIAL.arrayCostBase * SPECIAL.arrayCostGrowth ** lvl);
}

export function buySensorArray(state: GameState): boolean {
  const cost = sensorArrayCost(state);
  if (cost === null || state.credits < cost) return false;
  state.credits -= cost;
  state.sensorArray = (state.sensorArray ?? 0) + 1;
  return true;
}
