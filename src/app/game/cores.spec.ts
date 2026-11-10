import { CORES, MATRIX, RELIC_PARTS } from './core-data';
import * as E from './engine';
import * as F from './fold-rules';
import { Rng } from './rng';
import { CURRENT_VERSION, migrate } from './save';
import * as TR from './trade-rules';
import { GameState } from './types';

function fresh(): GameState {
  const s = E.newGame('Rook', 'Halberd Dawn', 1, 4242);
  s.threats.nextIn = Infinity;
  s.anomalies.nextIn = Infinity;
  s.trade.nextIn = Infinity;
  s.credits = 1e9;
  s.surveyData = 1e6;
  return s;
}

describe('Data Cores: rushing research', () => {
  it('costs one core per 10 minutes left, at least one', () => {
    const s = fresh();
    E.startResearch(s, 'refinery');
    const job = s.research.active[0];
    job.remaining = 30;
    expect(E.rushCost(job)).toBe(1);
    job.remaining = 1500;
    expect(E.rushCost(job)).toBe(3);
    job.remaining = 1e6;
    expect(E.rushCost(job)).toBe(CORES.rushMaxCores);
  });

  it('finishes the project on the next tick', () => {
    const s = fresh();
    E.startResearch(s, 'refinery');
    s.dataCores = 0;
    expect(E.rushResearch(s, 0)).toBe(false);
    s.dataCores = 5;
    expect(E.rushResearch(s, 0)).toBe(true);
    expect(s.dataCores).toBe(4);
    E.tick(s, 0.1);
    expect(E.hasResearch(s, 'refinery')).toBe(true);
    expect(s.research.active.length).toBe(0);
  });
});

describe('Data Cores: core research nodes', () => {
  it('Core Lattice costs cores, and cancelling refunds them', () => {
    const s = fresh();
    s.dataCores = 0;
    expect(E.researchCost(s, 'core_lattice').cores).toBe(1);
    expect(E.researchBlocker(s, 'core_lattice')).toBe('Not enough Data Cores');
    s.dataCores = 3;
    expect(E.startResearch(s, 'core_lattice')).toBe(true);
    expect(s.dataCores).toBe(2);
    E.cancelResearch(s, 0);
    expect(s.dataCores).toBe(3);
  });

  it('later levels cost one more core', () => {
    const s = fresh();
    s.research.levels['core_decryption'] = 1;
    expect(E.researchCost(s, 'core_decryption').cores).toBe(3);
  });

  it('Core Decryption raises Survey Data, Core Resonator raises Resonance', () => {
    const s = fresh();
    const sd = TR.surveyMult(s);
    s.research.levels['core_decryption'] = 2;
    expect(TR.surveyMult(s)).toBeCloseTo(sd * 1.4, 9);
    s.research.levels['fold_drive'] = 1;
    s.fold.charge = 1;
    s.stats.creditsEarned = 1e9;
    const res = F.resonanceGain(s);
    s.research.levels['core_resonator'] = 2;
    expect(F.resonanceGain(s)).toBeGreaterThan(res);
    expect(F.resonanceGain(s)).toBeLessThanOrEqual(Math.floor(res * 1.2) + 1);
  });
});

describe('Data Cores: the Core Matrix', () => {
  it('levels cost cores, one more each level, up to the max', () => {
    const s = fresh();
    const m = MATRIX[0];
    s.dataCores = 100;
    expect(E.matrixCost(s, m.id)).toBe(m.cost);
    expect(E.buyMatrix(s, m.id)).toBe(true);
    expect(E.matrixCost(s, m.id)).toBe(m.cost + 1);
    s.matrix[m.id] = m.maxLevel;
    expect(E.matrixCost(s, m.id)).toBeNull();
    expect(E.buyMatrix(s, m.id)).toBe(false);
  });

  it('adds to the permanent bonuses', () => {
    const s = fresh();
    const power = E.drillPower(s);
    s.matrix['m_drill'] = 4; // +20%
    expect(E.drillPower(s)).toBeCloseTo(power * 1.2, 6);
    const price = E.orePrice(s, 'ferrite');
    s.matrix['m_sell'] = 5; // +10%
    expect(E.orePrice(s, 'ferrite')).toBeCloseTo((price / 1) * 1.1, 6);
  });

  it('survives a Fold Jump', () => {
    const s = fresh();
    s.matrix['m_xp'] = 3;
    s.research.levels['fold_drive'] = 1;
    s.fold.charge = 1;
    s.stats.creditsEarned = 1e8;
    expect(F.foldJump(s)!.state.matrix['m_xp']).toBe(3);
  });
});

describe('Data Cores: legendary parts from merchants', () => {
  function relicFleet(s: GameState) {
    for (let seed = 1; seed < 200; seed++) {
      s.rng = seed;
      const f = TR.spawnFleet(s, E.emptyEvents());
      const relic = f.stock.find((i) => i.kind === 'relic');
      if (relic) return relic;
    }
    throw new Error('no relic in 200 convoys');
  }

  it('convoys sometimes stock a legendary part, priced only in cores', () => {
    const s = fresh();
    const relic = relicFleet(s);
    expect(RELIC_PARTS).toContain(relic.partId);
    expect(relic.dataCores).toBeGreaterThanOrEqual(CORES.relicPriceMin);
    expect(TR.canBuy(s, relic.id, 'credits')).toBe('Sold only for Data Cores');
    s.dataCores = 0;
    expect(TR.canBuy(s, relic.id, 'cores')).toMatch(/Need/);
    s.dataCores = 10;
    expect(TR.buyItem(s, relic.id, 'cores', E.emptyEvents())).toBe(true);
    expect(s.dataCores).toBe(10 - relic.dataCores!);
    expect(s.parts[relic.partId!]).toBe(1);
  });

  it('owned legendaries are not offered again, and survive a Fold Jump', () => {
    const s = fresh();
    for (const id of RELIC_PARTS) s.parts[id] = 1;
    expect(E.makeRelic(s, new Rng(1), 1)).toBeNull();
    s.research.levels['fold_drive'] = 1;
    s.fold.charge = 1;
    s.stats.creditsEarned = 1e8;
    const n = F.foldJump(s)!.state;
    for (const id of RELIC_PARTS) expect(n.parts[id]).toBe(1);
  });
});

describe('Data Cores: saves', () => {
  it('migrates a version 10 save', () => {
    const v10 = E.newGame('Rook', 'Halberd', 1, 99) as unknown as Record<string, unknown>;
    v10['version'] = 10;
    delete v10['matrix'];
    const m = migrate(v10);
    expect(m.version).toBe(CURRENT_VERSION);
    expect(m.matrix).toEqual({});
  });
});
