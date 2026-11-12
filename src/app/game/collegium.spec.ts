import * as E from './engine';
import * as F from './fold-rules';
import { CURRENT_VERSION, migrate } from './save';
import { MERCHANT } from './trade-data';
import * as TR from './trade-rules';
import { GameState } from './types';

function rich(): GameState {
  const s = E.newGame('Rook', 'Halberd Dawn', 1, 9090);
  s.credits = 1e12;
  s.surveyData = 1e6;
  s.stats.creditsEarned = 1e6;
  s.threats.nextIn = Infinity;
  s.anomalies.nextIn = Infinity;
  s.trade.nextIn = Infinity;
  return s;
}

/** Collegium fleets until one stocks the kind we want. */
function collegiumWith(s: GameState, kind: string) {
  for (let i = 0; i < 60; i++) {
    s.trade.fleets = [];
    TR.spawnFleet(s, E.emptyEvents(), 'collegium');
    const item = s.trade.fleets[0]!.stock.find((x) => x.kind === kind);
    if (item) return item;
  }
  throw new Error(`no ${kind} in 60 Collegium visits`);
}

describe('Starward Collegium', () => {
  it('turns up in ordinary sectors as one of the clans', () => {
    const s = rich();
    const seen = new Set<string>();
    for (let i = 0; i < 80; i++) seen.add(TR.spawnFleet(s, E.emptyEvents()).clan);
    expect(seen.has('collegium')).toBe(true);
  });

  it('stocks Data Cores in bigger lots, and research grants', () => {
    const s = rich();
    let grants = 0;
    let cores = 0;
    for (let i = 0; i < 40; i++) {
      const stock = TR.spawnFleet(s, E.emptyEvents(), 'collegium').stock;
      if (stock.some((x) => x.kind === 'research_grant')) grants++;
      for (const x of stock.filter((x) => x.kind === 'data_cores')) {
        cores++;
        expect(x.count!).toBeGreaterThanOrEqual(2);
        expect(x.count!).toBeLessThanOrEqual(4);
      }
    }
    expect(grants).toBeGreaterThan(20);
    expect(cores).toBeGreaterThan(10);
  });

  it('a research grant speeds research up 50% for 15 minutes, then wears off', () => {
    const s = rich();
    const base = E.researchSpeed(s);
    const item = collegiumWith(s, 'research_grant');
    expect(TR.buyItem(s, item.id, 'credits', E.emptyEvents())).toBe(true);
    expect(s.trade.researchGrant).toBe(MERCHANT.grantSec);
    expect(E.researchSpeed(s)).toBeCloseTo(base * 1.5, 9);
    s.trade.fleets = [];
    for (let t = 0; t < MERCHANT.grantSec + 2; t++) E.tick(s, 1);
    expect(s.trade.researchGrant).toBe(0);
    expect(E.researchSpeed(s)).toBeCloseTo(base, 9);
  });

  it('the grant finishes research faster', () => {
    const plain = rich();
    const boosted = rich();
    boosted.trade.researchGrant = 600;
    const sec = E.researchCost(plain, 'depletion_bonus').sec;
    for (const s of [plain, boosted]) expect(E.startResearch(s, 'depletion_bonus')).toBe(true);
    for (let t = 0; t < Math.ceil(sec / 1.5); t++) {
      E.tick(plain, 1);
      E.tick(boosted, 1);
    }
    expect(boosted.research.levels['depletion_bonus'] ?? 0).toBe(1);
    expect(plain.research.levels['depletion_bonus'] ?? 0).toBe(0);
  });

  it('a running grant survives a Fold Jump', () => {
    const s = rich();
    s.trade.researchGrant = 400;
    s.research.levels['fold_drive'] = 1;
    s.fold.charge = 1;
    s.stats.creditsEarned = 1e8;
    const n = F.foldJump(s)!.state;
    expect(n.trade.researchGrant).toBe(400);
  });

  it('Partners can buy the Fellowship: +10% research for good, plus 3 cores', () => {
    const s = rich();
    s.trade.rep.collegium = 30;
    const ex = TR.spawnFleet(s, E.emptyEvents(), 'collegium').stock.find((x) => x.kind === 'exclusive')!;
    expect(ex.label).toBe('Collegium Fellowship');
    const base = E.researchSpeed(s);
    const cores = s.dataCores;
    expect(TR.buyItem(s, ex.id, 'credits', E.emptyEvents())).toBe(true);
    expect(s.dataCores).toBe(cores + 3);
    expect(E.researchSpeedParts(s).fellowship).toBeCloseTo(0.1, 9);
    expect(E.researchSpeed(s)).toBeCloseTo(base * 1.1, 9);
    // Only once.
    expect(TR.spawnFleet(s, E.emptyEvents(), 'collegium').stock.some((x) => x.kind === 'exclusive')).toBe(false);
  });

  it('older saves get Collegium reputation and no grant', () => {
    const old = E.newGame('Rook', 'Halberd', 1, 5) as unknown as { trade: Record<string, unknown> } & Record<string, unknown>;
    delete (old.trade['rep'] as Record<string, number>)['collegium'];
    delete old.trade['researchGrant'];
    const m = migrate(old);
    expect(m.version).toBe(CURRENT_VERSION);
    expect(m.trade.rep.collegium).toBe(0);
    expect(m.trade.researchGrant).toBe(0);
  });
});
