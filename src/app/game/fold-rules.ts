/**
 * The Fold Jump: charging the drive, Fold Resonance, the Jump Core and the
 * prestige reset that carries the core hull (and its crew) to a new sector.
 */
import { CORES } from './core-data';
import { carryStory, choice } from './story-rules';
import { DRONE_IDS } from './fleet-data';
import { OreId } from './config';
import { hasResearch, researchLevel } from './common';
import { FOLD, PERMANENT_NODES, coreDef } from './fold-data';
import { partDef } from './fleet-data';
import { destinationSeeds, generateSector } from './sector-rules';
import { THREAT } from './threat-data';
import { FoldState, GameState } from './types';
import { RESEARCH } from './research';
import { ensureAnomalies } from './anomaly-rules';
import { ensureTradeSector } from './trade-rules';
// Engine helpers (cyclic import, only used at call time).
import { newGame, oreRatio, spawnAsteroid, syncResearchEffects, syncSector } from './engine';

export function emptyFold(): FoldState {
  return {
    charge: 0,
    autoFeed: false,
    resonance: 0,
    lifetimeResonance: 0,
    jumps: 0,
    core: {},
    qolCounts: {},
    blueprints: [],
    runStartCredits: 0,
    archive: [],
    destination: 0,
    echoes: 0,
    deepFolds: 0,
  };
}

export function coreLevel(state: GameState, id: string): number {
  return state.fold?.core[id] ?? 0;
}

export function driveOnline(state: GameState): boolean {
  return hasResearch(state, 'fold_drive');
}

// ---------------------------------------------------------------- bonuses used elsewhere

/** Passive production from all Resonance ever earned. */
export function resonanceMult(state: GameState): number {
  const f = state.fold;
  return (1 + (f?.lifetimeResonance ?? 0) * FOLD.productionPerResonance) * (1 + (f?.echoes ?? 0) * FOLD.echoProduction);
}

/** Deeper sectors produce more (and their raids hit harder). */
export function depthMult(state: GameState): number {
  return 1 + state.sector.depth * FOLD.depthProduction;
}

export function depthRaidMult(state: GameState): number {
  return 1 + state.sector.depth * FOLD.depthRaids;
}

// ---------------------------------------------------------------- charging

/** Helium-3 units for a full charge in the current sector. */
export function chargeNeeded(state: GameState): number {
  return FOLD.baseCharge * FOLD.chargeGrowth ** state.sector.depth;
}

export function chargeEfficiency(state: GameState): number {
  return 1 + researchLevel(state, 'charge_efficiency') * FOLD.efficiencyPerLevel + coreLevel(state, 'core_harmonics') * FOLD.harmonicsPerLevel;
}

export function chargeCap(state: GameState): number {
  return 1 + researchLevel(state, 'overcharge_cap') * FOLD.overchargePerLevel;
}

/** Charge one Helium-3-equivalent unit adds. */
function perUnit(state: GameState): number {
  return chargeEfficiency(state) / chargeNeeded(state);
}

/** Helium-3 units an ore or ingot is worth as fuel (0 if it isn't fuel). */
export function fuelUnits(state: GameState, ore: OreId, ingot: boolean): number {
  const base = ore === 'helium3' ? 1 : ore === 'voidglass' ? FOLD.voidglassUnits : 0;
  return ingot ? base * oreRatio(state) : base;
}

/** Feed as much fuel from the hold as the drive will take. Returns charge added. */
export function feedDrive(state: GameState): number {
  if (!driveOnline(state)) return 0;
  const f = state.fold;
  const before = f.charge;
  const cap = chargeCap(state);
  const unit = perUnit(state);
  for (const ore of ['voidglass', 'helium3'] as OreId[]) {
    for (const ingot of [true, false]) {
      const value = fuelUnits(state, ore, ingot) * unit;
      if (!value || f.charge >= cap) continue;
      const held = ingot ? Math.floor(state.ingots[ore]) : state.cargo[ore];
      const take = Math.min(held, (cap - f.charge) / value);
      if (take <= 0) continue;
      if (ingot) state.ingots[ore] -= take;
      else state.cargo[ore] -= take;
      f.charge = Math.min(cap, f.charge + take * value);
    }
  }
  return f.charge - before;
}

