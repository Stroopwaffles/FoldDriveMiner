import { describe, expect, it } from 'vitest';
import * as E from './engine';
import * as F from './fold-rules';
import { MEDALS } from './medal-data';
import { LAST_OFFER } from './story-data';
import * as ST from './story-rules';
import { GameState } from './types';

/** A Master the Cycle save at depth 6, ready to Deep Fold. */
function master(deepFolds = 0): GameState {
  const s = E.newGame('Rook', 'Halberd', 1, 77);
  s.story.choice = 'master';
  s.sector.depth = 6;
  s.research.levels['fold_drive'] = 1;
  s.fold.charge = 1;
  s.fold.lifetimeResonance = 5000;
  s.fold.deepFolds = deepFolds;
  s.stats.creditsEarned = s.fold.runStartCredits + 1e9;
  return s;
}

function deepFold(s: GameState): GameState {
  const r = F.foldJump(s, Date.now(), true);
  expect(r).not.toBeNull();
  return r!.state;
}

describe('Master the Cycle ending and the last offer', () => {
  it('the first Deep Fold brings the Master epilogue and its commendation', () => {
    const s = deepFold(master());
    expect(ST.pendingMasterEnding(s)).toBe(true);
    expect(MEDALS.find((m) => m.id === 'long_harvest')!.check(s)).toBe(true);
    expect(ST.pendingOffer(s)).toBe(false);
    expect(ST.watchMasterEnding(s)).toBe(true);
    expect(ST.pendingMasterEnding(s)).toBe(false);
  });

  it('after enough Deep Folds the Jackal makes her offer; refusing brings it back after the next one', () => {
    let s = master(LAST_OFFER.afterDeepFolds - 1);
    s.story.masterEnding = 2;
    s = deepFold(s);
    expect(ST.pendingOffer(s)).toBe(true);
    expect(ST.answerOffer(s, 'master')).toBe(true);
    expect(s.story.choice).toBe('master');
    expect(ST.pendingOffer(s)).toBe(false);
    // An ordinary jump doesn't bring it back...
    s.sector.depth = 6;
    s.fold.charge = 1;
    s.stats.creditsEarned = s.fold.runStartCredits + 1e9;
    s.fold.lifetimeResonance = 5000;
    const plain = F.foldJump(s)!.state;
    expect(ST.pendingOffer(plain)).toBe(false);
    // ...the next Deep Fold does.
    s = deepFold(s);
    expect(ST.pendingOffer(s)).toBe(true);
  });

  it('accepting switches the save to Break the Cycle for good, and the frontier epilogue follows', () => {
    let s = master(LAST_OFFER.afterDeepFolds - 1);
    s = deepFold(s);
    expect(ST.answerOffer(s, 'break')).toBe(true);
    expect(s.story.choice).toBe('break');
    expect(s.story.offer).toBe(3);
    expect(MEDALS.find((m) => m.id === 'second_chance')!.check(s)).toBe(true);
    expect(F.canDeepFold(s)).toBe('Only after Master the Cycle');
    // No more offers once accepted.
    expect(ST.answerOffer(s, 'master')).toBe(false);
    // Reaching the frontier now brings the Break epilogue.
    s.sector.depth = 9;
    s.fold.charge = 1;
    s.stats.creditsEarned = s.fold.runStartCredits + 1e9;
    const frontier = F.foldJump(s)!.state;
    expect(ST.pendingEpilogue(frontier)).toBe(true);
  });

  it('Break the Cycle players never get the Master ending or the offer', () => {
    const s = E.newGame('Rook', 'Halberd', 1, 77);
    s.story.choice = 'break';
    s.fold.deepFolds = 5;
    s.story.offer = 1;
    expect(ST.pendingOffer(s)).toBe(false);
    expect(ST.answerOffer(s, 'break')).toBe(false);
  });
});
