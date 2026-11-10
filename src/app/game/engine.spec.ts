import { CONFIG } from './config';
import * as E from './engine';
import { formatNumber } from './format';
import { fromExportString, migrate, toExportString } from './save';
import { GameState } from './types';

function fresh(): GameState {
  return E.newGame('Rook', 'Halberd Dawn', 1_000_000, 12345);
}

describe('engine', () => {
  it('creates a new game with an asteroid and empty cargo', () => {
    const s = fresh();
    expect(s.credits).toBe(0);
    expect(s.asteroid.mass).toBeGreaterThan(0);
    expect(E.cargoUsed(s)).toBe(0);
    const total = Object.values(s.asteroid.composition).reduce((a, b) => a + b, 0);
    expect(total).toBeCloseTo(1, 6);
  });

  it('drilling moves ore into cargo and only reachable tiers count', () => {
    const s = fresh();
    const r = E.click(s);
    expect(r.gained.ferrite).toBeGreaterThan(0);
    expect(r.gained.titanite).toBe(0); // Mk.I can't reach Titanite
    expect(r.slag).toBeGreaterThan(0);
    expect(s.stats.clicks).toBe(1);
  });

  it('overheats and locks the drill, then vents', () => {
    const s = fresh();
    s.asteroid.mass = 1e9;
    s.asteroid.maxMass = 1e9;
    let r = E.click(s);
    while (!r.overheated) r = E.click(s);
    expect(s.drill.lockRemaining).toBe(CONFIG.heat.lockSec);
    expect(E.click(s).locked).toBe(true);
    E.tick(s, CONFIG.heat.lockSec);
    expect(s.drill.lockRemaining).toBe(0);
    expect(s.drill.heat).toBe(0);
    expect(E.click(s).locked).toBe(false);
  });

  it('enters overdrive in the red band and triples output', () => {
    const s = fresh();
    s.asteroid.mass = 1e9;
    s.asteroid.maxMass = 1e9;
    s.drill.heat = CONFIG.heat.overdriveMin;
    const r = E.click(s);
    expect(r.overdrive).toBe(true);
    const mined = r.gained.ferrite + r.slag;
    expect(mined).toBeCloseTo(E.drillPower(s) * CONFIG.heat.overdriveMult, 6);
  });

  it('cracks an asteroid, pays a bonus and spawns a new one', () => {
    const s = fresh();
    const old = s.asteroid;
    s.asteroid.mass = 0.5;
    const r = E.click(s);
    expect(r.cracked).toBe(true);
    expect(s.asteroid).not.toBe(old);
    expect(s.stats.asteroidsCracked).toBe(1);
    expect(s.surveyData).toBe(CONFIG.asteroid.surveyDataPerCrack);
  });

  it('caps cargo and counts the overflow as lost', () => {
    const s = fresh();
    const cap = E.cargoCapacity(s);
    const { lost } = E.addToCargo(s, { ...E.emptyOre(), ferrite: cap + 50 });
    expect(E.cargoUsed(s)).toBeCloseTo(cap, 6);
    expect(lost).toBeCloseTo(50, 6);
  });

  it('sells whole units at the market price', () => {
    const s = fresh();
    s.cargo.ferrite = 10.7;
    const price = E.orePrice(s, 'ferrite');
    const got = E.sell(s, 'ferrite');
    expect(got).toBeCloseTo(10 * price, 6);
    expect(s.cargo.ferrite).toBeCloseTo(0.7, 6);
  });

  it('keeps market prices within about ±20%', () => {
    for (let t = 0; t < 1000; t += 7) {
      const m = E.marketMultiplier(t, 'ferrite');
      expect(m).toBeGreaterThanOrEqual(0.79);
      expect(m).toBeLessThanOrEqual(1.21);
    }
  });

  it('buys drones with geometric cost scaling', () => {
    const s = fresh();
    s.credits = 1000;
    const max = E.maxAffordableDrones(s);
    const bought = E.buyDrones(s, 9999);
    expect(bought).toBe(max);
    expect(s.credits).toBeGreaterThanOrEqual(0);
    expect(s.credits).toBeLessThan(E.droneCost(s, 1));
  });

  it('drones produce over time and double at milestones', () => {
    const s = fresh();
    s.drones.prospector = 10;
    E.tick(s, 10);
    expect(s.cargo.ferrite).toBeCloseTo(10 * CONFIG.drones.prospector.orePerSec * 10 * CONFIG.homeField.ferrite!, 6);
    expect(E.droneMultiplier(24)).toBe(1);
    expect(E.droneMultiplier(25)).toBe(2);
    expect(E.droneMultiplier(50)).toBe(4);
  });

  it('Drill Mk.II unlocks titanite', () => {
    const s = fresh();
    s.credits = 5000;
    expect(E.buyDrillTier(s)).toBe(true);
    expect(s.drill.tier).toBe(2);
    expect(E.droneRates({ ...s, drones: { prospector: 5 } }).titanite).toBeGreaterThan(0);
  });

  it('offline progress runs at 50% and is capped at 8 hours', () => {
    const s = fresh();
    s.drones.prospector = 1;
    s.cargoLevel = 30; // huge hold
    const r = E.simulateOffline(s, 24 * 3600);
    const cap = CONFIG.offline.capHours * 3600;
    expect(r.cappedSeconds).toBe(cap);
    expect(r.gained.ferrite).toBeCloseTo(
      CONFIG.drones.prospector.orePerSec * cap * CONFIG.offline.efficiency * CONFIG.homeField.ferrite!,
      4,
    );
  });
});

describe('save', () => {
  it('round-trips through the export string', () => {
    const s = fresh();
    s.credits = 1234.5;
    s.commander = 'Rōku 🚀';
    const back = fromExportString(toExportString(s));
    expect(back.credits).toBe(1234.5);
    expect(back.commander).toBe('Rōku 🚀');
  });

  it('fills fields missing from older saves', () => {
    const s = fresh() as unknown as Record<string, unknown>;
    delete s['stats'];
    const m = migrate(s);
    expect(m.stats.clicks).toBe(0);
  });

  it('rejects unknown versions and junk', () => {
    expect(() => migrate({ version: 99 })).toThrow();
    expect(() => fromExportString('hello')).toThrow();
  });
});

describe('formatNumber', () => {
  it('uses suffixes', () => {
    expect(formatNumber(999)).toBe('999');
    expect(formatNumber(1234)).toBe('1.23K');
    expect(formatNumber(5_600_000)).toBe('5.60M');
    expect(formatNumber(2.5)).toBe('2.5');
  });

  it('supports scientific and engineering', () => {
    expect(formatNumber(12345, 'scientific')).toBe('1.23e4');
    expect(formatNumber(12345, 'engineering')).toBe('12.35e3');
  });
});