export function useFoldCell(state: GameState): boolean {
  if (!driveOnline(state) || state.trade.inventory.fold_cell <= 0 || state.fold.charge >= chargeCap(state)) return false;
  state.trade.inventory.fold_cell--;
  state.fold.charge = Math.min(chargeCap(state), state.fold.charge + FOLD.cellCharge);
  return true;
}

export function advanceFold(state: GameState): void {
  if (state.fold.autoFeed) feedDrive(state);
}

// ---------------------------------------------------------------- resonance & the Jump Core

export function runCredits(state: GameState): number {
  return Math.max(0, state.stats.creditsEarned - state.fold.runStartCredits);
}

/** Resonance a jump right now would pay. */
export function resonanceGain(state: GameState): number {
  const over = Math.max(0, state.fold.charge - 1);
  const finale = choice(state) === 'break' ? 0.75 : choice(state) === 'master' ? 1.5 : 1;
  const echoes = 1 + (state.fold.echoes ?? 0) * FOLD.echoResonance;
  const resonator = 1 + researchLevel(state, 'core_resonator') * CORES.resonatorPerLevel;
  const raw =
    (runCredits(state) / FOLD.resonanceUnit) ** FOLD.resonanceExponent * FOLD.resonanceMult * (1 + FOLD.overchargeBonus * over * 4) * finale * echoes * resonator;
  return Math.max(1, Math.floor(raw));
}

export function coreCost(state: GameState, id: string): number | null {
  const def = coreDef(id);
  const lvl = coreLevel(state, id);
  if (lvl >= def.maxLevel) return null;
  return Math.ceil(def.cost * def.growth ** lvl);
}

export function buyCore(state: GameState, id: string): boolean {
  const cost = coreCost(state, id);
  if (cost === null || state.fold.resonance < cost) return false;
  state.fold.resonance -= cost;
  state.fold.core[id] = coreLevel(state, id) + 1;
  return true;
}

export function archiveSlots(state: GameState): number {
  return coreLevel(state, 'core_archive') + (choice(state) === 'break' ? 2 : 0);
}

/** Research nodes that will come along automatically (permanent after enough runs, plus the drive itself). */
export function permanentNodes(state: GameState): string[] {
  return PERMANENT_NODES.filter((id) => (state.fold.qolCounts[id] ?? 0) >= FOLD.permanentAfter);
}

/** Researched nodes the archive could keep (not already permanent). */
export function archivable(state: GameState): string[] {
  const perm = new Set([...permanentNodes(state), 'fold_drive']);
  return RESEARCH.filter((n) => !n.teaser && !perm.has(n.id) && (state.research.levels[n.id] ?? 0) > 0).map((n) => n.id);
}

export function toggleArchive(state: GameState, id: string): boolean {
  const f = state.fold;
  if (f.archive.includes(id)) {
    f.archive = f.archive.filter((x) => x !== id);
    return true;
  }
  if (f.archive.length >= archiveSlots(state) || !archivable(state).includes(id)) return false;
  f.archive.push(id);
  return true;
}

export function destinationCount(state: GameState): number {
  return FOLD.destinations + (coreLevel(state, 'core_sensors') >= 1 ? 1 : 0);
}

/** Traits shown per destination (the rest are static). */
export function revealedTraits(state: GameState): number {
  return 1 + coreLevel(state, 'core_sensors');
}

export function canJump(state: GameState): string | null {
  if (!driveOnline(state)) return 'Research the Fold Drive first';
  if (state.fold.charge < 1 - 1e-9) return 'The drive needs a full charge';
  return null;
}

// ---------------------------------------------------------------- Deep Fold

