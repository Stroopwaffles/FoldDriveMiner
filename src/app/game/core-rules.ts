/**
 * Spending Data Cores: rushing research, the Core Matrix, and the legendary
 * parts merchants sell for cores.
 */
import { CORES, MATRIX, MatrixDef, RELIC_PARTS, matrixDef } from './core-data';
import { BonusKind } from './medal-data';
import { partDef } from './fleet-data';
import { Rng } from './rng';
import { GameState, ResearchJob, StockItem } from './types';

// ---------------------------------------------------------------- Core Matrix

export function matrixLevel(state: GameState, id: string): number {
  return state.matrix?.[id] ?? 0;
}

/** Cores for the next level, or null at max. */
export function matrixCost(state: GameState, id: string): number | null {
  const def = matrixDef(id);
  const lvl = matrixLevel(state, id);
  if (lvl >= def.maxLevel) return null;
  return def.cost + lvl;
}

export function buyMatrix(state: GameState, id: string): boolean {
  const cost = matrixCost(state, id);
  if (cost === null || state.dataCores < cost) return false;
  state.dataCores -= cost;
  state.matrix[id] = matrixLevel(state, id) + 1;
  return true;
}

/** Total Core Matrix bonus of one kind (0.1 = +10%). */
export function matrixBonus(state: GameState, kind: BonusKind): number {
  let total = 0;
  for (const m of MATRIX) if (m.kind === kind) total += matrixLevel(state, m.id) * m.perLevel;
  return total;
}

export function matrixEffect(m: MatrixDef, level: number): string {
  const pct = Math.round(m.perLevel * level * 100);
  const what = { drill: 'drill power', production: 'drone & mech output', sell: 'sell prices', research: 'research speed', xp: 'pilot XP' }[m.kind];
  return `+${pct}% ${what}`;
}

// ---------------------------------------------------------------- rushing research

/** Cores to finish a research job now: one per 10 minutes left, at least one. */
export function rushCost(job: ResearchJob): number {
  return Math.min(CORES.rushMaxCores, Math.max(1, Math.ceil(job.remaining / CORES.rushSecPerCore)));
}

/** Finishes a running research job on the next tick. */
export function rushResearch(state: GameState, index: number): boolean {
  const job = state.research.active[index];
  if (!job || job.remaining <= 0) return false;
  const cost = rushCost(job);
  if (state.dataCores < cost) return false;
  state.dataCores -= cost;
  job.remaining = 0;
  return true;
}

// ---------------------------------------------------------------- legendary parts

/** Legendary parts the player doesn't own yet (in storage or fitted). */
export function relicsLeft(state: GameState): string[] {
  const fitted = new Set(state.mechs.flatMap((m) => Object.values(m.parts)));
  return RELIC_PARTS.filter((id) => !(state.parts[id] > 0) && !fitted.has(id));
}

/** A legendary part for a convoy's stock, priced only in Data Cores. */
export function makeRelic(state: GameState, rng: Rng, id: number): StockItem | null {
  const left = relicsLeft(state);
  if (!left.length || rng.next() >= CORES.relicChance) return null;
  const partId = left[Math.floor(rng.next() * left.length)];
  const p = partDef(partId);
  const stats = Object.entries(p.stats)
    .filter(([, v]) => v)
    .map(([k, v]) => `${(v as number) > 0 ? '+' : ''}${v} ${k}`);
  if (p.supply) stats.push(`+${p.supply} power`);
  const span = CORES.relicPriceMax - CORES.relicPriceMin + 1;
  return {
    id,
    kind: 'relic',
    label: p.name,
    desc: `Legendary part, kept through Fold Jumps. ${stats.join(', ')}`,
    price: 0,
    dataCores: CORES.relicPriceMin + Math.floor(rng.next() * span),
    partId,
    sold: false,
  };
}
