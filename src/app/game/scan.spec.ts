import * as E from './engine';
import * as F from './fold-rules';
import { CURRENT_VERSION, migrate } from './save';
import { SCAN } from './sector-data';
import * as S from './sector-rules';
import { GameState } from './types';

function fresh(): GameState {
  const s = E.newGame('Rook', 'Halberd Dawn', 1, 4242);
  s.threats.nextIn = Infinity;
  s.anomalies.nextIn = Infinity;
  s.trade.nextIn = Infinity;
  s.surveyData = 1e6;
  return s;
}

function finishScan(s: GameState): void {
  E.tick(s, (s.sector.scan?.remaining ?? 0) + 0.1);
}

describe('sector scans', () => {
  it('a new game has only the inner zone charted', () => {
    const s = fresh();
    expect(S.chartedZones(s)).toBe(1);
    expect(E.zoneUnlocked(s, 'inner')).toBe(true);
    expect(E.zoneUnlocked(s, 'trojan')).toBe(false);
  });

  it('cost Survey Data, take time, and chart the next zone', () => {
    const s = fresh();
    const sd = s.surveyData;
    expect(S.startScan(s)).toBe(true);
    expect(s.surveyData).toBe(sd - SCAN.cost[1]);
    expect(S.startScan(s)).toBe(false); // one at a time
    E.tick(s, SCAN.sec[1] - 1);
    expect(E.zoneUnlocked(s, 'trojan')).toBe(false);
    const ev = E.tick(s, 2);
    expect(ev.charted).toEqual(['Trojan Cluster']);
    expect(E.zoneUnlocked(s, 'trojan')).toBe(true);
    expect(E.setZone(s, 'trojan')).toBe(true);
  });

  it('need Survey Data, and a drill that can reach the outer zones', () => {
    const s = fresh();
    s.surveyData = 0;
    expect(S.scanBlocker(s)).toBe('Not enough Survey Data');
    s.surveyData = 1e6;
    S.startScan(s);
    finishScan(s);
    expect(S.scanBlocker(s)).toMatch(/Mk\.III/);
    s.drill.tier = 3;
    expect(S.scanBlocker(s)).toBeNull();
  });

  it('cancelling refunds the Survey Data', () => {
    const s = fresh();
    const sd = s.surveyData;
    S.startScan(s);
    expect(S.cancelScan(s)).toBe(true);
    expect(s.surveyData).toBe(sd);
    expect(s.sector.scan).toBeNull();
  });

  it('cost more in deeper sectors, and Deep Scan Array speeds them up', () => {
    const s = fresh();
    const near = S.scanCost(s, 2);
    s.sector.depth = 4;
    expect(S.scanCost(s, 2).sd).toBe(Math.ceil(SCAN.cost[2] * 2));
    s.research.levels['deep_scan'] = 2;
    expect(S.scanCost(s, 2).sec).toBe(Math.ceil(near.sec / 2));
  });

  it('stop once the whole sector is charted', () => {
    const s = fresh();
    s.drill.tier = 5;
    for (let i = 0; i < 4; i++) {
      expect(S.startScan(s)).toBe(true);
      finishScan(s);
    }
    expect(S.chartedZones(s)).toBe(5);
    expect(S.scanBlocker(s)).toBe('Sector fully charted');
  });

  it('run while you are away', () => {
    const s = fresh();
    S.startScan(s);
    E.simulateOffline(s, 600);
    expect(S.chartedZones(s)).toBe(2);
  });

  it('a new sector starts uncharted after a Fold Jump', () => {
    const s = fresh();
    s.sector.charted = 4;
    s.research.levels['fold_drive'] = 1;
    s.fold.charge = 1;
    s.stats.creditsEarned = 1e8;
    const n = F.foldJump(s)!.state;
    expect(n.sector.charted).toBe(1);
    expect(n.sector.scan).toBeNull();
  });
});

describe('research that depends on the sector', () => {
  it('Drill Mk.V needs Voidglass in the sector, charted', () => {
    const s = fresh();
    s.drill.tier = 4;
    // Find a generated 4-zone sector without a black hole: no Voidglass at all.
    for (let seed = 1; seed < 500; seed++) {
      const def = S.generateSector(seed, 3);
      if (def.zones.length === 4 && !def.zones.some((z) => (z.composition.voidglass ?? 0) > 0)) {
        s.sector = { ...s.sector, seed, depth: 3, charted: 4, scan: null };
        E.syncSector(s);
        expect(E.researchStatus(s, 'drill_mk5')).toBe('locked');
        expect(E.researchBlocker(s, 'drill_mk5')).toBe('No Voidglass in this sector');
        return;
      }
    }
    throw new Error('no voidglass-free sector found');
  });

  it('at home, Drill Mk.V opens once the Deep Field is charted', () => {
    const s = fresh();
    s.drill.tier = 4;
    s.credits = 1e12;
    s.sector.charted = 4;
    expect(E.researchBlocker(s, 'drill_mk5')).toMatch(/Scan the sector/);
    s.sector.charted = 5;
    expect(E.researchBlocker(s, 'drill_mk5')).toBeNull();
  });
});

describe('saves', () => {
  it('a version 12 save keeps the zones its Survey Range research opened', () => {
    const v12 = E.newGame('Rook', 'Halberd', 1, 99) as unknown as Record<string, unknown>;
    v12['version'] = 12;
    const research = v12['research'] as { levels: Record<string, number>; active: unknown[] };
    research.levels['survey_trojan'] = 1;
    research.levels['survey_ring'] = 1;
    research.active = [{ id: 'survey_ice', level: 1, remaining: 10, duration: 20, paidSd: 60, paidCr: 600000 }];
    const sector = v12['sector'] as Record<string, unknown>;
    delete sector['charted'];
    delete sector['scan'];
    v12['credits'] = 0;
    v12['surveyData'] = 0;
    const m = migrate(v12);
    expect(m.version).toBe(CURRENT_VERSION);
    expect(m.sector.charted).toBe(3);
    expect(m.research.levels['survey_trojan']).toBeUndefined();
    expect(m.research.active.length).toBe(0);
    expect(m.surveyData).toBe(60);
    expect(m.credits).toBe(600000);
  });
});
