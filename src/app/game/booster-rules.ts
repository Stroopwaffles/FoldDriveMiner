/**
 * The Hyperthought Engine: a research booster on the Ops deck. Switched on, it burns Survey Data
 * every second a research job is running and speeds the Lab up in return. It idles when the Lab
 * is empty, never burns below the reserve you set, and stalls (no bonus) when it can't pay.
 */
import { researchLevel } from './common';
import { GameState } from './types';

export const BOOSTER = {
  /** Research speed per Hyperthought level while it runs. */
  bonusPerLevel: 0.3,
  /** Survey Data per second per level, before sector depth. */
  burnPerLevel: 0.1,
  /** Deeper sectors pay more Survey Data, so the engine burns more. */
  depthScale: 0.5,
  /** Reserve presets: the engine never burns below this. */
  reserves: [0, 50, 250, 1000, 5000],
};

export interface BoosterState {
  on: boolean;
  /** Survey Data the engine leaves alone. */
  reserve: number;
  /** Paid for and boosting this tick (false when idle or starved). */
  running: boolean;
  /** Why it isn't running, for the Ops card. */
  status: 'off' | 'idle' | 'starved' | 'running';
  /** Lifetime Survey Data burned. */
  burned: number;
}

export function emptyBooster(): BoosterState {
  return { on: false, reserve: 0, running: false, status: 'off', burned: 0 };
}

export function boosterLevel(state: GameState): number {
  return researchLevel(state, 'hyperthought');
}

/** Research speed bonus while running (0.3 = +30%). */
export function boosterBonus(state: GameState): number {
  return boosterLevel(state) * BOOSTER.bonusPerLevel;
}

/** Survey Data per second while running. */
export function boosterBurn(state: GameState): number {
  return boosterLevel(state) * BOOSTER.burnPerLevel * (1 + state.sector.depth * BOOSTER.depthScale);
}

/** Bonus to research speed right now (0 unless it paid this tick). */
export function boosterActiveBonus(state: GameState): number {
  return state.booster?.running ? boosterBonus(state) : 0;
}

export function setBooster(state: GameState, on: boolean): boolean {
  if (on && boosterLevel(state) <= 0) return false;
  state.booster.on = on;
  if (!on) {
    state.booster.running = false;
    state.booster.status = 'off';
  }
  return true;
}

/** Steps to the next reserve preset (wrapping). */
export function cycleReserve(state: GameState): number {
  const list = BOOSTER.reserves;
  const i = list.indexOf(state.booster.reserve);
  state.booster.reserve = list[(i + 1) % list.length];
  return state.booster.reserve;
}

/** Runs before research advances: pays for this tick, or stalls. */
export function advanceBooster(state: GameState, dt: number): void {
  const b = state.booster;
  if (!b.on || boosterLevel(state) <= 0) {
    b.running = false;
    b.status = 'off';
    return;
  }
  if (!state.research.active.length) {
    b.running = false;
    b.status = 'idle';
    return;
  }
  const cost = boosterBurn(state) * dt;
  if (state.surveyData - cost < b.reserve) {
    b.running = false;
    b.status = 'starved';
    return;
  }
  state.surveyData -= cost;
  b.burned += cost;
  b.running = true;
  b.status = 'running';
}