/** Echoes a Deep Fold would add (the whole Resonance layer converts). */
export function deepFoldGain(state: GameState): number {
  return Math.floor(Math.sqrt((state.fold.lifetimeResonance + resonanceGain(state)) / FOLD.echoUnit));
}

/** Why a Deep Fold can't happen yet, or null. */
export function canDeepFold(state: GameState): string | null {
  if (choice(state) !== 'master') return 'Only after Master the Cycle';
  if (state.sector.depth < FOLD.deepMinDepth) return `Reach depth ${FOLD.deepMinDepth}`;
  const jump = canJump(state);
  if (jump) return jump;
  if (deepFoldGain(state) < 1) return 'Not enough Resonance to echo';
  return null;
}

/** Starting credits from the Emergency Fund. */
function fundCredits(level: number): number {
  return level ? 5000 * 4 ** (level - 1) : 0;
}

// ---------------------------------------------------------------- the jump

export interface JumpResult {
  state: GameState;
  gained: number;
  /** Echoes from a Deep Fold (0 for an ordinary jump). */
  echoes: number;
  from: { code: string; name: string };
  to: { code: string; name: string };
  first: boolean;
}

/**
 * Fold to a new sector. Everything outside the core hull stays behind:
 * credits, cargo, drones, mechs, standard parts, most research. The crew,
 * Resonance, the Jump Core, blueprints, unique parts, reputation, standing,
 * the Codex, Data Cores and lifetime stats come along.
 */
