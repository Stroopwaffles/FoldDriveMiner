import { describe, expect, it } from 'vitest';
import * as E from './engine';
import * as S from './sector-rules';
import { THREAT } from './threat-data';
import { MERCHANT } from './trade-data';
import * as TR from './trade-rules';
import { GameState } from './types';

function rich(): GameState {
  const s = E.newGame('Rook', 'Halberd Dawn', 1, 4141);
  s.credits = 1e12;
  s.stats.creditsEarned = 1e6;
  s.threats.nextIn = Infinity;
  s.anomalies.nextIn = Infinity;
  s.trade.nextIn = Infinity;
  return s;
}

function itemFrom(s: GameState, clan: 'lantern' | 'okonkwo', kind: string) {
  for (let i = 0; i < 80; i++) {
    TR.spawnFleet(s, E.emptyEvents(), clan);
    const item = s.trade.fleet!.stock.find((x) => x.kind === kind);
    if (item) return item;
  }
  return null;
}

describe('pirate base intel from traders', () => {
  it('the Lantern Market sells coordinates that locate the base outright', () => {
    const s = rich();
    s.threats.raids = 2;
    expect(itemFrom(s, 'okonkwo', 'base_coords')).toBeNull();
    const item = itemFrom(s, 'lantern', 'base_coords')!;
    expect(item).toBeTruthy();
    expect(TR.buyItem(s, item.id, 'credits', E.emptyEvents())).toBe(true);
    expect(s.threats.baseFound).toBe(true);
  });

  it('Okonkwo sighting reports count as 2 raid wins toward tracing the base', () => {
    const s = rich();
    s.threats.raids = 2;
    s.threats.winsSinceBase = 0;
    const first = itemFrom(s, 'okonkwo', 'pirate_leads')!;
    expect(TR.buyItem(s, first.id, 'credits', E.emptyEvents())).toBe(true);
    expect(s.threats.winsSinceBase).toBe(MERCHANT.leadsWins);
    expect(s.threats.baseFound).toBe(MERCHANT.leadsWins >= THREAT.strike.winsToFind);
    s.threats.winsSinceBase = THREAT.strike.winsToFind - 1;
    const second = itemFrom(s, 'okonkwo', 'pirate_leads')!;
    expect(TR.buyItem(s, second.id, 'credits', E.emptyEvents())).toBe(true);
    expect(s.threats.baseFound).toBe(true);
  });

  it('neither is offered before the first raid or once the base is found', () => {
    const s = rich();
    s.threats.raids = 0;
    expect(itemFrom(s, 'lantern', 'base_coords')).toBeNull();
    expect(itemFrom(s, 'okonkwo', 'pirate_leads')).toBeNull();
    s.threats.raids = 3;
    s.threats.baseFound = true;
    expect(itemFrom(s, 'lantern', 'base_coords')).toBeNull();
    expect(itemFrom(s, 'okonkwo', 'pirate_leads')).toBeNull();
  });

  it('the Lantern Market turns up far more often in a Pirate Haven', () => {
    // Move to a generated sector with the Pirate Haven trait.
    const s = rich();
    let found = false;
    for (let seed = 1; seed < 4000 && !found; seed++) {
      for (const depth of [1, 2, 3]) {
        s.sector.seed = seed;
        s.sector.depth = depth;
        E.syncSector(s);
        if (S.sectorOf(s).traits.includes('pirate_haven')) {
          found = true;
          break;
        }
      }
    }
    expect(found).toBe(true);
    let lantern = 0;
    const n = 400;
    for (let i = 0; i < n; i++) if (TR.spawnFleet(s, E.emptyEvents()).clan === 'lantern') lantern++;
    // 3 of 7 by weight (about 43%), up from 1 in 5.
    expect(lantern / n).toBeGreaterThan(0.33);
  });
});
