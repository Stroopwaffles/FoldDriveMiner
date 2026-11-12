import * as E from './engine';
import { buyMatrix } from './core-rules';
import { assignPost } from './crew-rules';
import { GameState } from './types';

function fresh(): GameState {
  const s = E.newGame('Rook', 'Halberd', 1, 31);
  s.threats.nextIn = Infinity;
  s.anomalies.nextIn = Infinity;
  s.trade.nextIn = Infinity;
  s.surveyData = 1e6;
  s.credits = 1e9;
  return s;
}

/** Real seconds a research job takes to finish under the current bonuses. */
function secondsToFinish(s: GameState): number {
  expect(E.startResearch(s, 'depletion_bonus')).toBe(true);
  const job = s.research.active[0];
  let t = 0;
  while (s.research.active.some((j) => j === job) && t < 1e5) {
    E.tick(s, 1);
    t += 1;
  }
  return t;
}

describe('research speed bonuses', () => {
  it('base speed: a job takes its listed seconds', () => {
    const s = fresh();
    const sec = E.researchCost(s, 'depletion_bonus').sec;
    expect(secondsToFinish(s)).toBe(sec);
  });

  it('the Core Cache speeds research up by 5% a level', () => {
    const s = fresh();
    const sec = E.researchCost(s, 'depletion_bonus').sec;
    s.dataCores = 100;
    for (let i = 0; i < 4; i++) expect(buyMatrix(s, 'm_research')).toBe(true);
    s.dataCores = 0; // holding 25+ would earn Core Hoarder (+3% research) mid-test
    expect(secondsToFinish(s)).toBe(Math.ceil(sec / 1.2 - 1e-9));
  });

  it('research commendations speed research up', () => {
    const s = fresh();
    const sec = E.researchCost(s, 'depletion_bonus').sec;
    s.story.medals['hoarder'] = 0;
    expect(secondsToFinish(s)).toBe(Math.ceil(sec / 1.03 - 1e-9));
  });

  it('a Science Officer speeds research up by their Instinct', () => {
    const s = fresh();
    const sec = E.researchCost(s, 'depletion_bonus').sec;
    s.research.levels['hangar'] = 1;
    E.ensureCrew(s);
    const p = s.pilots[0];
    expect(assignPost(s, 'science', p.id)).toBe(true);
    const bonus = E.postBonus(s, 'science');
    expect(bonus).toBeGreaterThan(0);
    expect(secondsToFinish(s)).toBe(Math.ceil(sec / (1 + bonus) - 1e-9));
  });

  it('bonuses stack and work offline too', () => {
    const s = fresh();
    s.dataCores = 100;
    for (let i = 0; i < 10; i++) buyMatrix(s, 'm_research');
    s.dataCores = 0;
    s.story.medals['hoarder'] = 0;
    const sec = E.researchCost(s, 'depletion_bonus').sec;
    E.startResearch(s, 'depletion_bonus');
    E.simulateOffline(s, sec / 1.53 + 1);
    expect(s.research.levels['depletion_bonus'] ?? 0).toBe(1);
  });
});

describe('research speed readout', () => {
  it('researchSpeed matches the parts and what the tick uses', () => {
    const s = fresh();
    s.dataCores = 100;
    for (let i = 0; i < 3; i++) buyMatrix(s, 'm_research');
    s.dataCores = 0;
    s.story.medals['hoarder'] = 0;
    const p = E.researchSpeedParts(s);
    expect(p.matrix).toBeCloseTo(0.15, 9);
    expect(p.medals).toBeCloseTo(0.03, 9);
    expect(E.researchSpeed(s)).toBeCloseTo((1 + p.science) * (1 + p.medals + p.matrix), 9);
  });
});
