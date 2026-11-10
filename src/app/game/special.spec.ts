import { zoneDef } from './config';
import * as E from './engine';
import * as F from './fold-rules';
import { Rng } from './rng';
import { CURRENT_VERSION, migrate } from './save';
import { generateSector } from './sector-rules';
import { SPECIAL, specialDef } from './special-data';
import { GameState, SpecialInfo } from './types';

function fresh(): GameState {
  const s = E.newGame('Rook', 'Halberd Dawn', 1, 4242);
  s.threats.nextIn = Infinity;
  s.anomalies.nextIn = Infinity;
  s.trade.nextIn = Infinity;
  return s;
}

/** Puts a special rock in front of the drill. */
function place(s: GameState, special: SpecialInfo): void {
  s.asteroid = E.spawnAsteroid(s);
  const base = s.asteroid.composition;
  const mass = s.asteroid.maxMass * specialDef(special.kind).massMult;
  s.asteroid = { ...s.asteroid, special, rich: false, mass, maxMass: mass, composition: E.specialComposition(s, special, base) };
}

function crack(s: GameState) {
  s.asteroid.mass = 1e-12 + 0.0001;
  s.drill.heat = 0;
  return E.click(s);
}

describe('special asteroids: odds', () => {
  it('are rare in an ordinary zone, and capped', () => {
    const s = fresh();
    expect(E.specialChance(s, zoneDef('inner'))).toBeCloseTo(SPECIAL.baseChance, 9);
    s.research.levels['signature_scanner'] = 3;
    s.drones.surveyor = 1000;
    s.sensorArray = SPECIAL.arrayMaxLevel;
    expect(E.specialChance(s, zoneDef('ring'))).toBeLessThanOrEqual(SPECIAL.maxChance);
  });

  it('sensors raise the odds: research, Surveyor drones and the Sensor Array', () => {
    const s = fresh();
    const base = E.specialChance(s, zoneDef('inner'));
    s.research.levels['signature_scanner'] = 1;
    s.drones.surveyor = 10;
    s.credits = 1e9;
    expect(E.buySensorArray(s)).toBe(true);
    expect(E.specialChance(s, zoneDef('inner'))).toBeCloseTo(base * (1 + 0.3 + 0.1 + 0.1), 9);
  });

  it('a battlefield turns up more derelicts, mostly warships', () => {
    const s = fresh();
    s.sector.charted = 3;
    const ring = zoneDef('ring');
    expect(ring.site).toBe('battlefield');
    expect(E.specialChance(s, ring)).toBeGreaterThan(E.specialChance(s, zoneDef('inner')));
    const w = E.kindWeights(s, ring);
    expect(w.derelict).toBeGreaterThan(w.dense);
    const rng = new Rng(7);
    const classes: Record<string, number> = {};
    let n = 0;
    for (let i = 0; i < 20000 && n < 300; i++) {
      const sp = E.rollSpecial(s, rng, ring);
      if (sp?.kind === 'derelict') {
        classes[sp.derelict!] = (classes[sp.derelict!] ?? 0) + 1;
        n++;
      }
    }
    expect(classes['military']).toBeGreaterThan(classes['hauler'] ?? 0);
    expect(classes['ancient'] ?? 0).toBe(0); // too shallow for precursor wrecks
  });

  it('roughly the base chance of rocks spawn special in the home Inner Belt', () => {
    const s = fresh();
    let specials = 0;
    for (let i = 0; i < 4000; i++) if (E.spawnAsteroid(s).special) specials++;
    expect(specials / 4000).toBeGreaterThan(SPECIAL.baseChance * 0.6);
    expect(specials / 4000).toBeLessThan(SPECIAL.baseChance * 1.5);
  });

  it('generated sectors give some zones sites, the same way every time', () => {
    let withSite = 0;
    let zones = 0;
    for (let seed = 1; seed <= 40; seed++) {
      const a = generateSector(seed * 977, 2);
      const b = generateSector(seed * 977, 2);
      expect(a.zones.map((z) => z.site)).toEqual(b.zones.map((z) => z.site));
      zones += a.zones.length;
      withSite += a.zones.filter((z) => z.site).length;
    }
    expect(withSite / zones).toBeGreaterThan(0.25);
    expect(withSite / zones).toBeLessThan(0.65);
  });
});

