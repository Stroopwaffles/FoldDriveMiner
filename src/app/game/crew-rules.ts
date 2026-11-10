/** Pilots: generation, stats, levels, traits, station posts and hiring. */
import { hasResearch, nextId, researchLevel } from './common';
import {
  BACKGROUNDS,
  BackgroundId,
  CALLSIGNS,
  CHOOSABLE_TRAITS,
  CREW,
  GIVEN_NAMES,
  POSTS,
  PostId,
  STAT_IDS,
  STORY_PILOTS,
  SURNAMES,
  StatId,
  backgroundDef,
  postDef,
  traitDef,
  xpForLevel,
} from './crew-data';
import { FRAMES, FrameId } from './fleet-data';
import { Rng } from './rng';
import { GameState, MechState, PilotState, TickEvents } from './types';

// ---------------------------------------------------------------- lookups

export function pilotById(state: GameState, id: number | null | undefined): PilotState | null {
  if (id === null || id === undefined) return null;
  return state.pilots.find((p) => p.id === id) ?? null;
}

export function hasTrait(p: PilotState, id: string): boolean {
  return p.traits.includes(id);
}

export function pilotStats(p: PilotState): Record<StatId, number> {
  const bg = backgroundDef(p.background);
  const green = hasTrait(p, 'green') ? 0.8 : 1;
  const out = {} as Record<StatId, number>;
  for (const s of STAT_IDS) out[s] = (p.baseStats[s] + bg.growth[s] * (p.level - 1)) * green;
  return out;
}

export function syncLevel(p: PilotState, frame: FrameId): number {
  return CREW.syncThresholds.filter((t) => p.sync[frame] >= t).length;
}

export function isInjured(p: PilotState): boolean {
  return p.injuredRemaining > 0;
}

export function pilotMech(state: GameState, p: PilotState): MechState | null {
  return state.mechs.find((m) => m.pilotId === p.id) ?? null;
}

export function pilotPost(state: GameState, p: PilotState): PostId | null {
  for (const post of POSTS) if (state.posts[post.id] === p.id) return post.id;
  return null;
}

export function rosterCap(state: GameState): number {
  return CREW.baseRoster + researchLevel(state, 'crew_quarters') * CREW.rosterPerLevel;
}

export function crewUnlocked(state: GameState): boolean {
  return hasResearch(state, 'hangar');
}

// ---------------------------------------------------------------- post bonuses

/** Fractional bonus a staffed post gives right now (0 if empty). */
export function postBonus(state: GameState, post: PostId): number {
  const p = pilotById(state, state.posts[post]);
  if (!p) return 0;
  const def = postDef(post);
  let bonus = Math.min(def.cap, pilotStats(p)[def.stat] * def.perPoint);
  if (post === 'quartermaster' && hasTrait(p, 'silver_tongued')) bonus *= 1.5;
  if (post === 'science' && hasTrait(p, 'bookworm')) bonus *= 1.5;
  if (post === 'repair' && hasTrait(p, 'grease_monkey')) bonus *= 1.25;
  // Injured pilots can still take light duty, at half strength.
  if (isInjured(p)) bonus *= 0.5;
  return bonus;
}

/** Extra offline efficiency from Night Owl pilots on duty. */
export function nightOwlBonus(state: GameState): number {
  return state.pilots.filter((p) => hasTrait(p, 'night_owl') && (pilotMech(state, p) || pilotPost(state, p))).length * 0.05;
}

// ---------------------------------------------------------------- generation

export function generatePilot(state: GameState, rng: Rng, background?: BackgroundId): PilotState {
  const bg = background ? backgroundDef(background) : BACKGROUNDS[Math.floor(rng.next() * BACKGROUNDS.length)];
  const pick = <T>(list: readonly T[]) => list[Math.floor(rng.next() * list.length)];
  const baseStats = {} as Record<StatId, number>;
  for (const s of STAT_IDS) baseStats[s] = Math.max(1, Math.round(bg.base[s] * rng.range(0.8, 1.2)));

  const traits: string[] = [];
  if (bg.id === 'rookie') traits.push('green');
  // One trait, biased toward the background's specialties.
  const pool = rng.next() < 0.6 ? bg.traitBias.filter((t) => t !== 'green') : CHOOSABLE_TRAITS;
  const first = pick(pool.length ? pool : CHOOSABLE_TRAITS);
  traits.push(first);
  if (rng.next() < 0.3) {
    const second = pick(CHOOSABLE_TRAITS.filter((t) => !traits.includes(t)));
    traits.push(second);
  }

  return {
    id: nextId(state),
    name: `${pick(GIVEN_NAMES)} ${pick(SURNAMES)}`,
    callsign: pick(CALLSIGNS),
    background: bg.id,
    story: null,
    portraitSeed: (rng.next() * 4294967296) >>> 0,
    baseStats,
    traits,
    level: 1,
    xp: 0,
    sync: emptySync(),
    traitChoice: null,
    injuredRemaining: 0,
  };
}

export function emptySync(): Record<FrameId, number> {
  const s = {} as Record<FrameId, number>;
  for (const f of FRAMES) s[f.id] = 0;
  return s;
}

