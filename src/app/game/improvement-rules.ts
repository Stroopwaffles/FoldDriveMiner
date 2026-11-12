/**
 * Sector improvements: which are built here, what they add up to, and what a construction
 * contract needs. The contract itself (accept, deadline, reward) lives in trade-rules.ts.
 */
import { ALLOY_IDS, AlloyId, alloyDef } from './alloy-data';
import { hasForge, recipeOpen } from './alloy-rules';
import { hasResearch, oreReachable } from './common';
import { ORE_IDS, OreId } from './config';
import { IMPROVEMENT, IMPROVEMENTS, ImprovementDef, ImprovementId, ImprovementKind } from './improvement-data';
import { CorpId } from './trade-data';
import { Contract, GameState } from './types';
// Engine helpers (cyclic import, only used at call time).
import { batchCapacity, oreRatio } from './engine';

function sectorKey(state: GameState): string {
  return `${state.sector.seed}:${state.sector.depth}`;
}

/** Improvements built in the current sector. */
export function builtHere(state: GameState): ImprovementId[] {
  const imp = state.improvements;
  return imp && imp.key === sectorKey(state) ? imp.built : [];
}

/** Total bonus of one kind from this sector's improvements (0.2 = +20%). */
export function improvementBonus(state: GameState, kind: ImprovementKind): number {
  let total = 0;
  for (const id of builtHere(state)) total += IMPROVEMENTS.find((i) => i.id === id)?.bonus[kind] ?? 0;
  return total;
}

/** Whether this sector's materials are within reach: every ore reachable, every alloy forgeable. */
export function materialsReachable(state: GameState, def: ImprovementDef): boolean {
  const ores = Object.keys(def.ingots) as OreId[];
  const alloys = Object.keys(def.alloys) as AlloyId[];
  if (ores.length && !hasResearch(state, 'refinery')) return false;
  if (!ores.every((o) => oreReachable(state, o))) return false;
  if (alloys.length && !hasForge(state)) return false;
  return alloys.every((a) => recipeOpen(state, alloyDef(a)));
}

/** Improvements a corporation could commission here: not built yet, not already contracted, and buildable. */
export function constructionOptions(state: GameState, corp: CorpId): ImprovementDef[] {
  const built = new Set(builtHere(state));
  const taken = new Set([...state.contracts.board, ...state.contracts.active].map((c) => c.improvement).filter(Boolean));
  return IMPROVEMENTS.filter((d) => d.corps.includes(corp) && !built.has(d.id) && !taken.has(d.id) && materialsReachable(state, d));
}

/** How many ingots/alloys one material "unit" is right now: about one furnace batch. */
export function materialUnit(state: GameState): number {
  return Math.max(5, Math.round(batchCapacity(state) / oreRatio(state)));
}

/** The exact materials a construction contract asks for (frozen when the contract is made). */
export function materialsFor(state: GameState, def: ImprovementDef): NonNullable<Contract['materials']> {
  const unit = materialUnit(state);
  const ingots: Partial<Record<OreId, number>> = {};
  const alloys: Partial<Record<AlloyId, number>> = {};
  for (const o of ORE_IDS) if (def.ingots[o]) ingots[o] = Math.ceil(def.ingots[o]! * unit);
  for (const a of ALLOY_IDS) if (def.alloys[a]) alloys[a] = Math.ceil(def.alloys[a]! * unit);
  return { ingots, alloys };
}

/** What building actually costs: the Colonial Trust's perk trims it. */
export function buildCost(state: GameState, c: Contract): NonNullable<Contract['materials']> {
  const m = c.materials ?? { ingots: {}, alloys: {} };
  const k = corpTrusts(state, 'colonial') ? IMPROVEMENT.colonialDiscount : 1;
  const ingots: Partial<Record<OreId, number>> = {};
  const alloys: Partial<Record<AlloyId, number>> = {};
  for (const [o, n] of Object.entries(m.ingots ?? {})) ingots[o as OreId] = Math.ceil(n! * k);
  for (const [a, n] of Object.entries(m.alloys ?? {})) alloys[a as AlloyId] = Math.ceil(n! * k);
  return { ingots, alloys };
}

function corpTrusts(state: GameState, corp: CorpId): boolean {
  return (state.contracts.standing[corp] ?? 0) >= 8;
}

/** Why it can't be built yet (missing materials), or null. */
export function buildBlocker(state: GameState, c: Contract): string | null {
  const cost = buildCost(state, c);
  for (const [o, n] of Object.entries(cost.ingots)) {
    if (Math.floor(state.ingots[o as OreId]) < n!) return `Need ${n} ${o} ingots`;
  }
  for (const [a, n] of Object.entries(cost.alloys)) {
    if (Math.floor(state.alloys[a as AlloyId] ?? 0) < n!) return `Need ${n} ${alloyDef(a as AlloyId).name}`;
  }
  return null;
}

/** Spends the materials and adds the improvement to this sector. */
export function construct(state: GameState, c: Contract): boolean {
  if (!c.improvement || buildBlocker(state, c) !== null) return false;
  const cost = buildCost(state, c);
  for (const [o, n] of Object.entries(cost.ingots)) state.ingots[o as OreId] -= n!;
  for (const [a, n] of Object.entries(cost.alloys)) state.alloys[a as AlloyId] -= n!;
  const key = sectorKey(state);
  if (!state.improvements || state.improvements.key !== key) state.improvements = { key, built: [] };
  if (!state.improvements.built.includes(c.improvement)) state.improvements.built.push(c.improvement);
  return true;
}
