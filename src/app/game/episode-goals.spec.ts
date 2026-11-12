import { describe, expect, it } from 'vitest';
import * as E from './engine';
import { EPISODES, episodeGoals } from './story-data';
import { GameState } from './types';

function met(n: number, s: GameState): boolean {
  const g = episodeGoals(n, s)!;
  const done = g.goals.map((x) => x.value >= x.target);
  return g.any ? done.some(Boolean) : done.every(Boolean);
}

function veteran(): GameState {
  const s = E.newGame('Rook', 'Halberd', 1, 3);
  s.drones.prospector = 10;
  s.drill.tier = 3;
  s.stats.mechsBuilt = 2;
  s.threats.raids = 10;
  s.threats.raidsWon = 5;
  s.threats.jackalEncounters = 4;
  s.threats.jackalDefeats = 3;
  s.anomalies.lore = 5;
  s.anomalies.codex = { comet: 1, derelict: 1, wormhole: 1, gravity_lens: 1, ghost_signal: 1 };
  s.contracts.standing.meridian = 6;
  s.fold.jumps = 6;
  s.fold.lifetimeResonance = 400;
  s.stats.creditsEarned = s.fold.runStartCredits + 2e6;
  s.sector.depth = 5;
  s.pilots = [{ id: 999, level: 20, story: 'kit' } as unknown as GameState['pilots'][number]];
  return s;
}

describe('episode progress', () => {
  it('every episode after the first has measurable goals', () => {
    for (const e of EPISODES.filter((x) => x.n > 1)) expect(episodeGoals(e.n, E.newGame('Rook', 'Halberd', 1, 3))).not.toBeNull();
  });

  it('the progress bars agree with the real unlock check, fresh and late in the game', () => {
    for (const s of [E.newGame('Rook', 'Halberd', 1, 3), veteran()]) {
      for (const e of EPISODES.filter((x) => x.n > 1)) expect(met(e.n, s), `episode ${e.n}`).toBe(e.trigger(s));
    }
  });

  it("episode 22 is met by either goal: Jackal defeats or base strikes", () => {
    const s = E.newGame('Rook', 'Halberd', 1, 3);
    s.threats.jackalDefeats = 1;
    s.threats.strikesWon = 1;
    expect(met(22, s)).toBe(false);
    s.threats.strikesWon = 2;
    expect(met(22, s)).toBe(true);
    expect(episodeGoals(22, s)!.any).toBe(true);
  });
});