function makeStoryPilot(state: GameState, key: string): PilotState {
  const sp = STORY_PILOTS[key];
  const bg = backgroundDef(sp.background);
  return {
    id: nextId(state),
    name: sp.name,
    callsign: sp.callsign,
    background: sp.background,
    story: sp.story,
    portraitSeed: sp.portraitSeed,
    baseStats: { ...bg.base },
    traits: [...sp.traits],
    level: 1,
    xp: 0,
    sync: emptySync(),
    traitChoice: null,
    injuredRemaining: 0,
  };
}

/** Story pilots join when their research completes; recruits appear with the hangar. Returns who joined. */
export function ensureCrew(state: GameState): string[] {
  const joined: string[] = [];
  const add = (key: string) => {
    if (state.pilots.some((p) => p.story === key)) return;
    state.pilots.push(makeStoryPilot(state, key));
    joined.push(key);
  };
  if (hasResearch(state, 'hangar')) add('juno');
  if (hasResearch(state, 'repair_bay')) add('kit');
  if (crewUnlocked(state) && state.recruits.length === 0) refreshRecruits(state);
  return joined;
}

export function refreshRecruits(state: GameState): void {
  const rng = new Rng(state.rng);
  state.recruits = Array.from({ length: CREW.recruitCount }, () => generatePilot(state, rng));
  state.rng = rng.state;
  state.recruitRefresh = CREW.recruitRefreshSec;
}

// ---------------------------------------------------------------- hiring

export function hireCost(state: GameState): number {
  return Math.ceil(CREW.hireBaseCost * CREW.hireCostGrowth ** state.pilots.length);
}

export function hirePilot(state: GameState, index: number): boolean {
  const recruit = state.recruits[index];
  if (!recruit || state.pilots.length >= rosterCap(state)) return false;
  const cost = hireCost(state);
  if (state.credits < cost) return false;
  state.credits -= cost;
  state.recruits.splice(index, 1);
  state.pilots.push(recruit);
  return true;
}

export function rerollRecruits(state: GameState): boolean {
  if (state.credits < CREW.rerollCost) return false;
  state.credits -= CREW.rerollCost;
  refreshRecruits(state);
  return true;
}

/** Story pilots can't be dismissed. */
export function dismissPilot(state: GameState, id: number): boolean {
  const p = pilotById(state, id);
  if (!p || p.story) return false;
  unassign(state, p);
  state.pilots = state.pilots.filter((x) => x.id !== id);
  return true;
}

// ---------------------------------------------------------------- assignment

/** Removes a pilot from any mech seat or post. */
export function unassign(state: GameState, p: PilotState): void {
  for (const m of state.mechs) if (m.pilotId === p.id) m.pilotId = null;
  for (const post of POSTS) if (state.posts[post.id] === p.id) delete state.posts[post.id];
}

export function assignPost(state: GameState, post: PostId, pilotId: number | null): boolean {
  if (pilotId === null) {
    delete state.posts[post];
    return true;
  }
  const p = pilotById(state, pilotId);
  if (!p) return false;
  unassign(state, p);
  state.posts[post] = p.id;
  return true;
}

export function chooseTrait(state: GameState, pilotId: number, trait: string): boolean {
  const p = pilotById(state, pilotId);
  if (!p || !p.traitChoice || !p.traitChoice.includes(trait)) return false;
  p.traits.push(trait);
  p.traitChoice = null;
  return true;
}

// ---------------------------------------------------------------- time

/** XP, levels, trait choices, injuries and the recruit timer. Mech sync is handled by the fleet. */
export function advanceCrew(state: GameState, dt: number, events: TickEvents): void {
  if (!crewUnlocked(state)) return;
  const instructor = postBonus(state, 'instructor');
  const instructorId = state.posts.instructor;
  const rng = new Rng(state.rng);

  for (const p of state.pilots) {
    // The Medbay speeds recovery (+100% per level).
    if (p.injuredRemaining > 0) p.injuredRemaining = Math.max(0, p.injuredRemaining - dt * (1 + researchLevel(state, 'medbay')));
    if (p.level >= CREW.levelCap) continue;
    const mech = pilotMech(state, p);
    const post = pilotPost(state, p);
    let rate = mech && mech.job === 'mining' ? CREW.xpMining : post ? CREW.xpPost : CREW.xpIdle;
    if (hasTrait(p, 'quick_learner')) rate *= 1.25;
    if (p.id !== instructorId) rate *= 1 + instructor;
    p.xp += rate * dt;

    while (p.level < CREW.levelCap && p.xp >= xpForLevel(p.level)) {
      p.xp -= xpForLevel(p.level);
      p.level++;
      events.levelUps.push({ pilotId: p.id, level: p.level });
      for (const t of p.traits) {
        const def = traitDef(t);
        if (def.removedAt && p.level >= def.removedAt) p.traits = p.traits.filter((x) => x !== t);
      }
      if (p.level % CREW.traitEvery === 0 && !p.traitChoice) {
        const options = CHOOSABLE_TRAITS.filter((t) => !p.traits.includes(t));
        if (options.length >= 2) {
          const a = options[Math.floor(rng.next() * options.length)];
          const rest = options.filter((t) => t !== a);
          const b = rest[Math.floor(rng.next() * rest.length)];
          p.traitChoice = [a, b];
        }
      }
    }
  }
  state.rng = rng.state;

  state.recruitRefresh -= dt;
  if (state.recruitRefresh <= 0) refreshRecruits(state);
}
