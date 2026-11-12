import { describe, expect, it } from 'vitest';
import * as E from './engine';
import * as F from './fold-rules';
import { MEDALS } from './medal-data';
import { migrate } from './save';
import * as TR from './trade-rules';

describe('convoys hosted', () => {
  it('counts every convoy over the whole save, through Fold Jumps', () => {
    let s = E.newGame('Rook', 'Halberd', 1, 3);
    s.stats.creditsEarned = 1e6;
    for (let i = 0; i < 3; i++) TR.spawnFleet(s, E.emptyEvents());
    expect(s.stats.convoysHosted).toBe(3);
    s.research.levels['fold_drive'] = 1;
    s.fold.charge = 1;
    s.stats.creditsEarned = 1e8;
    s = F.foldJump(s)!.state;
    expect(s.trade.visits).toBe(0);
    for (let i = 0; i < 3; i++) TR.spawnFleet(s, E.emptyEvents());
    expect(s.stats.convoysHosted).toBe(6);
    expect(MEDALS.find((m) => m.id === 'convoys_1')!.check(s)).toBe(true);
  });

  it('old saves start from this run plus what an earlier commendation proves', () => {
    const old = JSON.parse(JSON.stringify(E.newGame('Rook', 'Halberd', 1, 3)));
    delete old.stats.convoysHosted;
    old.trade.visits = 4;
    old.story.medals = { convoys_1: 14295 };
    old.story.logbook = [{ ...old.story.logbook[0], arrived: 29040 }];
    expect(migrate(old).stats.convoysHosted).toBe(9);

    // Earned this run: those convoys are already in this run's visits.
    const same = JSON.parse(JSON.stringify(E.newGame('Rook', 'Halberd', 1, 3)));
    delete same.stats.convoysHosted;
    same.trade.visits = 6;
    same.story.medals = { convoys_1: 500 };
    same.story.logbook = [{ ...same.story.logbook[0], arrived: 100 }];
    expect(migrate(same).stats.convoysHosted).toBe(6);
  });
});
