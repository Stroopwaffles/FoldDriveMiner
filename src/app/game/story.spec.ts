import * as E from './engine';
import * as F from './fold-rules';
import { MEDALS } from './medal-data';
import { CURRENT_VERSION, migrate } from './save';
import { EPISODES, FINAL_EPISODE } from './story-data';
import * as ST from './story-rules';
import * as T from './threat-rules';
import { GameState, TickEvents } from './types';

function fresh(): GameState {
  const s = E.newGame('Rook', 'Halberd Dawn', 1, 4242);
  s.threats.nextIn = Infinity;
  s.anomalies.nextIn = Infinity;
  s.trade.nextIn = Infinity;
  return s;
}

function story(s: GameState): TickEvents['story'] {
  const ev = E.emptyEvents();
  ST.advanceStory(s, ev);
  return ev.story;
}

function jumpReady(s: GameState): GameState {
  s.research.levels['fold_drive'] = 1;
  s.fold.charge = 1;
  s.stats.creditsEarned = 1e8;
  return s;
}

describe('milestone 7: episodes', () => {
  it('there are 26 episodes in 3 acts, numbered in order', () => {
    expect(EPISODES.length).toBe(26);
    expect(EPISODES.map((e) => e.n)).toEqual(Array.from({ length: 26 }, (_, i) => i + 1));
    expect(new Set(EPISODES.map((e) => e.act))).toEqual(new Set([1, 2, 3]));
  });

  it('a new game has seen Episode 1 and opened its logbook', () => {
    const s = fresh();
    expect(s.story.unlocked).toBe(1);
    expect(s.story.watched).toBe(1);
    expect(s.story.logbook.length).toBe(1);
    expect(ST.currentLog(s)!.code).toBe(s.sector.code);
  });

  it('episodes arrive in order and queue up', () => {
    const s = fresh();
    s.drill.tier = 2; // Episode 3's trigger, but Episode 2 hasn't happened
    expect(story(s).filter((x) => x.kind === 'episode')).toEqual([]);
    s.drones.prospector = 1;
    const eps = story(s).filter((x) => x.kind === 'episode').map((x) => x.id);
    expect(eps).toEqual(['2', '3']);
    expect(ST.pendingEpisode(s)).toBe(2);
    expect(ST.watchEpisode(s, 3)).toBe(false); // out of order
    expect(ST.watchEpisode(s, 2)).toBe(true);
    expect(ST.pendingEpisode(s)).toBe(3);
  });

  it('Saffi and Ansel join through their episodes, already seasoned', () => {
    const s = fresh();
    s.story.unlocked = 9;
    s.fold.jumps = 1;
    s.threats.raidsWon = 3;
    story(s);
    const saffi = s.pilots.find((p) => p.story === 'saffi');
    expect(saffi?.level).toBe(12);
    expect(s.story.unlocked).toBe(10);
    s.anomalies.codex = { gravity_lens: 1, derelict: 1, comet: 1, ion_cloud: 1, silent_beacon: 1 } as never;
    s.stats.creditsEarned = 2e6;
    story(s);
    expect(s.pilots.some((p) => p.story === 'ansel')).toBe(true);
    expect(s.story.unlocked).toBeGreaterThanOrEqual(12);
  });

  it('the finale needs a choice, and the choice is permanent', () => {
    const s = fresh();
    s.story.unlocked = FINAL_EPISODE;
    s.story.watched = FINAL_EPISODE - 1;
    expect(ST.watchEpisode(s, FINAL_EPISODE)).toBe(false);
    expect(ST.chooseFinale(s, 'break')).toBe(true);
    expect(s.story.watched).toBe(FINAL_EPISODE);
    expect(ST.chooseFinale(s, 'master')).toBe(false);
    expect(s.story.choice).toBe('break');
  });
});

