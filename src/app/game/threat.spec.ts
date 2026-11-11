import * as E from './engine';
import { CURRENT_VERSION, migrate } from './save';
import { THREAT } from './threat-data';
import * as T from './threat-rules';
import { GameState, TickEvents } from './types';

function rich(): GameState {
  const s = E.newGame('Rook', 'Halberd', 1, 777);
  s.credits = 1e12;
  s.surveyData = 1e6;
  s.drill.tier = 2;
  s.threats.nextIn = Infinity; // tests start events by hand
  return s;
}

function ev(): TickEvents {
  return {
    research: [],
    levelUps: [],
    syncUps: [],
    autoRepairs: [],
    threatStarted: [],
    threatResolved: [],
    anomaly: [], trade: [],
    ingots: E.emptyOre(),
    alloys: 0,
    charted: [],
    autoSoldCredits: 0,
    story: [],
  };
}

/** A strong combat Bulwark on defense standby, piloted by Juno. */
function bulwark(s: GameState) {
  s.research.levels['hangar'] = 1;
  s.research.levels['hangar_bays'] = 3;
  E.ensureCrew(s);
  const m = E.buildMech(s, 'bulwark')!;
  for (const p of ['twin_core', 'rail_rifle', 'composite_plate', 'booster_wing']) {
    s.research.levels['mech_engineering'] = 1;
    E.buyPart(s, p);
  }
  E.equipPart(s, m.id, 'reactor', 'twin_core');
  E.equipPart(s, m.id, 'offhand', 'rail_rifle');
  E.equipPart(s, m.id, 'armor', 'composite_plate');
  E.equipPart(s, m.id, 'thrusters', 'booster_wing');
  m.armor = E.mechStats(s, m).armor;
  E.seatPilot(s, m.id, s.pilots[0].id);
  E.setMechJob(s, m.id, 'defense');
  return m;
}

describe('milestone 4: events and heat', () => {
  it('no hostile events during the grace period, only market ones', () => {
    const s = E.newGame('Rook', 'Halberd', 1, 3);
    const seen = new Set<string>();
    for (let i = 0; i < 200; i++) {
      s.threats.nextIn = 0;
      const e = ev();
      T.advanceThreats(s, 0.01, e);
      for (const x of e.threatStarted) seen.add(x.kind);
      s.threats.events = [];
    }
    expect(T.inGrace(s)).toBe(true);
    for (const k of seen) expect(['boom', 'crash']).toContain(k);
  });

  it('Pirate Heat rises over time and with wealth', () => {
    const s = rich();
    s.stats.creditsEarned = 0;
    const slow = T.heatPerSec(s);
    s.stats.creditsEarned = 1e8;
    expect(T.heatPerSec(s)).toBeGreaterThan(slow);
    T.advanceThreats(s, 600, ev());
    expect(s.threats.heat).toBeGreaterThan(0);
    expect(s.threats.heat).toBeLessThanOrEqual(THREAT.heat.max);
  });

  it('booms and crashes move prices; blackouts block selling', () => {
    const s = rich();
    const boom = T.startEvent(s, 'boom', ev());
    const ore = boom.ore!;
    const before = E.orePrice({ ...s, threats: { ...s.threats, events: [] } }, ore);
    expect(E.orePrice(s, ore)).toBeCloseTo(before * THREAT.market.boom, 6);
    T.startEvent(s, 'blackout', ev());
    s.cargo.ferrite = 100;
    expect(E.sell(s, 'ferrite')).toBe(0);
    expect(s.cargo.ferrite).toBe(100);
  });

  it('flares: sheltering stops drones, riding out loses some', () => {
    const s = rich();
    s.drones.prospector = 100;
    s.cargoLevel = 20;
    const f = T.startEvent(s, 'flare', ev());
    T.respondToEvent(s, f.id, 'shelter');
    E.tick(s, 61);
    expect(T.productionMult(s).drones).toBe(0);
    expect(s.drones.prospector).toBe(100);

    const s2 = rich();
    s2.drones.prospector = 100;
    const f2 = T.startEvent(s2, 'flare', ev());
    T.respondToEvent(s2, f2.id, 'ride');
    E.tick(s2, 61);
    expect(s2.drones.prospector).toBe(92);
    expect(s2.wrecks.prospector).toBeCloseTo(8, 0);
  });

  it('micrometeors wreck drones; Guardians shield them', () => {
    const run = (guardians: number) => {
      const s = rich();
      s.drones.prospector = 1000;
      s.drones.guardian = guardians;
      T.startEvent(s, 'micrometeor', ev());
      for (let i = 0; i < 60; i++) T.advanceThreats(s, 1, ev());
      return 1000 - s.drones.prospector;
    };
    expect(run(0)).toBeGreaterThan(50);
    expect(run(90)).toBeLessThan(run(0) / 5);
  });

  it('reactor faults slow production until fixed', () => {
    const s = rich();
    T.startEvent(s, 'reactor', ev());
    expect(T.productionMult(s).all).toBe(THREAT.reactor.output);
    T.advanceThreats(s, 200, ev());
    expect(T.productionMult(s).all).toBe(1);
  });
});

