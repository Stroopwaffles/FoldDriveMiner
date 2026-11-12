import { describe, expect, it } from 'vitest';
import * as E from './engine';
import { migrate } from './save';
import * as S from './sector-rules';
import { MERCHANT } from './trade-data';
import * as TR from './trade-rules';
import { GameState } from './types';

function inNexus(): GameState {
  const s = E.newGame('Rook', 'Halberd', 1, 12);
  s.stats.creditsEarned = 1e6;
  s.credits = 1e12;
  s.threats.nextIn = Infinity;
  s.anomalies.nextIn = Infinity;
  for (let seed = 1; seed < 6000; seed++) {
    for (const depth of [1, 2, 3, 4]) {
      s.sector.seed = seed;
      s.sector.depth = depth;
      E.syncSector(s);
      if (S.sectorOf(s).traits.includes('trade_nexus')) return s;
    }
  }
  throw new Error('no Trade Nexus sector found');
}

describe('Trade Nexus', () => {
  it('hosts up to three convoys at once, all different clans', () => {
    const s = inNexus();
    expect(TR.maxConvoys(s)).toBe(MERCHANT.nexusConvoys);
    s.trade.nextIn = 0;
    for (let t = 0; t < 4 * 3600 && s.trade.fleets.length < 3; t += 10) {
      for (const f of s.trade.fleets) f.remaining = 1e9; // keep them docked
      E.tick(s, 10);
    }
    expect(s.trade.fleets.length).toBe(3);
    expect(new Set(s.trade.fleets.map((f) => f.clan)).size).toBe(3);
    // No fourth.
    for (let t = 0; t < 2 * 3600; t += 10) {
      for (const f of s.trade.fleets) f.remaining = 1e9;
      E.tick(s, 10);
    }
    expect(s.trade.fleets.length).toBe(3);
  });

  it('you can buy from, and do favors for, each convoy separately', () => {
    const s = inNexus();
    s.trade.fleets = [];
    const a = TR.spawnFleet(s, E.emptyEvents(), 'halcyon');
    const b = TR.spawnFleet(s, E.emptyEvents(), 'okonkwo');
    const item = b.stock.find((x) => !x.dataCores && x.kind !== 'relic')!;
    expect(TR.buyItem(s, item.id, 'credits', E.emptyEvents())).toBe(true);
    expect(item.sold).toBe(true);
    expect(s.trade.rep.okonkwo).toBeGreaterThan(0);
    expect(s.trade.rep.halcyon).toBe(0);
    s.cargo[a.favor!.ore] = a.favor!.amount;
    expect(TR.deliverFavor(s, E.emptyEvents(), 'halcyon')).toBe(true);
    expect(a.favor!.done).toBe(true);
    expect(b.favor!.done).toBe(false);
  });

  it('elsewhere, one convoy at a time', () => {
    const s = E.newGame('Rook', 'Halberd', 1, 12);
    expect(TR.maxConvoys(s)).toBe(1);
  });

  it('old saves with a single convoy load it into the list', () => {
    const old = JSON.parse(JSON.stringify(E.newGame('Rook', 'Halberd', 1, 12)));
    old.stats.creditsEarned = 1e6;
    const s0 = E.newGame('Rook', 'Halberd', 1, 12);
    s0.stats.creditsEarned = 1e6;
    const f = TR.spawnFleet(s0, E.emptyEvents(), 'collegium');
    delete old.trade.fleets;
    old.trade.fleet = JSON.parse(JSON.stringify(f));
    const s = migrate(old);
    expect(s.trade.fleets.length).toBe(1);
    expect(s.trade.fleets[0].clan).toBe('collegium');
    expect((s.trade as unknown as { fleet?: unknown }).fleet).toBeUndefined();
  });
});
