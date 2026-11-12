/**
 * ARIA, the research assistant. Once researched and switched on in the LAB, she fills empty lab
 * benches: first from your queue (in order, skipping anything that can't start yet), then, in
 * Auto mode, with the cheapest project on offer. She never spends Data Cores on her own choices.
 */
import { researchLevel } from './common';
import { RESEARCH, researchNode } from './research';
import { GameState } from './types';
import { labSlots, researchBlocker, researchCost, researchStatus, startResearch } from './engine';

export type AssistantMode = 'queue' | 'auto';

export interface AssistantState {
  on: boolean;
  mode: AssistantMode;
  /** Research ids in order; each entry is one level. */
  queue: string[];
}

export const ASSISTANT = {
  /** Longest queue the Lab will hold. */
  maxQueue: 12,
};

export function emptyAssistant(): AssistantState {
  return { on: false, mode: 'queue', queue: [] };
}

export function hasAssistant(state: GameState): boolean {
  return researchLevel(state, 'lab_assistant') > 0;
}

export function setAssistant(state: GameState, on: boolean): boolean {
  if (on && !hasAssistant(state)) return false;
  state.research.assistant.on = on;
  return true;
}

export function setAssistantMode(state: GameState, mode: AssistantMode): boolean {
  state.research.assistant.mode = mode;
  return true;
}

/** Levels of a node still to do, counting ones already queued or on a bench. */
function levelsLeft(state: GameState, id: string): number {
  const n = researchNode(id);
  const queued = state.research.assistant.queue.filter((q) => q === id).length;
  const running = state.research.active.filter((j) => j.id === id).length;
  return n.maxLevel - researchLevel(state, id) - running - queued;
}

/** Why a node can't be queued, or null. Locked nodes can be queued (they wait); teasers can't. */
export function queueBlocker(state: GameState, id: string): string | null {
  if (!hasAssistant(state)) return 'Research the Research Assistant first';
  const n = researchNode(id);
  if (n.teaser) return 'Not available yet';
  if (state.research.assistant.queue.length >= ASSISTANT.maxQueue) return 'Queue is full';
  if (levelsLeft(state, id) <= 0) return 'Every level is already done or queued';
  return null;
}

export function enqueue(state: GameState, id: string): boolean {
  if (queueBlocker(state, id) !== null) return false;
  state.research.assistant.queue.push(id);
  return true;
}

export function dequeue(state: GameState, index: number): boolean {
  const q = state.research.assistant.queue;
  if (index < 0 || index >= q.length) return false;
  q.splice(index, 1);
  return true;
}

export function clearQueue(state: GameState): boolean {
  state.research.assistant.queue = [];
  return true;
}

/** Drops queue entries that can never run now (maxed, or more levels queued than remain). */
function pruneQueue(state: GameState): void {
  const kept: string[] = [];
  for (const id of state.research.assistant.queue) {
    const n = RESEARCH.find((x) => x.id === id);
    if (!n || n.teaser) continue;
    const room = n.maxLevel - researchLevel(state, id) - state.research.active.filter((j) => j.id === id).length - kept.filter((k) => k === id).length;
    if (room > 0) kept.push(id);
  }
  state.research.assistant.queue = kept;
}

/** The cheapest project she may start on her own: available, affordable, no Data Cores. */
export function cheapestPick(state: GameState): string | null {
  let best: { id: string; score: number } | null = null;
  for (const n of RESEARCH) {
    if (n.cores || researchStatus(state, n.id) !== 'available' || researchBlocker(state, n.id) !== null) continue;
    const c = researchCost(state, n.id);
    // Survey Data is the scarce one; credits break ties.
    const score = c.sd * 1e9 + c.cr;
    if (!best || score < best.score) best = { id: n.id, score };
  }
  return best?.id ?? null;
}

/** Fills empty benches. Returns the names of projects she started. */
export function runAssistant(state: GameState): string[] {
  const a = state.research.assistant;
  if (!a.on || !hasAssistant(state)) return [];
  pruneQueue(state);
  const started: string[] = [];
  while (state.research.active.length < labSlots(state)) {
    const i = nextInQueue(state);
    let id: string | null = null;
    if (i >= 0) {
      // First in, first out: the oldest open project goes next, or the queue waits for it.
      if (researchBlocker(state, a.queue[i]) !== null) break;
      id = a.queue[i];
      a.queue.splice(i, 1);
    } else if (a.mode === 'auto') {
      id = cheapestPick(state);
    }
    if (!id || !startResearch(state, id)) break;
    started.push(researchNode(id).name);
  }
  return started;
}

/**
 * The queue entry ARIA works on next: the oldest one that's open to research. Entries that can't
 * run at all yet (missing a prerequisite, an uncharted zone, or another level already on a bench)
 * are stepped over and keep their place; an open entry that's only short of Survey Data, credits
 * or cores is NOT stepped over: the queue waits for it, so it stays first in, first out.
 */
export function nextInQueue(state: GameState): number {
  return state.research.assistant.queue.findIndex((id) => researchStatus(state, id) === 'available');
}