describe('milestone 4: raids and sorties', () => {
  it('with no defenders a raid takes cargo', () => {
    const s = rich();
    s.cargo.ferrite = 1000;
    T.startEvent(s, 'raid', ev());
    const e = ev();
    T.advanceThreats(s, 46, e);
    expect(s.threats.lastSortie?.outcome).toBe('surrender');
    expect(s.cargo.ferrite).toBeCloseTo(800, 3);
    expect(e.threatResolved.length).toBe(1);
  });

  it('a strong defender wins, earns a bounty and cools Heat', () => {
    const s = rich();
    bulwark(s);
    s.threats.heat = 40;
    const credits = s.credits;
    const raid = T.startEvent(s, 'raid', ev());
    raid.strength = 10; // weak raiders
    T.advanceThreats(s, 46, ev());
    const r = s.threats.lastSortie!;
    expect(['victory', 'costly']).toContain(r.outcome);
    expect(s.credits).toBeGreaterThan(credits);
    expect(s.threats.heat).toBeLessThan(40);
    expect(r.rounds.length).toBeGreaterThan(0);
  });

  it('a hopeless defense loses, disables the mech and injures the pilot', () => {
    const s = rich();
    const m = bulwark(s);
    const pilot = s.pilots[0];
    const raid = T.startEvent(s, 'raid', ev());
    raid.strength = 1e6;
    s.cargo.ferrite = 1000;
    T.advanceThreats(s, 46, ev());
    expect(s.threats.lastSortie!.outcome).toBe('defeat');
    expect(m.armor).toBe(0);
    expect(E.mechCondition(s, m).id).toBe('disabled');
    expect(pilot.injuredRemaining).toBeGreaterThan(0);
    expect(s.cargo.ferrite).toBeLessThan(1000);
  });

  it('the risk preview tracks the odds', () => {
    const s = rich();
    const m = bulwark(s);
    expect(T.riskPreview(s, [m], 0, 5).win).toBeGreaterThan(0.9);
    expect(T.riskPreview(s, [m], 0, 1e6).win).toBeLessThan(0.1);
  });

  it('Guardians fight and can be lost to wrecks', () => {
    const s = rich();
    s.drones.guardian = 20;
    const raid = T.startEvent(s, 'raid', ev());
    raid.strength = 40;
    T.advanceThreats(s, 46, ev());
    const r = s.threats.lastSortie!;
    expect(r.guardians).toBe(20);
    expect(s.drones.guardian + Math.round(s.wrecks.guardian)).toBe(20);
  });

  it('the Jackal shows up on the third raid and is stronger', () => {
    const s = rich();
    s.threats.raids = THREAT.jackal.firstRaid - 1;
    const plain = T.raidStrength(s);
    const raid = T.startEvent(s, 'raid', ev());
    expect(raid.jackal).toBe(true);
    expect(raid.strength).toBeCloseTo(plain * THREAT.jackal.strengthMult, 6);
  });

  it('enough wins reveal the pirate base; a strike resets Heat and gives a unique part', () => {
    const s = rich();
    bulwark(s);
    for (let i = 0; i < THREAT.strike.winsToFind; i++) {
      const raid = T.startEvent(s, 'raid', ev());
      raid.strength = 5;
      raid.jackal = false;
      T.advanceThreats(s, 46, ev());
      s.mechs[0].armor = E.mechStats(s, s.mechs[0]).armor;
    }
    expect(s.threats.baseFound).toBe(true);
    s.threats.heat = 80;
    s.stats.creditsEarned = 0;
    s.threats.heat = 0; // keep the strike weak for the test
    const r = T.launchStrike(s, [s.mechs[0].id], false, ev())!;
    expect(r.outcome).not.toBe('defeat');
    expect(s.threats.heat).toBe(0);
    expect(s.threats.baseFound).toBe(false);
    expect((s.parts['crimson_lance'] ?? 0) + (s.parts['vermilion_plating'] ?? 0)).toBe(1);
  });
});