describe('special asteroids: rewards', () => {
  it('an element cluster is one pure ore', () => {
    const s = fresh();
    place(s, { kind: 'cluster', ore: 'ferrite' });
    expect(s.asteroid.composition.ferrite).toBe(1);
  });

  it('dense rock gives more ore per hit than plain rock', () => {
    const plain = fresh();
    const dense = fresh();
    place(dense, { kind: 'dense' });
    plain.asteroid.mass = plain.asteroid.maxMass = 1e6;
    dense.asteroid.mass = dense.asteroid.maxMass = 1e6;
    const a = E.click(plain).gained.ferrite + E.click(plain).gained.titanite;
    const b = E.click(dense).gained.ferrite + E.click(dense).gained.titanite;
    expect(b / a).toBeCloseTo(specialDef('dense').yieldMult, 1);
  });

  it('a derelict hauler pays credits when it cracks', () => {
    const s = fresh();
    place(s, { kind: 'derelict', derelict: 'hauler' });
    const credits = s.credits;
    const r = crack(s);
    expect(r.cracked).toBe(true);
    expect(r.special?.name).toBe('Derelict Cargo Hauler');
    expect(s.credits).toBeGreaterThan(credits);
    expect(s.stats.specials?.['derelict:hauler']).toBe(1);
  });

  it('a warship hulk always has a Data Core', () => {
    const s = fresh();
    place(s, { kind: 'derelict', derelict: 'military' });
    const cores = s.dataCores;
    crack(s);
    expect(s.dataCores).toBeGreaterThanOrEqual(cores + 1);
  });

  it('a mining barge brings drones home', () => {
    const s = fresh();
    place(s, { kind: 'derelict', derelict: 'miner' });
    crack(s);
    expect(s.drones.prospector).toBeGreaterThanOrEqual(2);
  });

  it('a survey vessel pays far more Survey Data than a plain rock', () => {
    const s = fresh();
    const plain = crack(s).surveyData;
    place(s, { kind: 'derelict', derelict: 'science' });
    const sd = s.surveyData;
    crack(s);
    expect(s.surveyData - sd).toBeGreaterThan(plain * 10);
  });

  it('a geode bursts with the best ore', () => {
    const s = fresh();
    s.cargoLevel = 20;
    place(s, { kind: 'geode' });
    const mass = s.asteroid.maxMass;
    // A Mk.I drill can only cut Ferrite, so the crystals are Ferrite: 4× the geode's mass.
    const r = crack(s);
    expect(r.gained.ferrite).toBeGreaterThanOrEqual(mass * 4);
  });
});

describe('special asteroids: saves and jumps', () => {
  it('the Sensor Array resets on a Fold Jump; the count of specials found stays', () => {
    const s = fresh();
    s.sensorArray = 3;
    s.stats.specials = { dense: 2 };
    s.research.levels['fold_drive'] = 1;
    s.fold.charge = 1;
    s.stats.creditsEarned = 1e8;
    const n = F.foldJump(s)!.state;
    expect(n.sensorArray).toBe(0);
    expect(n.stats.specials).toEqual({ dense: 2 });
  });

  it('migrates a version 11 save', () => {
    const v11 = E.newGame('Rook', 'Halberd', 1, 99) as unknown as Record<string, unknown>;
    v11['version'] = 11;
    delete v11['sensorArray'];
    const m = migrate(v11);
    expect(m.version).toBe(CURRENT_VERSION);
    expect(m.sensorArray).toBe(0);
  });
});