describe('milestone 7: commendations', () => {
  it('about 80 commendations with unique ids across 8 categories', () => {
    expect(MEDALS.length).toBeGreaterThanOrEqual(80);
    expect(new Set(MEDALS.map((m) => m.id)).size).toBe(MEDALS.length);
    expect(new Set(MEDALS.map((m) => m.category)).size).toBe(8);
  });

  it('are awarded once and grant small permanent bonuses', () => {
    const s = fresh();
    const power = E.drillPower(s);
    const price = E.orePrice(s, 'ferrite');
    s.stats.asteroidsCracked = 10;
    s.stats.creditsEarned = 1e4;
    const got = story(s).filter((x) => x.kind === 'medal').map((x) => x.id);
    expect(got).toContain('crack_1');
    expect(got).toContain('credits_1');
    expect(story(s).filter((x) => x.kind === 'medal')).toEqual([]);
    expect(E.drillPower(s)).toBeCloseTo(power * 1.02, 6);
    expect(E.orePrice(s, 'ferrite')).toBeCloseTo(price * 1.01, 6);
  });

  it('commendations and story progress survive a Fold Jump', () => {
    const s = jumpReady(fresh());
    s.story.medals['crack_1'] = 5;
    s.story.unlocked = 7;
    s.story.watched = 5;
    const n = F.foldJump(s)!.state;
    expect(n.story.medals['crack_1']).toBe(5);
    expect(n.story.unlocked).toBe(7);
    expect(n.story.watched).toBe(5);
  });
});

describe('milestone 7: the Sector Logbook and dossiers', () => {
  it('closes the old sector and opens the new one on a jump', () => {
    const s = jumpReady(fresh());
    s.playtimeSec = 600;
    const gain = F.resonanceGain(s);
    const n = F.foldJump(s)!.state;
    expect(n.story.logbook.length).toBe(2);
    const [home, here] = n.story.logbook;
    expect(home.left).toBe(600);
    expect(home.resonance).toBe(gain);
    expect(ST.logTotals(n, home).credits).toBe(1e8);
    expect(here.left).toBeNull();
    expect(here.code).toBe(n.sector.code);
    expect(here.depth).toBe(1);
    n.stats.creditsEarned += 500;
    expect(ST.logTotals(n, here).credits).toBe(500);
  });

  it('keeps a dossier for dismissed pilots', () => {
    const s = fresh();
    s.research.levels['hangar'] = 1;
    E.ensureCrew(s);
    const r = s.recruits[0];
    s.credits = 1e9;
    E.hirePilot(s, 0);
    expect(E.dismissPilot(s, r.id)).toBe(true);
    expect(s.story.dismissed.map((d) => d.name)).toEqual([r.name]);
  });
});

describe('milestone 7: the finale branches', () => {
  it('Break the Cycle: gentler jumps, less Resonance, no Jackal, calmer pirates', () => {
    const s = jumpReady(fresh());
    const base = F.resonanceGain(s);
    const heat = T.heatPerSec(s);
    const slots = F.archiveSlots(s);
    s.story.choice = 'break';
    expect(F.resonanceGain(s)).toBe(Math.floor(base * 0.75));
    expect(T.heatPerSec(s)).toBeCloseTo(heat / 2, 9);
    expect(F.archiveSlots(s)).toBe(slots + 2);
    s.threats.raids = 2; // the Jackal's first appearance would be the 3rd raid
    const ev = T.startEvent(s, 'raid', E.emptyEvents());
    expect(ev.jackal).toBe(false);
    s.drones.prospector = 200;
    const n = F.foldJump(s)!.state;
    expect(n.drones.prospector).toBe(20);
    expect(n.story.side).toBe(1);
    expect(ST.pendingSide(n)).toBe(1);
  });

  it('Master the Cycle: more Resonance and a stronger Jackal', () => {
    const s = jumpReady(fresh());
    const base = F.resonanceGain(s);
    const jackal = T.jackalStrengthMult(s);
    s.story.choice = 'master';
    expect(F.resonanceGain(s)).toBe(Math.floor(base * 1.5));
    expect(T.jackalStrengthMult(s)).toBeCloseTo(jackal * 1.5, 9);
  });
});

describe('milestone 7: saves', () => {
  it('migrates a version 7 save', () => {
    const v7 = E.newGame('Rook', 'Halberd', 1, 99) as unknown as Record<string, unknown>;
    v7['version'] = 7;
    delete v7['story'];
    const m = migrate(v7);
    expect(m.version).toBe(CURRENT_VERSION);
    expect(m.story.watched).toBe(1);
    expect(m.story.logbook.length).toBe(1);
    expect(m.story.logbook[0].start.credits).toBe(0);
    expect(m.story.logbook[0].code).toBe(m.sector.code);
  });
});