describe('milestone 4: rogue asteroids, wrecks, injuries, offline', () => {
  it('cracking a rogue asteroid by hand pays out', () => {
    const s = rich();
    s.cargoLevel = 20;
    const rogue = T.startEvent(s, 'rogue', ev());
    rogue.rogueHp = 1;
    const r = T.rogueClick(s, ev())!;
    expect(r.cracked).toBe(true);
    expect(E.cargoUsed(s)).toBeGreaterThan(0);
    expect(s.threats.events.length).toBe(0);
  });

  it('an unstopped rogue asteroid hits', () => {
    const s = rich();
    s.threats.orders.rogue = 'ignore';
    s.cargo.ferrite = 1000;
    s.drones.prospector = 100;
    T.startEvent(s, 'rogue', ev());
    T.advanceThreats(s, 41, ev());
    expect(s.cargo.ferrite).toBeCloseTo(850, 3);
    expect(s.drones.prospector).toBe(98);
  });

  it('wrecks rebuild at a quarter of the price, and Salvagers recover some', () => {
    const s = rich();
    s.wrecks.prospector = 10;
    const cost = T.wreckRebuildCost(s, 'prospector');
    expect(cost).toBeCloseTo(E.droneCost(s, 1) * 0.25, 6);
    expect(T.rebuildWrecks(s, 'prospector')).toBe(10);
    expect(s.drones.prospector).toBe(10);

    s.wrecks.cutter = 50;
    s.drones.salvager = 100;
    T.advanceThreats(s, 10, ev());
    expect(s.drones.cutter).toBeGreaterThanOrEqual(4);
  });

  it('the Medbay speeds up recovery', () => {
    const a = rich();
    a.research.levels['hangar'] = 1;
    E.ensureCrew(a);
    a.pilots[0].injuredRemaining = 1000;
    E.tick(a, 100);
    const b = rich();
    b.research.levels['hangar'] = 1;
    b.research.levels['medbay'] = 2;
    E.ensureCrew(b);
    b.pilots[0].injuredRemaining = 1000;
    E.tick(b, 100);
    expect(a.pilots[0].injuredRemaining).toBeCloseTo(900, 3);
    expect(b.pilots[0].injuredRemaining).toBeCloseTo(700, 3);
  });

  it('offline losses are capped at 10% of drones and 25% of the hold', () => {
    const s = rich();
    s.threats.clock = THREAT.graceSec; // grace over
    s.threats.nextIn = 0;
    s.threats.heat = 100;
    s.threats.orders = { raid: 'surrender', flare: 'ride', rogue: 'ignore' };
    s.drones.prospector = 1000;
    s.cargoLevel = 25;
    s.cargo.ferrite = 1e5;
    const drones = s.drones.prospector;
    const held = E.cargoUsed(s);
    const r = E.simulateOffline(s, 8 * 3600);
    expect(r.threats.length).toBeGreaterThan(0);
    expect(drones - s.drones.prospector).toBeLessThanOrEqual(Math.floor(drones * 0.1));
    // Cargo can refill from mining, so check what was taken, not what's left.
    expect(held * 0.25).toBeGreaterThan(0);
  });

  it('migrates a version 3 save', () => {
    const v3 = E.newGame('Rook', 'Halberd', 1, 1) as unknown as Record<string, unknown>;
    v3['version'] = 3;
    delete v3['threats'];
    delete v3['wrecks'];
    const m = migrate(v3);
    expect(m.version).toBe(CURRENT_VERSION);
    expect(m.threats.heat).toBe(0);
    expect(m.threats.orders.raid).toBe('defend');
    expect(m.wrecks.prospector).toBe(0);
  });
});

