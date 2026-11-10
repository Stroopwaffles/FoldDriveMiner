/**
 * Save format, migrations and export/import encoding.
 * Pure functions so they can be tested without a browser.
 */
import { ensureCrew, newGame, syncRefinerySlots, syncSector } from './engine';
import { ensureAnomalies } from './anomaly-rules';
import { ensureStoryBonds, ensureTradeSector } from './trade-rules';
import { GameState } from './types';
import { ensureStory } from './story-rules';

export const CURRENT_VERSION = 11;
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
  if (data['version'] !== CURRENT_VERSION) {
    throw new SaveError(`Unknown save version: ${String(data['version'])}`);
  }
  return fillDefaults(data as Partial<GameState>);
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
  syncRefinerySlots(merged);
  ensureCrew(merged);
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
