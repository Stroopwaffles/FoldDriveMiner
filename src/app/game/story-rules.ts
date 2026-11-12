/**
 * Story and meta rules: unlocking episodes, watching them, the finale choice,
 * side stories, commendations and their bonuses, the Sector Logbook and the
 * dossiers of pilots who left. Everything here survives Fold Jumps.
 */
import { FOLD } from './fold-data';
import { matrixBonus } from './core-rules';
import { addStoryPilot } from './crew-rules';
import { BonusKind, MEDALS } from './medal-data';
import { sectorOf } from './sector-rules';
import { LAST_OFFER, EPISODES, FINAL_EPISODE, FinaleChoice, SIDE_STORIES, STORY } from './story-data';
import { GameState, LogEntry, LogSnap, PilotState, StoryState, TickEvents } from './types';

export function emptyStory(): StoryState {
  // lastUnlockAt starts a full gap back, so Episode 2 can follow the first drone straight away.
  return {
    unlocked: 1,
    watched: 1,
    lastUnlockAt: -STORY.minGapSec,
    beatJumps: 0,
    choice: null,
    side: 0,
    sideWatched: 0,
    medals: {},
    logbook: [],
    dismissed: [],
  };
}

export function choice(state: GameState): FinaleChoice | null {
  return state.story?.choice ?? null;
}

// ---------------------------------------------------------------- episodes

/** The next episode waiting to be watched, or null. */
export function pendingEpisode(state: GameState): number | null {
  const st = state.story;
  return st.watched < st.unlocked ? st.watched + 1 : null;
}

/** The next side story waiting to be watched (1-based), or null. */
export function pendingSide(state: GameState): number | null {
  const st = state.story;
  return st.sideWatched < st.side ? st.sideWatched + 1 : null;
}

/** True while Master the Cycle's ending is waiting to be watched. */
export function pendingMasterEnding(state: GameState): boolean {
  return state.story.masterEnding === 1;
}

export function watchMasterEnding(state: GameState): boolean {
  if (!state.story.masterEnding) return false;
  state.story.masterEnding = 2;
  return true;
}

/** True while the Jackal's last offer is waiting for an answer. */
export function pendingOffer(state: GameState): boolean {
  return state.story.offer === 1 && state.story.choice === 'master';
}

/**
 * Answers the Jackal's last offer. 'break' switches this save to Break the Cycle for good (the
 * frontier epilogue then waits at depth 10); 'master' refuses, and she asks again next Deep Fold.
 */
export function answerOffer(state: GameState, c: FinaleChoice): boolean {
  const st = state.story;
  if (!pendingOffer(state)) return false;
  if (c === 'break') {
    st.choice = 'break';
    st.offer = 3;
    if (state.sector.depth >= FOLD.frontierDepth && !st.epilogue) st.epilogue = 1;
  } else {
    st.offer = 2;
    st.offerRefusedAt = state.fold.deepFolds ?? 0;
  }
  return true;
}

/** True while Break the Cycle's epilogue is waiting to be watched. */
export function pendingEpilogue(state: GameState): boolean {
  return state.story.epilogue === 1;
}

export function watchEpilogue(state: GameState): boolean {
  if (!state.story.epilogue) return false;
  state.story.epilogue = 2;
  return true;
}

export function sideStory(n: number) {
  return SIDE_STORIES[(n - 1) % SIDE_STORIES.length];
}

/** Marks an episode watched. The finale only counts once a choice is made. */
export function watchEpisode(state: GameState, n: number): boolean {
  const st = state.story;
  if (n !== st.watched + 1 || n > st.unlocked) return false;
  if (n === FINAL_EPISODE && !st.choice) return false;
  st.watched = n;
  return true;
}

export function watchSide(state: GameState, n: number): boolean {
  const st = state.story;
  if (n !== st.sideWatched + 1 || n > st.side) return false;
  st.sideWatched = n;
  return true;
}

/** The permanent finale choice: only during the last episode, only once. */
export function chooseFinale(state: GameState, c: FinaleChoice): boolean {
  const st = state.story;
  if (st.choice || st.unlocked < FINAL_EPISODE || st.watched !== FINAL_EPISODE - 1) return false;
  st.choice = c;
  st.watched = FINAL_EPISODE;
  return true;
}

// ---------------------------------------------------------------- commendations

export function medalBonus(state: GameState, kind: BonusKind): number {
  const earned = state.story?.medals;
  if (!earned) return 0;
  let total = 0;
  for (const m of MEDALS) if (m.bonus.kind === kind && earned[m.id] !== undefined) total += m.bonus.amount;
  return total;
}

/** All permanent bonuses of a kind: commendations plus the Core Matrix. */
export function medalMult(state: GameState, kind: BonusKind): number {
  return 1 + medalBonus(state, kind) + matrixBonus(state, kind);
}

// ---------------------------------------------------------------- the tick

/** A new story beat since the last episode arrived: a Fold Jump, or enough playtime. */
export function storyBeat(state: GameState): boolean {
  const st = state.story;
  return state.fold.jumps > st.beatJumps || state.playtimeSec - st.lastUnlockAt >= STORY.minGapSec;
}

