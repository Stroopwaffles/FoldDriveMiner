import { describe, expect, it } from 'vitest';
import * as E from './engine';
import { PERMANENT_NODES } from './fold-data';
import { researchNode } from './research';
import { THREAT } from './threat-data';
import * as T from './threat-rules';

function past(): ReturnType<typeof E.newGame> {
  const s = E.newGame('Rook', 'Halberd', 1, 21);
  s.threats.clock = THREAT.graceSec + 1;
  return s;
}

describe('Pirate Comms Intercept', () => {
  it('the forecast incident is the one that starts', () => {
    const s = past();
    s.threats.nextIn = 5;
    s.threats.nextKind = 'raid';
    expect(T.raidForecast(s)).toMatchObject({ raid: true });
    T.advanceThreats(s, 6, E.emptyEvents());
    expect(s.threats.events.some((e) => e.kind === 'raid')).toBe(true);
    // The next one is already rolled.
    expect(s.threats.nextKind).not.toBeUndefined();
  });

  it('a forecast that can no longer happen is re-rolled among what can', () => {
    const s = past();
    T.startEvent(s, 'raid', E.emptyEvents());
    s.threats.nextIn = 1;
    s.threats.nextKind = 'flare'; // hostile, and a raid is still inbound
    T.advanceThreats(s, 2, E.emptyEvents());
    expect(s.threats.events.filter((e) => e.kind === 'flare').length).toBe(0);
  });

  it('no raid is forecast inside the grace period, and the quiet window is honest', () => {
    const s = E.newGame('Rook', 'Halberd', 1, 21);
    s.threats.clock = 0;
    s.threats.nextIn = 60;
    for (let i = 0; i < 20; i++) {
      s.threats.nextKind = undefined;
      T.advanceThreats(s, 0.001, E.emptyEvents());
      expect(s.threats.nextKind === null || s.threats.nextKind !== 'raid').toBe(true);
    }
    const f = T.raidForecast(s)!;
    expect(f.raid).toBe(false);
    expect(f.clearFor).toBeGreaterThan(f.inSec);
  });

  it('is a research node, kept for good once known', () => {
    expect(researchNode('raid_forecast').requires).toContain('signature_scanner');
    expect(PERMANENT_NODES).toContain('raid_forecast');
  });
});
