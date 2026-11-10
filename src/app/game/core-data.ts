/**
 * What Data Cores buy: rushing research, core-gated research nodes (see
 * research.ts), legendary parts from merchants, and the Core Matrix, a set of
 * small permanent bonuses that survive every Fold Jump.
 */
import { BonusKind } from './medal-data';

export interface MatrixDef {
  id: string;
  name: string;
  /** Feeds the same permanent bonus pools as commendations. */
  kind: BonusKind;
  /** Bonus per level (0.05 = +5%). */
  perLevel: number;
  maxLevel: number;
  /** Data Cores for level 1; each later level costs one more. */
  cost: number;
  flavor: string;
}

export const MATRIX: readonly MatrixDef[] = [
  { id: 'm_drill', name: 'Core-Tuned Drill', kind: 'drill', perLevel: 0.05, maxLevel: 10, cost: 2, flavor: 'The cores remember every rock they came from.' },
  { id: 'm_production', name: 'Core Uplink', kind: 'production', perLevel: 0.03, maxLevel: 10, cost: 2, flavor: 'Drone swarms route through the lattice. Fewer wasted trips.' },
  { id: 'm_sell', name: 'Core Ledger', kind: 'sell', perLevel: 0.02, maxLevel: 10, cost: 3, flavor: 'Old price records. Knowing what buyers paid before is worth a lot.' },
  { id: 'm_research', name: 'Core Cache', kind: 'research', perLevel: 0.05, maxLevel: 10, cost: 3, flavor: 'VESPER borrows the cores to think. She says thank you.' },
  { id: 'm_xp', name: 'Core Sims', kind: 'xp', perLevel: 0.05, maxLevel: 10, cost: 2, flavor: 'Combat recordings from pilots long gone. The crew trains on them.' },
];

export function matrixDef(id: string): MatrixDef {
  return MATRIX.find((m) => m.id === id)!;
}

export const CORES = {
  /** Rushing a research project: one core per this many seconds left (at least 1). */
  rushSecPerCore: 600,
  rushMaxCores: 12,
  /** Chance a merchant convoy brings one legendary part, priced in cores. */
  relicChance: 0.6,
  relicPriceMin: 4,
  relicPriceMax: 7,
  /** Core Lattice research: each level adds this share of the base crack chance. */
  latticePerLevel: 0.5,
  /** Core Decryption research: Survey Data bonus per level. */
  decryptionPerLevel: 0.2,
  /** Core Resonator research: Resonance bonus per level. */
  resonatorPerLevel: 0.1,
};

/** Legendary parts: only sold by merchants, only for Data Cores. Kept through Fold Jumps. */
export const RELIC_PARTS = ['ancestor_bore', 'lattice_aegis', 'fold_heart', 'oracle_eye', 'comet_thrusters'];