export function foldJump(old: GameState, now = Date.now(), deep = false): JumpResult | null {
  if (canJump(old) !== null) return null;
  if (deep && canDeepFold(old) !== null) return null;
  const f = old.fold;
  const gained = resonanceGain(old);
  const echoes = deep ? deepFoldGain(old) : 0;
  const seeds = destinationSeeds(old, destinationCount(old));
  const seed = seeds[Math.min(f.destination, seeds.length - 1)];
  // A Deep Fold drops back to the first ring of sectors.
  const depth = deep ? 1 : old.sector.depth + 1;
  generateSector(seed, depth);

  // Research that survives: the drive, permanent QoL/infrastructure, and the archive.
  const qolCounts = { ...f.qolCounts };
  for (const id of PERMANENT_NODES) if ((old.research.levels[id] ?? 0) > 0) qolCounts[id] = (qolCounts[id] ?? 0) + 1;
  const keep: Record<string, number> = { fold_drive: 1 };
  for (const id of PERMANENT_NODES) if ((qolCounts[id] ?? 0) >= FOLD.permanentAfter) keep[id] = Math.max(1, old.research.levels[id] ?? 0);
  for (const id of f.archive) if (old.research.levels[id]) keep[id] = old.research.levels[id];

  // Unique parts (in storage or fitted) go to the Vault; standard parts stay behind.
  const vault: Record<string, number> = {};
  const isUnique = (id: string) => partDef(id).rarity !== 'standard';
  for (const [id, n] of Object.entries(old.parts)) if (n > 0 && isUnique(id)) vault[id] = (vault[id] ?? 0) + n;
  for (const m of old.mechs) for (const id of Object.values(m.parts)) if (id && isUnique(id)) vault[id] = (vault[id] ?? 0) + 1;
  const blueprints = [...new Set([...f.blueprints, ...old.mechs.map((m) => m.frame)])];

  const s = newGame(old.commander, old.ship, now, old.rng);
  s.createdAt = old.createdAt;
  s.playtimeSec = old.playtimeSec;
  s.rng = old.rng;
  s.nextId = old.nextId;
  s.stats = { ...old.stats };
  s.flags = { ...old.flags };
  s.dataCores = old.dataCores;
  s.matrix = { ...(old.matrix ?? {}) };
  s.parts = vault;

  // The crew comes along, healed by the fold; posts are on the core hull.
  s.pilots = old.pilots.map((p) => ({ ...p, injuredRemaining: 0 }));
  s.posts = { ...old.posts };
  s.bonds = [...old.bonds];
  s.recruits = [];

  // Reputation, standing, Codex, lore, stores.
  s.trade.rep = { ...old.trade.rep };
  s.trade.perks = [...old.trade.perks];
  // A research grant is paid for: it keeps running through the jump.
  s.trade.researchGrant = old.trade.researchGrant ?? 0;
  s.trade.inventory = { ...old.trade.inventory };
  s.trade.nextId = old.trade.nextId;
  s.contracts.standing = { ...old.contracts.standing };
  s.contracts.exclusives = [...old.contracts.exclusives];
  s.contracts.completed = old.contracts.completed;
  s.contracts.failed = old.contracts.failed;
  s.contracts.nextId = old.contracts.nextId;
  s.anomalies.codex = { ...old.anomalies.codex };
  s.anomalies.lore = old.anomalies.lore;
  s.anomalies.nextId = old.anomalies.nextId;

  // The Jackal follows you through the fold; your orders stay the same.
  s.threats.orders = { ...old.threats.orders };
  s.threats.jackalEncounters = old.threats.jackalEncounters;
  s.threats.jackalDefeats = old.threats.jackalDefeats;
  s.threats.captainRaids = old.threats.captainRaids ?? 0;
  s.threats.captains = { ...(old.threats.captains ?? {}) };
  s.threats.raids = old.threats.raids;
  s.threats.raidsWon = old.threats.raidsWon;
  s.threats.raidsLost = old.threats.raidsLost;
  s.threats.strikesWon = old.threats.strikesWon;
  s.threats.clock = Math.max(old.threats.clock, THREAT.graceSec); // no grace period after the first run

  // New sector.
  s.sector = { seed, depth, code: '', name: '', star: '', charted: 1, scan: null };
  s.research.levels = keep;
  // ARIA's settings and queue come along; she only works if her research did too.
  s.research.assistant = { ...old.research.assistant, queue: [...(old.research.assistant?.queue ?? [])] };

  // Fold state carries over, reset for the new run.
  s.fold = {
    ...f,
    charge: 0,
    resonance: f.resonance + gained,
    lifetimeResonance: f.lifetimeResonance + gained,
    jumps: f.jumps + 1,
    qolCounts,
    blueprints,
    runStartCredits: old.stats.creditsEarned,
    archive: [],
    destination: 0,
  };
  if (deep) {
    // The Resonance layer folds into Echoes.
    s.fold.resonance = 0;
    s.fold.lifetimeResonance = 0;
    s.fold.core = {};
    s.fold.echoes = (f.echoes ?? 0) + echoes;
    s.fold.deepFolds = (f.deepFolds ?? 0) + 1;
  }

  // Jump Core head starts.
  s.drones.prospector += 10 * coreLevel(s, 'core_drones');
  s.credits += fundCredits(coreLevel(s, 'core_credits'));
  const drill = coreLevel(s, 'core_drill');
  if (drill) s.drill.tier = 1 + drill;
  // The Trigger Clamp is part of the mech, not the sector: it comes along.
  s.drill.clamp = !!old.drill.clamp;
  // Booster settings stay on the core hull; it only runs if the research came along.
  s.booster = { ...old.booster, running: false, status: old.booster?.on ? 'idle' : 'off' };
  // Break the Cycle: gentler jumps keep a tenth of the drone fleet.
  if (choice(old) === 'break') for (const t of DRONE_IDS) s.drones[t] += Math.floor(old.drones[t] * 0.1);

  // Build the new sector: labels, zones, anomalies, local outfits, first asteroid.
  syncSector(s);
  s.anomalies.sectorKey = '';
  ensureAnomalies(s);
  ensureTradeSector(s);
  syncResearchEffects(s);
  carryStory(old, s, gained);
  s.asteroid = spawnAsteroid(s);

  return {
    state: s,
    gained: deep ? 0 : gained,
    echoes,
    from: { code: old.sector.code, name: old.sector.name },
    to: { code: s.sector.code, name: s.sector.name },
    first: f.jumps === 0,
  };
}
