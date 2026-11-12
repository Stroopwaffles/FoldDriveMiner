/**
 * Save format, migrations and export/import encoding.
 * Pure functions so they can be tested without a browser.
 */
import { newGame, syncResearchEffects, syncSector } from './engine';
import { ensureAnomalies } from './anomaly-rules';
import { ensureStoryBonds, ensureTradeSector } from './trade-rules';
import { GameState } from './types';
import { ensureStory } from './story-rules';

export const CURRENT_VERSION = 13;
const EXPORT_PREFIX = 'FDM1:';

export class SaveError extends Error {}

/** Upgrades older save shapes to the current version, one step at a time. */
export function migrate(raw: unknown): GameState {
  if (!raw || typeof raw !== 'object') throw new SaveError('Save data is not an object.');
  const data = raw as Record<string, unknown>;
  if (data['version'] === 1) {
    // v2 adds zones, research, refinery, ingots and auto-sell. All of them
    // start empty, so fillDefaults supplies them; only the version changes.
    data['version'] = 2;
  }
  if (data['version'] === 2) {
    // v3 adds drone types, Fleet Dispatch, mechs, parts and pilots. They start
    // empty (fillDefaults), and prospector counts carry over unchanged.
    data['version'] = 3;
  }
  if (data['version'] === 3) {
    // v4 adds threats (events, Pirate Heat, standing orders) and drone wrecks.
    // Both start empty; existing saves get a fresh grace period.
    data['version'] = 4;
  }
  if (data['version'] === 4) {
    // v5 adds the seeded sector and anomalies. Existing games are in the home
    // sector; give it a seed derived from the save so it stays stable.
    const sector = (data['sector'] ?? {}) as Record<string, unknown>;
    if (typeof sector['seed'] !== 'number') sector['seed'] = (Number(data['createdAt']) || 1) >>> 0;
    data['sector'] = sector;
    data['version'] = 5;
  }
  if (data['version'] === 5) {
    // v6 adds merchant convoys, contracts and pilot bonds; all start empty.
    data['version'] = 6;
  }
  if (data['version'] === 6) {
    // v7 adds the Fold Drive state (charge, Resonance, Jump Core). Mech frames
    // already built count as known blueprints; this run started at zero.
    const mechs = (data['mechs'] ?? []) as { frame: string }[];
    data['fold'] = { blueprints: [...new Set(mechs.map((m) => m.frame))], runStartCredits: 0 };
    data['version'] = 7;
  }
  if (data['version'] === 7) {
    // v8 adds the story: Episode 1 has been seen; commendations are awarded on
    // the first tick; the logbook opens with the current sector (from zero).
    data['story'] = { logbook: [], dismissed: [] };
    data['version'] = 8;
  }
  if (data['version'] === 8) {
    // v9 adds Deep Fold Echoes and settings-driven polish; Echoes start at zero.
    data['version'] = 9;
  }
  if (data['version'] === 9) {
    // v10 adds Alloy Smelting: the forge, alloy stock and alloy auto-sell all start empty.
    data['version'] = 10;
  }
  if (data['version'] === 10) {
    // v11 adds the Core Matrix (empty) and Data Core costs; nothing to convert.
    data['version'] = 11;
  }
  if (data['version'] === 11) {
    // v12 adds special asteroids and the Sensor Array; the current rock stays ordinary.
    data['version'] = 12;
  }
  if (data['version'] === 12) {
    // v13 replaces the Survey Range research with sector scans: zones that
    // research opened stay charted; Survey Range jobs in progress are refunded.
    const SURVEY = ['survey_trojan', 'survey_ring', 'survey_ice', 'survey_deep'];
    const research = (data['research'] ?? {}) as { levels?: Record<string, number>; active?: { id: string; paidSd: number; paidCr: number }[] };
    const levels = research.levels ?? {};
    let charted = 1;
    for (const id of SURVEY) {
      if (!levels[id]) break;
      charted++;
    }
    for (const id of SURVEY) delete levels[id];
    const keep = [];
    for (const job of research.active ?? []) {
      if (SURVEY.includes(job.id)) {
        data['surveyData'] = Number(data['surveyData'] ?? 0) + job.paidSd;
        data['credits'] = Number(data['credits'] ?? 0) + job.paidCr;
      } else keep.push(job);
    }
    if (research.active) research.active = keep;
    const sector = (data['sector'] ?? {}) as Record<string, unknown>;
    sector['charted'] = charted;
    sector['scan'] = null;
    data['sector'] = sector;
    const fold = data['fold'] as { archive?: string[]; qolCounts?: Record<string, number> } | undefined;
    if (fold?.archive) fold.archive = fold.archive.filter((id) => !SURVEY.includes(id));
    if (fold?.qolCounts) for (const id of SURVEY) delete fold.qolCounts[id];
    data['version'] = 13;
  }
  if (data['version'] !== CURRENT_VERSION) {
    throw new SaveError(`Unknown save version: ${String(data['version'])}`);
  }
  backfillConvoys(data);
  return fillDefaults(data as Partial<GameState>);
}

