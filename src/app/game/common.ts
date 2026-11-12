/** Small helpers shared by every rules module. */
import { ORE_IDS, OreId, ZoneDef, ZoneId, oreDef, zoneDef } from './config';
import { GameState, OreAmounts, OreFlags } from './types';
import { ANOMALY } from './anomaly-data';

export function emptyOre(): OreAmounts {
  return { ferrite: 0, titanite: 0, iridium: 0, helium3: 0, voidglass: 0 };
}

export function emptyFlags(): OreFlags {
  return { ferrite: false, titanite: false, iridium: false, helium3: false, voidglass: false };
}

export function sumOre(a: OreAmounts): number {
  return ORE_IDS.reduce((s, id) => s + a[id], 0);
}

export function addOre(into: OreAmounts, from: OreAmounts, scale = 1): void {
  for (const id of ORE_IDS) into[id] += from[id] * scale;
}

export function researchLevel(state: GameState, id: string): number {
  return state.research.levels[id] ?? 0;
}

export function hasResearch(state: GameState, id: string): boolean {
  return researchLevel(state, id) > 0;
}

export function currentZone(state: GameState): ZoneDef {
  return zoneDef(state.zone);
}

export function zoneUnlocked(state: GameState, id: ZoneId): boolean {
  // Zones open as sector scans chart them, inner to outer.
  return zoneDef(id).index < Math.max(1, state.sector?.charted ?? 1);
}

/** Research that refits the drill, and the tier each one gives. */
export const DRILL_RESEARCH: readonly { id: string; tier: number }[] = [
  { id: 'drill_mk3', tier: 3 },
  { id: 'drill_mk4', tier: 4 },
  { id: 'drill_mk5', tier: 5 },
];

/**
 * The drill's working tier. `state.drill.tier` only holds what was bought with credits (Mk.II)
 * or given by the Jump Core; Drill Mk research counts for as long as it's researched, so
 * research kept through a Fold Jump (archive, permanent nodes) can never fall out of step.
 */
export function drillTier(state: GameState): number {
  let tier = state.drill.tier;
  for (const r of DRILL_RESEARCH) if (r.tier > tier && hasResearch(state, r.id)) tier = r.tier;
  return tier;
}

/** Can the drill (and drones and mechs) collect this ore? */
export function oreReachable(state: GameState, ore: OreId): boolean {
  return oreDef(ore).tier <= drillTier(state);
}

/** Splits an ore/s total by a zone's mix, dropping ores the drill can't reach. */
export function splitByZone(state: GameState, zone: ZoneDef, total: number, into: OreAmounts, weightByTier = false): void {
  let norm = 0;
  const weights = emptyOre();
  for (const id of ORE_IDS) {
    const share = zone.composition[id] ?? 0;
    // Cutters lean hard toward high tiers but only within what they can reach.
    const w = weightByTier ? (oreReachable(state, id) ? share * oreDef(id).tier ** 3 : 0) : share;
    weights[id] = w;
    norm += w;
  }
  if (norm <= 0) return;
  for (const id of ORE_IDS) {
    if (!oreReachable(state, id)) continue;
    into[id] += weightByTier ? (total * weights[id]) / norm : total * weights[id];
  }
}

export function nextId(state: GameState): number {
  return state.nextId++;
}

/** Comet Pass: a tracked comet doubles production in its zone. */
export function zoneBoost(state: GameState, zone: ZoneId): number {
  const list = state.anomalies?.list ?? [];
  return list.some((a) => a.kind === 'comet' && a.status === 'active' && a.zone === zone) ? ANOMALY.cometMult : 1;
}
