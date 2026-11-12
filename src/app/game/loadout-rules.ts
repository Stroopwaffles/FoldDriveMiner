/**
 * Loadout Memory: save a mech's build (frame, parts and optionally its pilot,
 * job and zone) and rebuild it later, usually after a Fold Jump. Rebuilding
 * only ever spends credits: it uses parts in storage first and buys the
 * missing standard parts; unique parts must already be in the Vault.
 */
import { hasResearch, zoneUnlocked } from './common';
import { isInjured, pilotById, pilotMech, pilotPost } from './crew-rules';
import { FrameId, PartDef, SLOTS, SlotId, frameDef, partDef } from './fleet-data';
import { buildMech, buyPart, equipPart, hangarBays, mechBuildCost, mechById, mechOperable, seatPilot, setMechJob, setMechZone } from './fleet-rules';
import { researchNode } from './research';
import { GameState, LoadoutsState, MechState, SavedLoadout } from './types';

export const LOADOUT = {
  /** Most loadouts the core will remember. */
  maxSaved: 8,
  maxName: 24,
};

/** Reactors first so power-hungry parts never leave a half-built mech overloaded. */
const FIT_ORDER: SlotId[] = ['reactor', ...SLOTS.map((s) => s.id).filter((id) => id !== 'reactor')];

export function loadoutsUnlocked(state: GameState): boolean {
  return hasResearch(state, 'loadout_memory');
}

function store(state: GameState): LoadoutsState {
  state.loadouts ??= { saved: [], auto: false, pending: false, nextId: 1 };
  return state.loadouts;
}

export function loadoutById(state: GameState, id: number): SavedLoadout | null {
  return store(state).saved.find((l) => l.id === id) ?? null;
}

/** The mech a loadout is built as right now, if it's still in the hangar. */
export function loadoutMech(state: GameState, l: SavedLoadout): MechState | null {
  if (l.mechId === null) return null;
  const m = mechById(state, l.mechId);
  return m && m.frame === l.frame ? m : null;
}

/** The saved loadout linked to a mech, if any. */
export function mechLoadout(state: GameState, mechId: number): SavedLoadout | null {
  return store(state).saved.find((l) => l.mechId === mechId) ?? null;
}

function safePart(id: string): PartDef | null {
  try {
    return partDef(id);
  } catch {
    return null;
  }
}

/**
 * Saves (or, if this mech already has one, updates) a loadout from a mech.
 * With `crew`, the pilot, job and zone are remembered too.
 */
export function saveLoadout(state: GameState, mechId: number, crew = true, name?: string): SavedLoadout | null {
  if (!loadoutsUnlocked(state)) return null;
  const mech = mechById(state, mechId);
  if (!mech) return null;
  const lo = store(state);
  const existing = mechLoadout(state, mechId);
  if (!existing && lo.saved.length >= LOADOUT.maxSaved) return null;
  const job = mech.job === 'mining' || mech.job === 'defense' ? mech.job : mech.returnJob === 'mining' || mech.returnJob === 'defense' ? mech.returnJob : 'idle';
  const l: SavedLoadout = existing ?? {
    id: lo.nextId++,
    name: cleanName(name) ?? `${mech.name} ${frameDef(mech.frame).name}`.slice(0, LOADOUT.maxName),
    frame: mech.frame,
    parts: {},
    pilotId: null,
    job: 'idle',
    zone: null,
    mechId: mech.id,
  };
  l.frame = mech.frame;
  l.parts = { ...mech.parts };
  l.pilotId = crew ? mech.pilotId : null;
  l.job = crew ? job : 'idle';
  l.zone = crew ? mech.zone : null;
  if (existing && name) l.name = cleanName(name) ?? l.name;
  if (!existing) lo.saved.push(l);
  return l;
}

function cleanName(name: string | undefined): string | null {
  const n = (name ?? '').trim().slice(0, LOADOUT.maxName);
  return n ? n : null;
}

