import * as E from './engine';
import * as T from './threat-rules';
import { GameState, MechState } from './types';

function setup(auto = true): { s: GameState; m: MechState } {
  const s = E.newGame('Rook', 'Halberd', 1, 7);
  s.threats.nextIn = Infinity;
  s.anomalies.nextIn = Infinity;
  s.trade.nextIn = Infinity;
  s.credits = 1e9;
  s.cargo.ferrite = 1e6;
  Object.assign(s.research.levels, { hangar: 1, repair_bay: 1 }, auto ? { auto_repair: 1 } : {});
  E.ensureCrew(s);
  const m = E.buildMech(s, 'bulwark')!;
  m.armor = E.mechStats(s, m).armor;
  return { s, m };
}
const run = (s: GameState, sec: number) => {
  for (let i = 0; i < sec; i++) E.tick(s, 1);
};
const frac = (s: GameState, m: MechState) => m.armor / E.mechStats(s, m).armor;
/** Ticks until the mech leaves the bay (or gives up). */
const untilRepaired = (s: GameState, m: MechState) => {
  for (let i = 0; i < 3600 && m.job === 'repair'; i++) E.tick(s, 1);
};

describe('auto-repair', () => {
  it('a worn mining mech goes to the bay below 40% and goes back to mining at 100%', () => {
    const { s, m } = setup();
    E.setMechJob(s, m.id, 'mining');
    m.armor = E.mechStats(s, m).armor * 0.41;
    run(s, 120);
    expect(m.job).toBe('repair');
    expect(m.returnJob).toBe('mining');
    untilRepaired(s, m);
    expect(m.job).toBe('mining');
    expect(frac(s, m)).toBeGreaterThan(0.99);
  });

  it('a mech knocked to zero on a mission is repaired, then goes back to its job', () => {
    const { s, m } = setup();
    E.setMechJob(s, m.id, 'mining');
    // What a failed mission does now: damage through the shared disable path.
    T.damageMech(s, m, 1);
    expect(m.job).toBe('repair');
    expect(m.returnJob).toBe('mining');
    untilRepaired(s, m);
    expect(m.job).toBe('mining');
  });

  it('a mech left at zero on its job (old saves) is picked up too', () => {
    const { s, m } = setup();
    m.job = 'mining';
    m.armor = 0;
    run(s, 1);
    expect(m.job).toBe('repair');
    untilRepaired(s, m);
    expect(m.job).toBe('mining');
  });

  it('a defense mech left critical by a raid is repaired and returns to standby', () => {
    const { s, m } = setup();
    E.setMechJob(s, m.id, 'defense');
    m.armor = E.mechStats(s, m).armor * 0.1;
    run(s, 1);
    expect(m.job).toBe('repair');
    expect(m.returnJob).toBe('defense');
    untilRepaired(s, m);
    expect(m.job).toBe('defense');
  });

  it('an idle mech at zero is repaired and stays idle afterwards', () => {
    const { s, m } = setup();
    m.job = 'idle';
    m.armor = 0;
    run(s, 1);
    expect(m.job).toBe('repair');
    untilRepaired(s, m);
    expect(m.job).toBe('idle');
    expect(frac(s, m)).toBeGreaterThan(0.99);
  });

  it('mechs out on missions are left alone until they are home', () => {
    const { s, m } = setup();
    m.job = 'mission';
    m.returnJob = 'mining';
    m.armor = 0;
    run(s, 5);
    expect(m.job).toBe('mission');
  });

  it('without Auto-Repair, nothing moves on its own', () => {
    const { s, m } = setup(false);
    E.setMechJob(s, m.id, 'defense');
    m.armor = E.mechStats(s, m).armor * 0.1;
    run(s, 10);
    expect(m.job).toBe('defense');
  });

  it('a repair that cannot be paid for stalls, says so once, and resumes when it can', () => {
    const { s, m } = setup();
    E.setMechJob(s, m.id, 'mining');
    m.armor = E.mechStats(s, m).armor * 0.3;
    s.credits = 0;
    s.cargo.ferrite = 0;
    let warnings = 0;
    for (let i = 0; i < 30; i++) warnings += (E.tick(s, 1).repairStalled ?? []).length;
    expect(m.job).toBe('repair');
    expect(m.repairStalled).toBe(true);
    expect(warnings).toBe(1);
    s.credits = 1e9;
    s.cargo.ferrite = 1e6;
    E.tick(s, 1);
    expect(m.repairStalled).toBeUndefined();
    untilRepaired(s, m);
    expect(m.job).toBe('mining');
  });

  it('a manual repair remembers the job and goes back to it', () => {
    const { s, m } = setup(false);
    E.setMechJob(s, m.id, 'defense');
    m.armor = E.mechStats(s, m).armor * 0.6;
    E.setMechJob(s, m.id, 'repair');
    expect(m.returnJob).toBe('defense');
    untilRepaired(s, m);
    expect(m.job).toBe('defense');
  });

  it('a raid that disables a defender sends it to the bay and back to standby', () => {
    const { s, m } = setup();
    E.setMechJob(s, m.id, 'defense');
    const raid = T.startEvent(s, 'raid', E.emptyEvents());
    raid.strength = 1e6;
    run(s, 60);
    expect(s.threats.lastSortie?.outcome).toBe('defeat');
    expect(m.job).toBe('repair');
    expect(m.returnJob).toBe('defense');
  });
});
