import { describe, expect, it } from 'vitest';
import * as E from './engine';
import { MEDALS } from './medal-data';

describe('commendation progress', () => {
  it('every tiered commendation reports progress that agrees with its check', () => {
    const s = E.newGame('Rook', 'Halberd', 1, 8);
    s.drones.prospector = 150;
    s.stats.oreMined = 5e6;
    for (const m of MEDALS.filter((x) => x.progress)) {
      const p = m.progress!(s);
      expect(p.target).toBeGreaterThan(0);
      expect(p.value >= p.target, m.id).toBe(m.check(s));
    }
  });

  it('shows how far along the drone commendations are', () => {
    const s = E.newGame('Rook', 'Halberd', 1, 8);
    s.drones.prospector = 150;
    s.drones.cutter = 100;
    const nebula = MEDALS.find((m) => m.id === 'drones_5')!;
    expect(nebula.progress!(s)).toEqual({ value: 250, target: 1000 });
  });
});
