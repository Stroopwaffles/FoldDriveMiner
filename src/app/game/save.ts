/**
 * Save format, migrations and export/import encoding.
 * Pure functions so they can be tested without a browser.
 */
import { ensureCrew, newGame, syncRefinerySlots } from './engine';
import { GameState } from './types';

export const CURRENT_VERSION = 3;
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