/**
 * Lifetime convoy count for saves from before it was tracked. trade.visits resets every Fold Jump,
 * so start from this run's visits plus what an earlier run's convoy commendation proves.
 */
function backfillConvoys(data: Record<string, unknown>): void {
  const stats = (data['stats'] ?? {}) as Record<string, unknown>;
  if (typeof stats['convoysHosted'] === 'number') return;
  const visits = Number((data['trade'] as { visits?: number } | undefined)?.visits) || 0;
  const story = data['story'] as { medals?: Record<string, number>; logbook?: { arrived: number }[] } | undefined;
  const medals = story?.medals ?? {};
  const runStart = story?.logbook?.at(-1)?.arrived ?? 0;
  // Earned before this run started: those convoys were in earlier runs, on top of this run's.
  const earlier = (id: string, n: number) => (medals[id] !== undefined && medals[id] < runStart ? n : 0);
  const proven = Math.max(earlier('convoys_2', 25), earlier('convoys_1', 5));
  stats['convoysHosted'] = proven + visits;
  data['stats'] = stats;
}

/** Fills any missing fields from a fresh game, so new fields never break old saves. */
function fillDefaults(saved: Partial<GameState>): GameState {
  const base = newGame(saved.commander ?? 'Commander', saved.ship ?? 'Unnamed', Date.now(), 1);
  const merged = deepMerge(base, saved) as GameState;
  if (typeof merged.credits !== 'number' || !Number.isFinite(merged.credits)) {
    throw new SaveError('Save data is corrupt (credits).');
  }
  if (!merged.asteroid || typeof merged.asteroid.mass !== 'number') {
    throw new SaveError('Save data is corrupt (asteroid).');
  }
  // Research effects follow the research levels (fixes saves where they fell out of step).
  syncResearchEffects(merged);
  syncSector(merged);
  ensureAnomalies(merged);
  ensureTradeSector(merged);
  ensureStoryBonds(merged);
  ensureStory(merged);
  return merged;
}

function deepMerge(base: unknown, over: unknown): unknown {
  if (over === undefined || over === null) return base;
  if (typeof base !== 'object' || base === null || Array.isArray(base)) return over;
  if (typeof over !== 'object' || Array.isArray(over)) return base;
  const out: Record<string, unknown> = { ...(base as Record<string, unknown>) };
  for (const [k, v] of Object.entries(over as Record<string, unknown>)) {
    out[k] = k in out ? deepMerge(out[k], v) : v;
  }
  return out;
}

export function serialize(state: GameState): string {
  return JSON.stringify(state);
}

export function deserialize(json: string): GameState {
  let parsed: unknown;
  try {
    parsed = JSON.parse(json);
  } catch {
    throw new SaveError('Save data is not valid JSON.');
  }
  return migrate(parsed);
}

export function toExportString(state: GameState): string {
  const bytes = new TextEncoder().encode(serialize(state));
  let bin = '';
  for (const b of bytes) bin += String.fromCharCode(b);
  return EXPORT_PREFIX + btoa(bin);
}

export function fromExportString(text: string): GameState {
  const trimmed = text.trim();
  if (!trimmed.startsWith(EXPORT_PREFIX)) throw new SaveError('This is not a Fold Drive Miner save code.');
  let json: string;
  try {
    const bin = atob(trimmed.slice(EXPORT_PREFIX.length));
    json = new TextDecoder().decode(Uint8Array.from(bin, (c) => c.charCodeAt(0)));
  } catch {
    throw new SaveError('Save code is damaged.');
  }
  return deserialize(json);
}