export function renameLoadout(state: GameState, id: number, name: string): boolean {
  const l = loadoutById(state, id);
  const n = cleanName(name);
  if (!l || !n) return false;
  l.name = n;
  return true;
}

export function deleteLoadout(state: GameState, id: number): boolean {
  const lo = store(state);
  const before = lo.saved.length;
  lo.saved = lo.saved.filter((l) => l.id !== id);
  return lo.saved.length < before;
}

export function setAutoRebuild(state: GameState, on: boolean): boolean {
  if (!loadoutsUnlocked(state)) return false;
  const lo = store(state);
  lo.auto = on;
  if (!on) lo.pending = false;
  return true;
}

// ---------------------------------------------------------------- cost

export interface RebuildCost {
  /** Credits to buy the frames and missing standard parts. */
  credits: number;
  /** Frames that would be built. */
  frames: number;
  /** Parts that would be bought, and parts taken from storage. */
  buy: string[];
  fromStores: string[];
  /** Things a rebuild can't do with credits (locked, unique and missing, no bay). */
  blocked: string[];
}

/**
 * What rebuilding these loadouts would cost, sharing storage between them
 * the way a real Rebuild All would.
 */
export function rebuildCost(state: GameState, ids?: number[]): RebuildCost {
  const out: RebuildCost = { credits: 0, frames: 0, buy: [], fromStores: [], blocked: [] };
  const stores = { ...state.parts };
  let freeBays = Math.max(0, hangarBays(state) - state.mechs.length);
  for (const l of store(state).saved) {
    if (ids && !ids.includes(l.id)) continue;
    const mech = loadoutMech(state, l);
    if (!mech) {
      if (freeBays <= 0) {
        out.blocked.push(`${l.name}: no free hangar bay`);
        continue;
      }
      freeBays--;
      out.frames++;
      out.credits += mechBuildCost(state, l.frame);
    }
    for (const slot of FIT_ORDER) {
      const id = l.parts[slot];
      if (!id || mech?.parts[slot] === id) continue;
      const p = safePart(id);
      if (!p) {
        out.blocked.push(`${l.name}: unknown part`);
      } else if ((stores[id] ?? 0) > 0) {
        stores[id]--;
        out.fromStores.push(p.name);
      } else if (p.rarity !== 'standard') {
        out.blocked.push(`${l.name}: ★ ${p.name} isn't in the Vault`);
      } else if (p.research && !hasResearch(state, p.research)) {
        out.blocked.push(`${l.name}: ${p.name} needs ${researchNode(p.research).name}`);
      } else {
        out.buy.push(p.name);
        out.credits += p.cost;
      }
    }
  }
  return out;
}

// ---------------------------------------------------------------- rebuild

export interface RebuildReport {
  /** Loadouts that got a new frame. */
  built: string[];
  /** Parts fitted (from storage or bought). */
  fitted: number;
  bought: number;
  spent: number;
  /** What couldn't be done and why. */
  issues: string[];
}

function emptyReport(): RebuildReport {
  return { built: [], fitted: 0, bought: 0, spent: 0, issues: [] };
}

