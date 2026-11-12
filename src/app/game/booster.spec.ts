import * as E from './engine';
import * as F from './fold-rules';
import { CURRENT_VERSION, migrate } from './save';
import { GameState } from './types';

function lab(level = 1): GameState {
  const s = E.newGame('Rook', 'Halberd', 1, 3);
  s.threats.nextIn = Infinity;
  s.anomalies.nextIn = Infinity;
  s.trade.nextIn = Infinity;
  s.credits = 1e9;
  s.surveyData = 1000;
  s.research.levels['hyperthought'] = level;
  return s;
}

function startJob(s: GameState) {
  expect(E.startResearch(s, 'depletion_bonus')).toBe(true);
}

describe('Hyperthought Engine', () => {
  it('needs the research before it can switch on', () => {
    const s = lab(0);
    expect(E.setBooster(s, true)).toBe(false);
    s.research.levels['hyperthought'] = 1;
    expect(E.setBooster(s, true)).toBe(true);
  });

  it('burns Survey Data for +30% research speed per level while research runs', () => {
    const s = lab(2);
    startJob(s);
    const base = E.researchSpeed(s);
    E.setBooster(s, true);
    const sd = s.surveyData;
    E.tick(s, 1);
    expect(s.booster.status).toBe('running');
    expect(sd - s.surveyData).toBeCloseTo(E.boosterBurn(s), 6);
    expect(E.boosterBurn(s)).toBeCloseTo(0.2, 9);
    expect(E.researchSpeed(s)).toBeCloseTo(base * 1.6, 9);
  });

  it('finishes research faster than without it', () => {
    const plain = lab(3);
    const boosted = lab(3);
    const sec = E.researchCost(plain, 'depletion_bonus').sec;
    startJob(plain);
    startJob(boosted);
    E.setBooster(boosted, true);
    for (let t = 0; t < Math.ceil(sec / 1.9); t++) {
      E.tick(plain, 1);
      E.tick(boosted, 1);
    }
    expect(boosted.research.levels['depletion_bonus'] ?? 0).toBe(1);
    expect(plain.research.levels['depletion_bonus'] ?? 0).toBe(0);
  });

  it('idles with an empty lab and burns nothing', () => {
    const s = lab(1);
    E.setBooster(s, true);
    const sd = s.surveyData;
    E.tick(s, 5);
    expect(s.booster.status).toBe('idle');
    expect(s.surveyData).toBeGreaterThanOrEqual(sd);
  });

  it('never burns below the reserve, and stalls instead', () => {
    const s = lab(1);
    startJob(s);
    E.setBooster(s, true);
    E.cycleReserve(s); // 50
    expect(s.booster.reserve).toBe(50);
    s.surveyData = 50.05;
    const base = (() => {
      s.booster.running = false;
      return E.researchSpeed(s);
    })();
    E.tick(s, 1);
    expect(s.booster.status).toBe('starved');
    expect(s.surveyData).toBeGreaterThanOrEqual(50);
    expect(E.researchSpeed(s)).toBeCloseTo(base, 9);
  });

  it('burns more in deeper sectors', () => {
    const s = lab(1);
    const shallow = E.boosterBurn(s);
    s.sector.depth = 4;
    expect(E.boosterBurn(s)).toBeCloseTo(shallow * 3, 9);
  });

  it('keeps its settings through a Fold Jump; runs again only if the research came along', () => {
    const s = lab(1);
    E.setBooster(s, true);
    E.cycleReserve(s);
    s.research.levels['fold_drive'] = 1;
    s.fold.charge = 1;
    s.stats.creditsEarned = 1e8;
    const n = F.foldJump(s)!.state;
    expect(n.booster.on).toBe(true);
    expect(n.booster.reserve).toBe(50);
    expect(E.boosterLevel(n)).toBe(0);
    E.tick(n, 1);
    expect(n.booster.status).toBe('off');
  });

  it('older saves load with the engine off', () => {
    const old = E.newGame('Rook', 'Halberd', 1, 5) as unknown as Record<string, unknown>;
    delete old['booster'];
    const m = migrate(old);
    expect(m.version).toBe(CURRENT_VERSION);
    expect(m.booster.on).toBe(false);
    expect(m.booster.reserve).toBe(0);
  });
});
