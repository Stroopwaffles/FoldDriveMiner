import * as E from './engine';
import * as F from './fold-rules';
import { CURRENT_VERSION, migrate } from './save';
import * as S from './sector-rules';
import { GameState } from './types';

function ready(): GameState {
  const s = E.newGame('Rook', 'Halberd', 1, 77);
  s.threats.nextIn = Infinity;
  s.anomalies.nextIn = Infinity;
  s.trade.nextIn = Infinity;
  s.research.levels['fold_drive'] = 1;
  s.fold.charge = 1;
  s.stats.creditsEarned = 1e8;
  return s;
}

describe('drill tier comes from research', () => {
  it('Drill Mk research sets the tier; credits only buy Mk.II', () => {
    const s = ready();
    expect(E.drillTier(s)).toBe(1);
    s.credits = 1e9;
    expect(E.buyDrillTier(s)).toBe(true);
    expect(E.drillTier(s)).toBe(2);
    s.research.levels['drill_mk4'] = 1;
    expect(E.drillTier(s)).toBe(4);
    expect(E.nextTierUpgrade(s)).toBeNull();
    expect(E.oreReachable(s, 'helium3')).toBe(true);
    expect(E.oreReachable(s, 'voidglass')).toBe(false);
  });

  it('archived Drill Mk.III still works after a Fold Jump (the softlock)', () => {
    const s = ready();
    s.research.levels['drill_mk3'] = 1;
    s.fold.core['core_archive'] = 1;
    expect(F.toggleArchive(s, 'drill_mk3')).toBe(true);
    const n = F.foldJump(s)!.state;
    expect(n.research.levels['drill_mk3']).toBe(1);
    expect(E.drillTier(n)).toBe(3);
    expect(E.oreReachable(n, 'iridium')).toBe(true);
    // No pointless Mk.II offer, and deep zones can be scanned.
    expect(E.nextTierUpgrade(n)).toBeNull();
    n.surveyData = 1e6;
    n.sector.charted = 2;
    expect(S.scanBlocker(n)).toBeNull();
  });

  it('archived Drill Mk.IV works even without Mk.III kept', () => {
    const s = ready();
    s.research.levels['drill_mk3'] = 1;
    s.research.levels['drill_mk4'] = 1;
    s.fold.core['core_archive'] = 1;
    F.toggleArchive(s, 'drill_mk4');
    const n = F.foldJump(s)!.state;
    expect(E.drillTier(n)).toBe(4);
  });

  it('the Jump Core head start still counts, and research beats it', () => {
    const s = ready();
    s.fold.core['core_drill'] = 1;
    const n = F.foldJump(s)!.state;
    expect(E.drillTier(n)).toBe(2);
    n.research.levels['drill_mk3'] = 1;
    expect(E.drillTier(n)).toBe(3);
  });

  it('a stuck save loads fixed: research Mk.III with a Mk.II drill', () => {
    const raw = E.newGame('Rook', 'Halberd', 1, 5) as unknown as GameState;
    raw.research.levels['drill_mk3'] = 1;
    raw.drill.tier = 2;
    const m = migrate(JSON.parse(JSON.stringify(raw)));
    expect(m.version).toBe(CURRENT_VERSION);
    expect(E.drillTier(m)).toBe(3);
  });

  it('research effects resync after a jump: refinery slots match the kept levels', () => {
    const s = ready();
    s.research.levels['refinery'] = 1;
    s.research.levels['refinery_slots'] = 2;
    s.fold.core['core_archive'] = 2;
    F.toggleArchive(s, 'refinery');
    F.toggleArchive(s, 'refinery_slots');
    const n = F.foldJump(s)!.state;
    expect(n.refinery.slots.length).toBe(3);
  });
});
