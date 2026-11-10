import { CONFIG, ZONES } from './config';
import * as E from './engine';
import { formatNumber } from './format';
import { CURRENT_VERSION, fromExportString, migrate, toExportString } from './save';
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

  it('overdrive is the cool zone: a cool drill triples output', () => {
    const s = fresh();
    s.asteroid.mass = 1e9;
    s.asteroid.maxMass = 1e9;
    const r = E.click(s); // from cold
    expect(r.overdrive).toBe(true);
    const mined = r.gained.ferrite + r.slag;
    expect(mined).toBeCloseTo(E.drillPower(s) * CONFIG.heat.overdriveMult, 6);
  });

  it('clicking too fast heats the drill out of overdrive', () => {
    const s = fresh();
    s.asteroid.mass = 1e9;
    s.asteroid.maxMass = 1e9;
    s.drill.heat = CONFIG.heat.overdriveMax;
    const r = E.click(s);
    expect(r.overdrive).toBe(false);
    expect(E.isHot(s)).toBe(true);
    const mined = r.gained.ferrite + r.slag;
    expect(mined).toBeCloseTo(E.drillPower(s), 6);
  });

  it('a steady rhythm stays in overdrive, and heat sinks allow a faster rhythm', () => {
    const rhythm = (sinkLevel: number, clicksPerSec: number) => {
      const s = fresh();
      s.asteroid.mass = 1e12;
      s.asteroid.maxMass = 1e12;
      s.drill.heatSinkLevel = sinkLevel;
      let od = 0;
      for (let i = 0; i < 100; i++) {
        if (E.click(s).overdrive) od++;
        E.tick(s, 1 / clicksPerSec);
      }
      return od;
    };
    expect(rhythm(0, 4)).toBe(100); // 28 heat/s in, 30/s out
    expect(rhythm(0, 6)).toBeLessThan(100); // too fast without sinks
    expect(rhythm(5, 6)).toBe(100); // sinks vent 52.5/s: 6 clicks/s stays cool
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
    expect(s.cargo.ferrite).toBeCloseTo(10 * CONFIG.drones.prospector.orePerSec * 10 * ZONES[0].composition.ferrite!, 6);
    expect(E.droneMultiplier(24)).toBe(1);
    expect(E.droneMultiplier(25)).toBe(2);
    expect(E.droneMultiplier(50)).toBe(4);
  });

  it('Drill Mk.II unlocks titanite', () => {
    const s = fresh();
    s.credits = 5000;
    expect(E.buyDrillTier(s)).toBe(true);
    expect(s.drill.tier).toBe(2);
    expect(E.droneRates({ ...s, drones: { ...s.drones, prospector: 5 } }).titanite).toBeGreaterThan(0);
  });

  it('offline progress runs at 50% and is capped at 8 hours', () => {
    const s = fresh();
    s.drones.prospector = 1;
    s.cargoLevel = 30; // huge hold
    s.threats.nextIn = Infinity; // no events, to measure production alone
    const r = E.simulateOffline(s, 24 * 3600);
    const cap = CONFIG.offline.capHours * 3600;
    expect(r.cappedSeconds).toBe(cap);
    expect(r.gained.ferrite).toBeCloseTo(
      CONFIG.drones.prospector.orePerSec * cap * CONFIG.offline.efficiency * ZONES[0].composition.ferrite!,
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

describe('milestone 2: zones, research, refinery, auto-sell', () => {
  function rich(): GameState {
    const s = fresh();
    s.credits = 1e9;
    s.surveyData = 1e6;
    return s;
  }

  function finishAll(s: GameState) {
    return E.tick(s, 1e6);
  }

  it('research costs Survey Data + credits, runs in a lab slot and applies on completion', () => {
    const s = rich();
    const sd = s.surveyData;
    expect(E.startResearch(s, 'refinery')).toBe(true);
    expect(s.surveyData).toBeLessThan(sd);
    expect(s.research.active.length).toBe(1);
    expect(E.researchBlocker(s, 'survey_trojan')).toBe('All lab benches busy');
    const ev = finishAll(s);
    expect(ev.research.map((r) => r.id)).toEqual(['refinery']);
    expect(E.hasResearch(s, 'refinery')).toBe(true);
    expect(s.refinery.slots.length).toBe(1);
  });

  it('enforces prerequisites and drill tier', () => {
    const s = rich();
    expect(E.researchStatus(s, 'drill_mk3')).toBe('locked');
    E.startResearch(s, 'survey_trojan');
    finishAll(s);
    expect(E.researchBlocker(s, 'drill_mk3')).toMatch(/Mk\.II/);
    E.buyDrillTier(s);
    expect(E.startResearch(s, 'drill_mk3')).toBe(true);
    finishAll(s);
    expect(s.drill.tier).toBe(3);
  });

  it('teaser nodes cannot be researched', () => {
    const s = rich();
    expect(E.researchStatus(s, 'alloys')).toBe('teaser');
    expect(E.startResearch(s, 'alloys')).toBe(false);
  });

  it('cancelling refunds the cost', () => {
    const s = rich();
    const before = { sd: s.surveyData, cr: s.credits };
    E.startResearch(s, 'refinery');
    E.cancelResearch(s, 0);
    expect(s.surveyData).toBe(before.sd);
    expect(s.credits).toBe(before.cr);
  });

  it('extra lab benches allow parallel research', () => {
    const s = rich();
    s.research.levels['lab_slot_2'] = 1;
    expect(E.startResearch(s, 'refinery')).toBe(true);
    expect(E.startResearch(s, 'survey_trojan')).toBe(true);
    expect(E.startResearch(s, 'core_sampling')).toBe(false);
  });

  it('zones change the asteroid mix and need research', () => {
    const s = rich();
    expect(E.setZone(s, 'trojan')).toBe(false);
    s.research.levels['survey_trojan'] = 1;
    expect(E.setZone(s, 'trojan')).toBe(true);
    expect(s.asteroid.zone).toBe('trojan');
    expect(s.asteroid.composition.iridium).toBeGreaterThan(0);
  });

  it('refines ore into ingots worth more than the ore', () => {
    const s = rich();
    s.research.levels['refinery'] = 1;
    E.syncRefinerySlots(s);
    s.cargo.ferrite = 20;
    expect(E.startBatch(s, 0, 'ferrite')).toBe(true);
    expect(s.cargo.ferrite).toBe(0);
    E.tick(s, E.batchDuration(s) + 0.01);
    expect(s.ingots.ferrite).toBeCloseTo(2, 6);
    expect(E.ingotPrice(s, 'ferrite') / E.oreRatio(s)).toBeGreaterThan(E.orePrice(s, 'ferrite'));
  });

  it('a furnace only takes its capacity per batch, and the upgrade raises it', () => {
    const s = rich();
    s.research.levels['refinery'] = 1;
    E.syncRefinerySlots(s);
    s.cargoLevel = 10;
    s.cargo.ferrite = 500;
    const cap = E.batchCapacity(s);
    expect(cap).toBe(CONFIG.refinery.baseBatch);
    E.startBatch(s, 0, 'ferrite');
    expect(s.refinery.slots[0].batch).toBe(cap);
    expect(s.cargo.ferrite).toBe(500 - cap);
    // The hold size no longer changes the batch.
    s.cargoLevel = 20;
    expect(E.batchCapacity(s)).toBe(cap);
    const credits = s.credits;
    expect(E.buyFurnaceCapacity(s)).toBe(true);
    expect(s.credits).toBe(credits - CONFIG.refinery.batchCostBase);
    expect(E.batchCapacity(s)).toBe(80); // 50 × 1.6
    expect(E.batchCapacity(s) % E.oreRatio(s)).toBe(0);
  });

  it('ingots take hold space, and furnaces reserve space for their output', () => {
    const s = rich();
    s.research.levels['refinery'] = 1;
    E.syncRefinerySlots(s);
    s.cargo.ferrite = 20;
    E.startBatch(s, 0, 'ferrite');
    expect(E.cargoUsed(s)).toBeCloseTo(2, 6); // 20 ore in the furnace → 2 t reserved
    // Fill the rest of the hold; the reserved space can't be taken.
    const lost = E.addToCargo(s, { ...E.emptyOre(), ferrite: 1000 }).lost;
    expect(lost).toBeGreaterThan(0);
    expect(E.cargoUsed(s)).toBeCloseTo(E.cargoCapacity(s), 6);
    E.tick(s, E.batchDuration(s) + 0.01);
    expect(s.ingots.ferrite).toBeCloseTo(2, 6);
    expect(E.cargoUsed(s)).toBeLessThanOrEqual(E.cargoCapacity(s) + 1e-6);
    // Selling ingots frees the space again.
    E.sellIngots(s, 'ferrite');
    expect(E.cargoUsed(s)).toBeCloseTo(E.cargoCapacity(s) - 2, 6);
  });

  it('won\'t start a batch without enough ore', () => {
    const s = rich();
    s.research.levels['refinery'] = 1;
    E.syncRefinerySlots(s);
    s.cargo.ferrite = 5;
    expect(E.startBatch(s, 0, 'ferrite')).toBe(false);
  });

  it('auto-refine repeats batches while ore lasts', () => {
    const s = rich();
    s.research.levels['refinery'] = 1;
    s.research.levels['auto_refine'] = 1;
    E.syncRefinerySlots(s);
    s.cargo.ferrite = 25; // batch cap is 25% of 100 → 20 ore per batch
    E.startBatch(s, 0, 'ferrite');
    E.setSlotRepeat(s, 0, true);
    s.cargo.ferrite += 20;
    E.tick(s, E.batchDuration(s) * 2 + 0.1);
    expect(s.ingots.ferrite).toBeCloseTo(4, 6);
  });

  it('auto-sell sells flagged items; smart sell waits for good prices', () => {
    const s = rich();
    s.research.levels['auto_sell'] = 1;
    s.research.levels['market_analysis'] = 1;
    E.toggleAutoSell(s, 'ore', 'ferrite');
    s.cargo.ferrite = 50;
    E.tick(s, 0.1);
    expect(s.cargo.ferrite).toBeLessThan(1);

    E.toggleSmartSell(s);
    // Find a moment when Ferrite is below average.
    while (E.marketMultiplier(s.marketClock + 0.1, 'ferrite') >= 1) s.marketClock += 1;
    s.cargo.ferrite = 50;
    E.tick(s, 0.1);
    expect(s.cargo.ferrite).toBe(50);
  });

  it('research bonuses apply: cargo, drones, survey data, overdrive', () => {
    const s = rich();
    const cap = E.cargoCapacity(s);
    s.research.levels['cargo_compression'] = 2;
    expect(E.cargoCapacity(s)).toBe(Math.floor(cap * 1.5));
    s.drones.prospector = 1;
    const rate = E.perDroneRate(s);
    s.research.levels['drone_efficiency'] = 1;
    expect(E.perDroneRate(s)).toBeCloseTo(rate * 1.25, 6);
    s.research.levels['core_sampling'] = 2;
    expect(E.surveyDataPerCrack(s)).toBeCloseTo(2, 6);
    s.research.levels['overdrive_tuning'] = 1;
    expect(E.overdriveMult(s)).toBe(3.5);
  });

  it('offline time completes research and refines at full speed', () => {
    const s = rich();
    s.research.levels['refinery'] = 1;
    s.research.levels['auto_refine'] = 1;
    E.syncRefinerySlots(s);
    s.cargo.ferrite = 25;
    E.startBatch(s, 0, 'ferrite');
    E.startResearch(s, 'survey_trojan');
    const r = E.simulateOffline(s, 3600);
    expect(r.research.map((d) => d.id)).toContain('survey_trojan');
    expect(r.ingots.ferrite).toBeGreaterThan(0);
    expect(r.efficiency).toBe(0.5);
  });

  it('migrates a version 1 save', () => {
    const v1 = fresh() as unknown as Record<string, unknown>;
    v1['version'] = 1;
    delete v1['research'];
    delete v1['refinery'];
    delete v1['ingots'];
    delete v1['autoSell'];
    delete v1['zone'];
    const m = migrate(v1);
    expect(m.version).toBe(CURRENT_VERSION);
    expect(m.zone).toBe('inner');
    expect(m.research.levels).toEqual({});
    expect(m.ingots.ferrite).toBe(0);
  });
});

describe('asteroid toughness', () => {
  it('asteroids always take about 30 normal clicks, even after power upgrades', () => {
    const s = E.newGame('Rook', 'Halberd', 1, 99);
    s.drill.powerLevel = 40;
    for (let i = 0; i < 20; i++) {
      const a = E.spawnAsteroid(s);
      expect(a.maxMass / E.drillPower(s)).toBeGreaterThanOrEqual(CONFIG.asteroid.minClicks * 0.8 - 1e-9);
    }
  });
});