/** Seconds until the gap allows the next episode (0 if it's only waiting on its milestone or a watch). */
export function episodeWait(state: GameState): number {
  const st = state.story;
  if (state.fold.jumps > st.beatJumps) return 0;
  return Math.max(0, st.lastUnlockAt + STORY.minGapSec - state.playtimeSec);
}

/** Unlocks the next episode when it's earned (one at a time), and awards commendations. */
export function advanceStory(state: GameState, events: TickEvents): void {
  const st = state.story;
  const next = EPISODES[st.unlocked];
  if (next && st.watched >= st.unlocked && storyBeat(state) && next.trigger(state)) {
    st.unlocked = next.n;
    st.lastUnlockAt = state.playtimeSec;
    st.beatJumps = state.fold.jumps;
    if (next.joins) addStoryPilot(state, next.joins);
    events.story.push({ kind: 'episode', id: String(next.n), text: next.title });
  }
  for (const m of MEDALS) {
    if (st.medals[m.id] !== undefined || !m.check(state)) continue;
    st.medals[m.id] = Math.round(state.playtimeSec);
    events.story.push({ kind: 'medal', id: m.id, text: m.name });
  }
}

// ---------------------------------------------------------------- Sector Logbook

export function logSnap(state: GameState): LogSnap {
  return {
    credits: state.stats.creditsEarned,
    ore: state.stats.oreMined,
    raids: state.threats.raidsWon,
    anomalies: Object.values(state.anomalies.codex).reduce<number>((a, b) => a + (b ?? 0), 0),
    contracts: state.contracts.completed,
  };
}

const ZERO: LogSnap = { credits: 0, ore: 0, raids: 0, anomalies: 0, contracts: 0 };

export function currentLog(state: GameState): LogEntry | undefined {
  const log = state.story.logbook;
  const last = log[log.length - 1];
  return last && last.left === null ? last : undefined;
}

/** Opens a logbook entry for the sector the ship is in. */
export function openLog(state: GameState, fromZero = false): void {
  const def = sectorOf(state);
  state.story.logbook.push({
    code: state.sector.code,
    name: state.sector.name,
    star: state.sector.star,
    depth: state.sector.depth,
    profile: def.profile,
    traits: [...def.traits],
    arrived: Math.round(state.playtimeSec),
    left: null,
    start: fromZero ? { ...ZERO } : logSnap(state),
    end: null,
    resonance: 0,
  });
}

export function closeLog(state: GameState, resonance: number): void {
  const e = currentLog(state);
  if (!e) return;
  e.left = Math.round(state.playtimeSec);
  e.end = logSnap(state);
  e.resonance = resonance;
}

/** What a logbook entry has recorded so far (open entries count up to now). */
export function logTotals(state: GameState, e: LogEntry): LogSnap & { seconds: number } {
  const end = e.end ?? logSnap(state);
  return {
    credits: end.credits - e.start.credits,
    ore: end.ore - e.start.ore,
    raids: end.raids - e.start.raids,
    anomalies: end.anomalies - e.start.anomalies,
    contracts: end.contracts - e.start.contracts,
    seconds: (e.left ?? state.playtimeSec) - e.arrived,
  };
}

/**
 * Repairs story state on load: every save has an open logbook entry, and
 * older saves with a backlog keep only the next episode (the rest re-arrive
 * one beat at a time).
 */
export function ensureStory(state: GameState): void {
  if (!currentLog(state)) openLog(state, state.story.logbook.length === 0);
  const st = state.story;
  if (st.unlocked > st.watched + 1) st.unlocked = st.watched + 1;
}

// ---------------------------------------------------------------- dossiers

export function recordDismissal(state: GameState, p: PilotState): void {
  state.story.dismissed.push({
    name: p.name,
    callsign: p.callsign,
    background: p.background,
    level: p.level,
    portraitSeed: p.portraitSeed,
    left: Math.round(state.playtimeSec),
  });
}

// ---------------------------------------------------------------- the jump

/** Copies the story across a Fold Jump and opens the new sector's logbook entry. */
export function carryStory(old: GameState, next: GameState, resonance: number): void {
  closeLog(old, resonance);
  next.story = structuredClone(old.story);
  if (next.story.choice) next.story.side++;
  // Break the Cycle: reaching the charted frontier is the ending.
  if (next.story.choice === 'break' && next.sector.depth >= FOLD.frontierDepth && !next.story.epilogue) next.story.epilogue = 1;
  // Master the Cycle: the first Deep Fold is the ending; after more, the Jackal asks once more.
  const folds = next.fold.deepFolds ?? 0;
  if (next.story.choice === 'master') {
    if (folds >= 1 && !next.story.masterEnding) next.story.masterEnding = 1;
    const offer = next.story.offer ?? 0;
    if (folds >= LAST_OFFER.afterDeepFolds && offer !== 1 && offer !== 3 && folds > (next.story.offerRefusedAt ?? 0)) next.story.offer = 1;
  }
  openLog(next);
}
