import { describe, expect, it } from 'vitest';
import * as E from './engine';
import * as F from './fold-rules';
import { CURIO, CURIOS } from './curio-data';
import { identifyCurio } from './trade-rules';

describe('curios', () => {
  it('each curio identified is new until the set is complete', () => {
    const s = E.newGame('Rook', 'Halberd', 1, 9);
    const seen = new Set<string>();
    for (let i = 0; i < CURIOS.length; i++) {
      const c = identifyCurio(s)!;
      expect(c).toBeTruthy();
      expect(seen.has(c.id)).toBe(false);
      seen.add(c.id);
    }
    expect(s.anomalies.curios.length).toBe(CURIOS.length);
    expect(identifyCurio(s)).toBeNull();
    expect(s.anomalies.curios.length).toBe(CURIOS.length);
  });

  it('every curio has a unique id, a name and a note', () => {
    expect(new Set(CURIOS.map((c) => c.id)).size).toBe(CURIOS.length);
    for (const c of CURIOS) {
      expect(c.name.length).toBeGreaterThan(0);
      expect(c.note.length).toBeGreaterThan(20);
    }
    expect(CURIO.surveyData).toBeGreaterThan(0);
  });

  it('curios stay in the Codex through a Fold Jump', () => {
    const s = E.newGame('Rook', 'Halberd', 1, 9);
    identifyCurio(s);
    identifyCurio(s);
    const kept = [...s.anomalies.curios];
    s.research.levels['fold_drive'] = 1;
    s.fold.charge = 1;
    s.stats.creditsEarned = 1e8;
    const next = F.foldJump(s)!.state;
    expect(next.anomalies.curios).toEqual(kept);
  });
});
