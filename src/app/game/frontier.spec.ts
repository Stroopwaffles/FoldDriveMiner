import { describe, expect, it } from 'vitest';
import * as E from './engine';
import * as F from './fold-rules';
import { MEDALS } from './medal-data';
import * as ST from './story-rules';
import { GameState } from './types';

function readyAt(depth: number, choice: 'break' | 'master' | null): GameState {
  const s = E.newGame('Rook', 'Halberd', 1, 55);
  s.sector.depth = depth;
  s.story.choice = choice;
  s.research.levels['fold_drive'] = 1;
  s.fold.charge = 1;
  s.stats.creditsEarned = s.fold.runStartCredits + 1e8;
  return s;
}

describe('the charted frontier', () => {
  it('fuel grows x4 to depth 6, x2 to depth 10, then x4 again', () => {
    const c = (d: number) => F.chargeAtDepth(d);
    expect(c(0)).toBe(5e6);
    expect(c(6)).toBe(5e6 * 4 ** 6);
    expect(c(7) / c(6)).toBe(2);
    expect(c(10) / c(6)).toBe(16);
    expect(c(11) / c(10)).toBe(4);
  });

  it('Break the Cycle: the jump to depth 10 brings the epilogue and its commendation', () => {
    const s = F.foldJump(readyAt(9, 'break'))!.state;
    expect(s.sector.depth).toBe(10);
    expect(ST.pendingEpilogue(s)).toBe(true);
    expect(MEDALS.find((m) => m.id === 'beyond_map')!.check(s)).toBe(true);
    expect(ST.watchEpilogue(s)).toBe(true);
    expect(ST.pendingEpilogue(s)).toBe(false);
    // Once watched, later jumps don't bring it back.
    const watched = readyAt(10, 'break');
    watched.story.epilogue = 2;
    expect(F.foldJump(watched)!.state.story.epilogue).toBe(2);
  });

  it('no epilogue for Master the Cycle or before depth 10', () => {
    expect(ST.pendingEpilogue(F.foldJump(readyAt(9, 'master'))!.state)).toBe(false);
    expect(ST.pendingEpilogue(F.foldJump(readyAt(8, 'break'))!.state)).toBe(false);
  });
});
