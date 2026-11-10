import * as E from './engine';
import { FOLD } from './fold-data';
import * as F from './fold-rules';
import { CURRENT_VERSION, migrate } from './save';
import * as T from './threat-rules';
import { THREAT } from './threat-data';
import { GameState } from './types';

function deepReady(): GameState {
  const s = E.newGame('Rook', 'Halberd Dawn', 1, 515);
  s.threats.nextIn = Infinity;
  s.anomalies.nextIn = Infinity;
  s.trade.nextIn = Infinity;
  s.research.levels['fold_drive'] = 1;
  s.fold.charge = 1;
  s.stats.creditsEarned = 1e9;
  s.sector.depth = FOLD.deepMinDepth;
  s.fold.lifetimeResonance = 400;
  s.fold.resonance = 120;
  s.fold.core = { core_bays: 2 };
  s.fold.jumps = 6;
  s.story.choice = 'master';
  return s;
}

describe('milestone 8: the Deep Fold', () => {
  it('is only for Master the Cycle, deep enough, with a full charge', () => {
    const s = deepReady();
    expect(F.canDeepFold(s)).toBeNull();
    s.story.choice = 'break';
    expect(F.canDeepFold(s)).toMatch(/Master/);
    s.story.choice = 'master';
    s.sector.depth = FOLD.deepMinDepth - 1;
    expect(F.canDeepFold(s)).toMatch(/depth/);
    s.sector.depth = FOLD.deepMinDepth;
    s.fold.charge = 0.5;
    expect(F.canDeepFold(s)).toMatch(/charge/);
  });

  it('folds the Resonance layer into Echoes and returns to depth 1', () => {
    const s = deepReady();
    const echoes = F.deepFoldGain(s);
    expect(echoes).toBe(Math.floor(Math.sqrt((400 + F.resonanceGain(s)) / FOLD.echoUnit)));
    const r = F.foldJump(s, 1, true)!;
    const n = r.state;
    expect(r.echoes).toBe(echoes);
    expect(r.gained).toBe(0);
    expect(n.sector.depth).toBe(1);
    expect(n.fold.echoes).toBe(echoes);
    expect(n.fold.deepFolds).toBe(1);
    expect(n.fold.resonance).toBe(0);
    expect(n.fold.lifetimeResonance).toBe(0);
    expect(n.fold.core).toEqual({});
    expect(n.fold.jumps).toBe(7);
    expect(n.story.choice).toBe('master');
  });

  it('Echoes raise Resonance from every jump and production', () => {
    const s = deepReady();
    s.fold.lifetimeResonance = 0;
    const gain = F.resonanceGain(s);
    const prod = F.resonanceMult(s);
    s.fold.echoes = 3;
    // Floors happen at different points, so allow one point either way.
    expect(Math.abs(F.resonanceGain(s) - gain * (1 + 3 * FOLD.echoResonance))).toBeLessThanOrEqual(1);
    expect(F.resonanceMult(s)).toBeCloseTo(prod * (1 + 3 * FOLD.echoProduction), 9);
  });

  it('an ordinary jump keeps going deeper and leaves Echoes alone', () => {
    const s = deepReady();
    s.fold.echoes = 2;
    const n = F.foldJump(s)!.state;
    expect(n.sector.depth).toBe(FOLD.deepMinDepth + 1);
    expect(n.fold.echoes).toBe(2);
    expect(n.fold.deepFolds).toBe(0);
  });
});

describe('milestone 8: Meridian Security raids', () => {
  it('only come after Break the Cycle, and hit harder', () => {
    const s = deepReady();
    s.story.choice = 'break';
    s.threats.raids = 10;
    let corporate = 0;
    let total = 0;
    for (let i = 0; i < 200; i++) {
      const ev = T.startEvent(s, 'raid', E.emptyEvents());
      total++;
      if (ev.corporate) {
        corporate++;
        expect(ev.strength).toBeCloseTo(T.raidStrength(s) * THREAT.corporateStrength, 6);
      }
    }
    expect(corporate).toBeGreaterThan(total * 0.15);
    expect(corporate).toBeLessThan(total * 0.45);
    s.story.choice = 'master';
    for (let i = 0; i < 50; i++) expect(T.startEvent(s, 'raid', E.emptyEvents()).corporate).toBeUndefined();
  });
});

describe('milestone 8: balance and saves', () => {
  it('Resonance grows more slowly for very long runs', () => {
    const s = deepReady();
    s.story.choice = null;
    s.fold.charge = 1;
    s.stats.creditsEarned = 1e8;
    const first = F.resonanceGain(s);
    s.stats.creditsEarned = 1e11;
    const long = F.resonanceGain(s);
    expect(first).toBeGreaterThanOrEqual(35);
    expect(first).toBeLessThanOrEqual(45);
    // 1,000× the credits pays well under 1,000^0.5 ≈ 32× the Resonance.
    expect(long / first).toBeLessThan(12);
  });

  it('migrates a version 8 save', () => {
    const v8 = E.newGame('Rook', 'Halberd', 1, 3) as unknown as Record<string, unknown>;
    v8['version'] = 8;
    const fold = v8['fold'] as Record<string, unknown>;
    delete fold['echoes'];
    delete fold['deepFolds'];
    const m = migrate(v8);
    expect(m.version).toBe(CURRENT_VERSION);
    expect(m.fold.echoes).toBe(0);
    expect(m.fold.deepFolds).toBe(0);
  });
});