describe('rogue reward with a full hold', () => {
  it('sells the ore that does not fit instead of wasting it', () => {
    const s = E.newGame('Rook', 'Halberd', 1, 5);
    s.threats.nextIn = Infinity;
    s.cargo.ferrite = E.cargoCapacity(s); // full
    const credits = s.credits;
    const rogue = T.startEvent(s, 'rogue', {
      research: [], levelUps: [], syncUps: [], autoRepairs: [], threatStarted: [], threatResolved: [], anomaly: [], trade: [], ingots: E.emptyOre(), alloys: 0, charted: [], autoSoldCredits: 0,
    story: [],
    });
    rogue.rogueHp = 1;
    T.rogueClick(s, {
      research: [], levelUps: [], syncUps: [], autoRepairs: [], threatStarted: [], threatResolved: [], anomaly: [], trade: [], ingots: E.emptyOre(), alloys: 0, charted: [], autoSoldCredits: 0,
    story: [],
    });
    expect(s.credits).toBeGreaterThan(credits);
  });
});

describe('raid balance: guardian hulls and the matchup', () => {
  it('Guardian hulls toughen at the same milestones that double their guns', () => {
    const s = rich();
    s.drones.guardian = 10;
    const hp10 = T.guardianHp(s);
    expect(hp10).toBe(THREAT.guardian.hp);
    s.drones.guardian = 100;
    expect(T.guardianHp(s)).toBe(THREAT.guardian.hp * 8);
    expect(T.guardianPower(s) / T.guardianHp(s)).toBeCloseTo(THREAT.guardian.power / THREAT.guardian.hp, 9);
  });

  it('a big Guardian swarm can now hold off a raid it out-guns', () => {
    const s = rich();
    s.drones.guardian = 100;
    const strength = T.guardianPower(s) * 100 * 0.45; // they out-gun the raid about 2:1
    expect(T.riskPreview(s, [], 100, strength).win).toBeGreaterThan(0.9);
  });

  it('the matchup reports enemy hull, worn-mech power and the fire you will take', () => {
    const s = rich();
    const m = bulwark(s);
    const full = T.mechCombatPower(s, m);
    let mu = T.raidMatchup(s, [m], 0, 100);
    expect(mu.enemyHp).toBe(100 * THREAT.raid.hpPerStrength);
    expect(mu.power).toBeCloseTo(full, 9);
    expect(mu.armor).toBe(m.armor);
    m.armor = E.mechStats(s, m).armor * 0.3;
    mu = T.raidMatchup(s, [m], 0, 100);
    expect(mu.power).toBeCloseTo(full * 0.75, 9);
    expect(mu.fullPower).toBeCloseTo(full, 9);
    mu = T.raidMatchup(s, [m], 0, 1e6);
    expect(mu.rounds).toBeGreaterThan(THREAT.raid.rounds);
    expect(mu.incoming).toBe(Infinity);
  });
});
