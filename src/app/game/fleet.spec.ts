import { CREW, xpForLevel } from './crew-data';
import * as E from './engine';
import { MECH } from './fleet-data';
import { CURRENT_VERSION, migrate } from './save';
import { GameState } from './types';

function rich(): GameState {
  const s = E.newGame('Rook', 'Halberd Dawn', 1_000_000, 4242);
  s.credits = 1e12;
  s.surveyData = 1e6;
  s.drill.tier = 2;
  return s;
}

function unlock(s: GameState, ...ids: string[]) {
  for (const id of ids) s.research.levels[id] = 1;
  E.ensureCrew(s);
}

/** A mining-ready mech with a reactor and drill, piloted by Juno. */
function mechWithJuno(s: GameState) {
  unlock(s, 'hangar');
  const m = E.buildMech(s, 'pickaxe')!;
  E.buyPart(s, 'fusion_cell');
  E.buyPart(s, 'hand_drill');
  E.equipPart(s, m.id, 'reactor', 'fusion_cell');
  E.equipPart(s, m.id, 'drill', 'hand_drill');
  const juno = s.pilots.find((p) => p.story === 'juno')!;
  E.seatPilot(s, m.id, juno.id);
  return { m, juno };
}

describe('milestone 3: drones', () => {
  it('new drone types need research', () => {
    const s = rich();
    expect(E.buyDronesOf(s, 'cutter', 1)).toBe(0);
    unlock(s, 'cutter_drones');
    expect(E.buyDronesOf(s, 'cutter', 3)).toBe(3);
    expect(E.droneUnlocked(s, 'guardian')).toBe(false);
  });

  it('cutters favour the highest reachable ore', () => {
    const s = rich();
    unlock(s, 'cutter_drones');
    s.sector.charted = 2;
    s.zone = 'trojan';
    s.drones.cutter = 10;
    const r = E.droneRates(s);
    expect(r.titanite).toBeGreaterThan(r.ferrite);
    expect(r.iridium).toBe(0); // Mk.II can't reach Iridium
  });

  it('haulers add cargo, surveyors stream Survey Data, salvagers boost cracks', () => {
    const s = rich();
    const cap = E.cargoCapacity(s);
    s.drones.hauler = 10;
    expect(E.cargoCapacity(s)).toBe(Math.floor(cap * 1.2));
    s.drones.surveyor = 5;
    const sd = s.surveyData;
    E.tick(s, 10);
    expect(s.surveyData).toBeCloseTo(sd + 5 * 0.02 * 10, 6);
    s.drones.salvager = 4;
    expect(E.salvagerDepletionBonus(s)).toBeCloseTo(0.2, 6);
  });

  it('Fleet Dispatch splits mining drones between zones', () => {
    const s = rich();
    unlock(s, 'fleet_dispatch');
    s.sector.charted = 2;
    s.drones.prospector = 10;
    E.setDispatch(s, 'inner', 50);
    E.setDispatch(s, 'trojan', 50);
    const shares = E.dispatchShares(s);
    expect(shares['inner']).toBeCloseTo(0.5, 6);
    expect(shares['trojan']).toBeCloseTo(0.5, 6);
    // Trojan has less Ferrite, so the split lowers Ferrite and raises Titanite vs all-inner.
    const split = E.droneRates(s);
    s.dispatch = {};
    const inner = E.droneRates(s);
    expect(split.titanite).toBeGreaterThan(inner.titanite);
  });
});