/** Builds (or refits) one saved loadout as far as credits allow. */
export function rebuildLoadout(state: GameState, id: number, report = emptyReport()): RebuildReport {
  const l = loadoutById(state, id);
  if (!l) return report;
  if (!loadoutsUnlocked(state)) {
    report.issues.push('Research Loadout Memory first');
    return report;
  }
  const start = state.credits;
  let mech = loadoutMech(state, l);
  if (!mech) {
    if (state.mechs.length >= hangarBays(state)) {
      report.issues.push(`${l.name}: no free hangar bay`);
      return report;
    }
    const cost = mechBuildCost(state, l.frame);
    mech = buildMech(state, l.frame);
    if (!mech) {
      report.issues.push(`${l.name}: can't afford the ${frameDef(l.frame).name} frame (${Math.ceil(cost).toLocaleString('en-US')} cr)`);
      return report;
    }
    l.mechId = mech.id;
    report.built.push(l.name);
  }

  for (const slot of FIT_ORDER) {
    const want = l.parts[slot];
    if (!want || mech.parts[slot] === want) continue;
    const p = safePart(want);
    if (!p) {
      report.issues.push(`${l.name}: a saved part no longer exists`);
      continue;
    }
    if ((state.parts[want] ?? 0) <= 0) {
      if (p.rarity !== 'standard') {
        report.issues.push(`${l.name}: ★ ${p.name} is unique and isn't in the Vault`);
        continue;
      }
      if (p.research && !hasResearch(state, p.research)) {
        report.issues.push(`${l.name}: ${p.name} is locked (needs ${researchNode(p.research).name})`);
        continue;
      }
      if (!buyPart(state, want)) {
        report.issues.push(`${l.name}: couldn't afford ${p.name} (${p.cost.toLocaleString('en-US')} cr)`);
        continue;
      }
      report.bought++;
    }
    if (equipPart(state, mech.id, slot, want)) report.fitted++;
  }

  // Crew and orders, if they were saved. Never pull a pilot out of another mech or a post.
  if (l.pilotId !== null && mech.pilotId !== l.pilotId) {
    const p = pilotById(state, l.pilotId);
    const other = p ? pilotMech(state, p) : null;
    if (!p) report.issues.push(`${l.name}: the saved pilot is no longer on the roster`);
    else if (isInjured(p)) report.issues.push(`${l.name}: ${p.callsign} is injured`);
    else if (other && other.id !== mech.id) report.issues.push(`${l.name}: ${p.callsign} is flying ${other.designation}`);
    else if (pilotPost(state, p)) report.issues.push(`${l.name}: ${p.callsign} is on a station post`);
    else seatPilot(state, mech.id, p.id);
  }
  if (l.zone && l.zone !== mech.zone) {
    if (zoneUnlocked(state, l.zone)) setMechZone(state, mech.id, l.zone);
    else if (l.job === 'mining') report.issues.push(`${l.name}: its saved zone isn't charted here, so it mines the current zone`);
  }
  if (l.job !== 'idle' && mech.job === 'idle') {
    if (!mechOperable(state, mech) || !setMechJob(state, mech.id, l.job)) {
      report.issues.push(`${l.name}: can't launch yet (missing power or parts)`);
    }
  }
  report.spent += start - state.credits;
  return report;
}

/** Rebuilds every saved loadout in order. */
export function rebuildAll(state: GameState): RebuildReport {
  const report = emptyReport();
  for (const l of [...store(state).saved]) rebuildLoadout(state, l.id, report);
  return report;
}

/** Loadouts that aren't built as a mech right now. */
export function unbuiltLoadouts(state: GameState): SavedLoadout[] {
  return store(state).saved.filter((l) => !loadoutMech(state, l));
}

/**
 * Auto-rebuild after a Fold Jump: builds the next unbuilt loadout once there
 * is a free bay and credits for all of it. Returns names built this tick.
 */
export function advanceLoadouts(state: GameState): string[] {
  const lo = state.loadouts;
  if (!lo?.pending || !lo.auto) return [];
  if (!loadoutsUnlocked(state)) return [];
  const next = unbuiltLoadouts(state)[0];
  if (!next) {
    lo.pending = false;
    return [];
  }
  if (state.mechs.length >= hangarBays(state)) return [];
  const cost = rebuildCost(state, [next.id]);
  if (cost.credits > state.credits) return [];
  rebuildLoadout(state, next.id);
  if (unbuiltLoadouts(state).length === 0) lo.pending = false;
  return [next.name];
}

/** Display helper: a frame's name for a loadout row. */
export function loadoutFrameName(frame: FrameId): string {
  return frameDef(frame).name;
}
