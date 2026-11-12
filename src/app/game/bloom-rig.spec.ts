import * as A from './anomaly-rules';
import * as E from './engine';
import { ANOMALY } from './anomaly-data';
import { AnomalyState, GameState } from './types';

/** A sector with a scanned Crystal Bloom and only a Mk.I drill. */
function bloom(): { s: GameState; a: AnomalyState } {
  const s = E.newGame('Rook', 'Halberd', 1, 11);
  s.threats.nextIn = Infinity;
  s.anomalies.nextIn = Infinity;
  s.trade.nextIn = Infinity;
  s.credits = 1e12;
  s.cargoLevel = 20;
  const a: AnomalyState = { id: 999, kind: 'crystal_bloom', zone: s.zone, fixed: true, status: 'scanned', progress: 0, timer: 0 };
  s.anomalies.list.push(a);
  return { s, a };
}

describe('Crystal Bloom harvest rig', () => {
  it('fills the hold with Voidglass without a Mk.V drill, and it can be sold and refined', () => {
    const { s, a } = bloom();
    expect(E.drillTier(s)).toBe(1);
    expect(E.oreTradable(s, 'voidglass')).toBe(false);
    expect(A.deployRig(s, a.id)).toBe(true);
    expect(E.oreTradable(s, 'voidglass')).toBe(true); // shows in the hold as soon as the rig runs
    for (let i = 0; i < 600; i++) E.tick(s, 1);
    expect(s.cargo.voidglass).toBeCloseTo(600 * ANOMALY.bloomPerSec, 4);
    const credits = s.credits;
    expect(E.sell(s, 'voidglass')).toBeGreaterThan(0);
    expect(s.credits).toBeGreaterThan(credits);
    // The refinery takes it too.
    s.research.levels['refinery'] = 1;
    E.syncRefinerySlots(s);
    s.cargo.voidglass = 100;
    expect(E.startBatch(s, 0, 'voidglass')).toBe(true);
  });

  it('upgrades raise the flow, up to level 5, and cost more each time', () => {
    const { s, a } = bloom();
    A.deployRig(s, a.id);
    expect(A.rigLevel(a)).toBe(1);
    const costs: number[] = [];
    let rate = A.bloomRate(a);
    while (A.rigUpgradeCost(a) !== null) {
      costs.push(A.rigUpgradeCost(a)!);
      expect(A.upgradeRig(s, a.id)).toBe(true);
      expect(A.bloomRate(a)).toBeGreaterThan(rate);
      rate = A.bloomRate(a);
    }
    expect(A.rigLevel(a)).toBe(5);
    expect(A.bloomRate(a)).toBeCloseTo(ANOMALY.bloomPerSec * 20, 9);
    expect(A.upgradeRig(s, a.id)).toBe(false);
    for (let i = 1; i < costs.length; i++) expect(costs[i]).toBeGreaterThan(costs[i - 1]);
    // And the hold fills 20× faster.
    s.cargo.voidglass = 0;
    for (let i = 0; i < 60; i++) E.tick(s, 1);
    expect(s.cargo.voidglass).toBeCloseTo(60 * ANOMALY.bloomPerSec * 20, 3);
  });

  it('upgrading needs a running rig and the credits', () => {
    const { s, a } = bloom();
    expect(A.upgradeRig(s, a.id)).toBe(false); // not deployed
    A.deployRig(s, a.id);
    s.credits = 0;
    expect(A.upgradeRig(s, a.id)).toBe(false);
  });
});