describe('milestone 3: mechs', () => {
  it('the hangar brings Juno and recruits; the repair bay brings Kit', () => {
    const s = rich();
    unlock(s, 'hangar');
    expect(s.pilots.map((p) => p.story)).toEqual(['juno']);
    expect(s.recruits.length).toBe(CREW.recruitCount);
    unlock(s, 'repair_bay');
    expect(s.pilots.map((p) => p.story)).toEqual(['juno', 'kit']);
  });

  it('building needs a free bay and credits', () => {
    const s = rich();
    expect(E.buildMech(s, 'pickaxe')).toBeNull();
    unlock(s, 'hangar');
    expect(E.buildMech(s, 'pickaxe')).not.toBeNull();
    expect(E.buildMech(s, 'kestrel')).toBeNull(); // only 1 bay
  });

  it('parts come from storage and the power budget can overload', () => {
    const s = rich();
    unlock(s, 'hangar');
    const m = E.buildMech(s, 'pickaxe')!;
    expect(E.equipPart(s, m.id, 'drill', 'breaker')).toBe(false); // none in storage
    E.buyPart(s, 'breaker');
    expect(E.equipPart(s, m.id, 'drill', 'breaker')).toBe(true);
    expect(s.parts['breaker']).toBe(0);
    expect(E.mechStats(s, m).overloaded).toBe(true); // 5 draw vs 4 frame power
    expect(E.setMechJob(s, m.id, 'mining')).toBe(false);
    E.buyPart(s, 'fusion_cell');
    E.equipPart(s, m.id, 'reactor', 'fusion_cell');
    expect(E.mechStats(s, m).overloaded).toBe(false);
    expect(E.setMechJob(s, m.id, 'mining')).toBe(true);
    E.equipPart(s, m.id, 'drill', null);
    expect(s.parts['breaker']).toBe(1);
  });

  it('a piloted mech mines more than autopilot and boosts drones via Command Link', () => {
    const s = rich();
    const { m } = mechWithJuno(s);
    s.drones.prospector = 10;
    const dronesBefore = E.droneRateTotal(s);
    E.setMechJob(s, m.id, 'mining');
    const piloted = E.mechRateTotal(s);
    expect(piloted).toBeGreaterThan(0);
    expect(E.droneRateTotal(s)).toBeGreaterThan(dronesBefore);
    E.seatPilot(s, m.id, null);
    expect(E.mechRateTotal(s)).toBeLessThan(piloted);
  });

  it('mining wears armor down to a floor; repairs cost credits and ore', () => {
    const s = rich();
    const { m } = mechWithJuno(s);
    E.setMechJob(s, m.id, 'mining');
    const max = E.mechStats(s, m).armor;
    E.tick(s, 3600 * 5);
    expect(m.armor).toBeCloseTo(max * MECH.wearFloor, 3);
    expect(E.mechCondition(s, m).id).toBe('critical');

    unlock(s, 'repair_bay');
    s.cargo.ferrite = 0;
    s.cargo.titanite = 0;
    E.setMechJob(s, m.id, 'repair');
    E.tick(s, 60);
    expect(m.armor).toBeCloseTo(max * MECH.wearFloor, 3); // no ore, no repair
    s.cargo.ferrite = 1e6;
    const credits = s.credits;
    E.tick(s, 600);
    expect(m.armor).toBeCloseTo(max, 3);
    expect(s.credits).toBeLessThan(credits);
    expect(m.job).toBe('idle');
  });

  it('auto-repair sends worn miners to the bay and back to work', () => {
    const s = rich();
    const { m } = mechWithJuno(s);
    unlock(s, 'repair_bay', 'auto_repair');
    s.cargo.ferrite = 1e6;
    E.setMechJob(s, m.id, 'mining');
    m.armor = E.mechStats(s, m).armor * 0.3;
    const ev = E.tick(s, 1);
    expect(ev.autoRepairs).toContain(m.id);
    expect(m.job).toBe('repair');
    E.tick(s, 1200);
    expect(m.job).toBe('mining');
  });

  it('sync grows while piloting and unlocks the special technique at 5', () => {
    const s = rich();
    const { m, juno } = mechWithJuno(s);
    unlock(s, 'repair_bay', 'auto_repair');
    s.cargo.ferrite = 1e9;
    E.setMechJob(s, m.id, 'mining');
    expect(E.techniqueReady(s, m)).toBe(false);
    juno.sync.pickaxe = CREW.syncThresholds[4];
    expect(E.syncLevel(juno, 'pickaxe')).toBe(5);
    expect(E.techniqueReady(s, m)).toBe(true);
    expect(E.techniqueName(s, m)).toBe('Burning Redline Breaker');
    const normal = E.mechRateTotal(s);
    expect(E.useTechnique(s, m.id)).toBe(true);
    expect(E.mechRateTotal(s)).toBeCloseTo(normal * MECH.techniqueBoost, 3);
    expect(E.techniqueReady(s, m)).toBe(false); // cooling down
  });
});

