/**
 * The Alloy Forge: one forge beside the furnaces. A batch takes one ingot of
 * each input per alloy, runs a little longer than a furnace batch, and its
 * output already has hold space set aside (it's smaller than what went in).
 */
import { ALLOY, ALLOY_IDS, AlloyDef, AlloyId, alloyDef } from './alloy-data';
import { hasResearch, oreReachable, researchLevel } from './common';
import { batchCapacity, batchDuration, earn, ingotPrice, marketMultiplier, oreRatio } from './engine';
import { marketBlocked } from './threat-rules';
import { AlloyForge, GameState } from './types';

export function emptyAlloys(): Record<AlloyId, number> {
  return { duralloy: 0, iridsteel: 0, cryoplate: 0, nullsteel: 0 };
}

export function emptyAlloyFlags(): Record<AlloyId, boolean> {
  return { duralloy: false, iridsteel: false, cryoplate: false, nullsteel: false };
}

export function emptyForge(): AlloyForge {
  return { alloy: null, batch: 0, remaining: 0, duration: 0, repeat: false };
}

export function hasForge(state: GameState): boolean {
  return hasResearch(state, 'alloys');
}

/** A recipe is open once the drill can reach both of its ores. */
export function recipeOpen(state: GameState, a: AlloyDef): boolean {
  return a.inputs.every((o) => oreReachable(state, o));
}

/** Most alloys one forge batch makes: as many ingots as one furnace batch yields. */
export function forgeCapacity(state: GameState): number {
  return Math.max(1, Math.floor(batchCapacity(state) / oreRatio(state)));
}

export function forgeDuration(state: GameState): number {
  return batchDuration(state) * ALLOY.durationMult;
}

export function alloyValueMult(state: GameState): number {
  return ALLOY.valueMult + researchLevel(state, 'crucible_lining') * ALLOY.liningPerLevel;
}

export function alloyPrice(state: GameState, id: AlloyId): number {
  const [a, b] = alloyDef(id).inputs;
  return (ingotPrice(state, a) + ingotPrice(state, b)) * alloyValueMult(state);
}

/** Alloys a batch could make right now from the ingots in the hold. */
export function forgeable(state: GameState, id: AlloyId): number {
  const [a, b] = alloyDef(id).inputs;
  return Math.min(forgeCapacity(state), Math.floor(state.ingots[a]), Math.floor(state.ingots[b]));
}

/** Alloys in the forge, which already have hold space set aside. */
export function forgeReserved(state: GameState): number {
  return state.forge.batch;
}

function loadForge(state: GameState): boolean {
  const f = state.forge;
  if (!f.alloy) return false;
  const n = forgeable(state, f.alloy);
  if (n < 1) return false;
  const [a, b] = alloyDef(f.alloy).inputs;
  state.ingots[a] -= n;
  state.ingots[b] -= n;
  f.batch = n;
  f.duration = forgeDuration(state);
  f.remaining = f.duration;
  return true;
}

/** Sets the forge to an alloy and starts a batch from the hold's ingots. */
export function startForge(state: GameState, id: AlloyId): boolean {
  const f = state.forge;
  if (!hasForge(state) || f.batch > 0 || !recipeOpen(state, alloyDef(id))) return false;
  f.alloy = id;
  return loadForge(state);
}

export function setForgeRepeat(state: GameState, repeat: boolean): boolean {
  if (!hasForge(state) || !hasResearch(state, 'auto_refine')) return false;
  state.forge.repeat = repeat;
  if (repeat && state.forge.alloy && state.forge.batch === 0) loadForge(state);
  return true;
}

/** Clears an idle forge's recipe. A running batch finishes first. */
export function clearForge(state: GameState): boolean {
  const f = state.forge;
  if (f.batch > 0) return false;
  f.alloy = null;
  f.repeat = false;
  return true;
}

/** Runs the forge for dt seconds. Returns the alloys finished. */
export function advanceForge(state: GameState, dt: number): number {
  const f = state.forge;
  let made = 0;
  let left = dt;
  while (left > 0) {
    if (f.batch <= 0) {
      if (!(f.repeat && hasResearch(state, 'auto_refine') && loadForge(state))) break;
    }
    const step = Math.min(left, f.remaining);
    f.remaining -= step;
    left -= step;
    if (f.remaining <= 1e-9 && f.alloy) {
      state.alloys[f.alloy] += f.batch;
      state.stats.alloysForged += f.batch;
      made += f.batch;
      f.batch = 0;
      f.remaining = 0;
    }
  }
  return made;
}

// ---------------------------------------------------------------- selling

export function sellAlloy(state: GameState, id: AlloyId): number {
  if (marketBlocked(state)) return 0;
  const n = Math.floor(state.alloys[id]);
  if (n <= 0) return 0;
  const credits = n * alloyPrice(state, id);
  state.alloys[id] -= n;
  earn(state, credits);
  return credits;
}

export function sellAllAlloys(state: GameState): number {
  return ALLOY_IDS.reduce((sum, id) => sum + sellAlloy(state, id), 0);
}

/** Auto-sells flagged alloys. Smart Sell waits while their two ores average below par. */
export function autoSellAlloys(state: GameState, smart: boolean): number {
  let total = 0;
  for (const id of ALLOY_IDS) {
    if (!state.autoSell.alloy[id]) continue;
    const [a, b] = alloyDef(id).inputs;
    if (smart && marketMultiplier(state.marketClock, a) + marketMultiplier(state.marketClock, b) < 2) continue;
    total += sellAlloy(state, id);
  }
  return total;
}

export function toggleAutoSellAlloy(state: GameState, id: AlloyId): boolean {
  if (!hasResearch(state, 'auto_sell')) return false;
  state.autoSell.alloy[id] = !state.autoSell.alloy[id];
  return true;
}