describe('milestone 3: crew', () => {
  it('pilots level up from work and get a trait choice every 10 levels', () => {
    const s = rich();
    const { m, juno } = mechWithJuno(s);
    unlock(s, 'repair_bay', 'auto_repair');
    s.cargo.ferrite = 1e9;
    E.setMechJob(s, m.id, 'mining');
    let total = 0;
    for (let l = 1; l < 10; l++) total += xpForLevel(l);
    // Small steps, like the real game loop (auto-repair keeps her working).
    let levelUps = 0;
    for (let t = 0; t < total * 3 && juno.level < 10; t += 5) levelUps += E.tick(s, 5).levelUps.length;
    expect(juno.level).toBe(10);
    expect(levelUps).toBe(9);
    expect(juno.traitChoice?.length).toBe(2);
    const pick = juno.traitChoice![0];
    expect(E.chooseTrait(s, juno.id, pick)).toBe(true);
    expect(juno.traits).toContain(pick);
  });

  it('Green fades at level 10', () => {
    const s = rich();
    unlock(s, 'hangar');
    const rookie = E.generatePilot(s, new (class {
      state = 1;
      next() {
        return 0.01;
      }
      range(a: number, b: number) {
        return a + (b - a) * 0.5;
      }
      int(a: number) {
        return a;
      }
    })() as never, 'rookie');
    expect(rookie.traits).toContain('green');
    s.pilots.push(rookie);
    E.assignPost(s, 'sensor', rookie.id);
    let total = 0;
    for (let l = 1; l < 10; l++) total += xpForLevel(l);
    E.tick(s, total / CREW.xpPost + 1);
    expect(rookie.level).toBe(10);
    expect(rookie.traits).not.toContain('green');
  });

  it('posts give bonuses: quartermaster prices, science speed', () => {
    const s = rich();
    unlock(s, 'hangar');
    const price = E.orePrice(s, 'ferrite');
    const juno = s.pilots[0];
    E.assignPost(s, 'quartermaster', juno.id);
    expect(E.orePrice(s, 'ferrite')).toBeGreaterThan(price);
    E.assignPost(s, 'science', juno.id); // moves her
    expect(s.posts.quartermaster).toBeUndefined();
    expect(E.postBonus(s, 'science')).toBeGreaterThan(0);
  });

  it('a pilot holds one job: seating in a mech clears their post', () => {
    const s = rich();
    const { m, juno } = mechWithJuno(s);
    E.assignPost(s, 'refinery', juno.id);
    expect(m.pilotId).toBeNull();
    E.seatPilot(s, m.id, juno.id);
    expect(s.posts.refinery).toBeUndefined();
  });

  it('hiring respects the roster cap and costs more each time', () => {
    const s = rich();
    unlock(s, 'hangar');
    const c1 = E.hireCost(s);
    expect(E.hirePilot(s, 0)).toBe(true);
    expect(E.hireCost(s)).toBeGreaterThan(c1);
    while (s.pilots.length < E.rosterCap(s)) {
      if (!s.recruits.length) E.refreshRecruits(s);
      E.hirePilot(s, 0);
    }
    if (!s.recruits.length) E.refreshRecruits(s);
    expect(E.hirePilot(s, 0)).toBe(false);
    expect(E.dismissPilot(s, s.pilots[0].id)).toBe(false); // Juno stays
  });

  it('migrates a version 2 save', () => {
    const v2 = E.newGame('Rook', 'Halberd', 1, 1) as unknown as Record<string, unknown>;
    v2['version'] = 2;
    v2['drones'] = { prospector: 12 };
    for (const k of ['dispatch', 'mechs', 'parts', 'pilots', 'recruits', 'posts', 'nextId', 'recruitRefresh']) delete v2[k];
    const m = migrate(v2);
    expect(m.version).toBe(CURRENT_VERSION);
    expect(m.drones.prospector).toBe(12);
    expect(m.drones.cutter).toBe(0);
    expect(m.mechs).toEqual([]);
    expect(m.nextId).toBe(1);
  });
});

describe('parts depot', () => {
  it("never sells unique parts, so they can't be had for free", () => {
    const s = rich();
    for (const id of ['crimson_lance', 'vermilion_plating', 'meridian_core', 'sx:123:breaker']) {
      expect(E.buyPart(s, id)).toBe(false);
      expect(s.parts[id] ?? 0).toBe(0);
    }
  });

  it('owned sector-unique parts can be equipped', () => {
    const s = rich();
    s.research.levels['hangar'] = 1;
    const m = E.buildMech(s, 'pickaxe')!;
    s.parts['sx:123:hand_drill'] = 1;
    expect(E.equipPart(s, m.id, 'drill', 'sx:123:hand_drill')).toBe(true);
    expect(m.parts.drill).toBe('sx:123:hand_drill');
  });
});
