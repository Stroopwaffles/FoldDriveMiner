import { CONFIG } from './config';
import * as E from './engine';
import * as F from './fold-rules';
import { GameState } from './types';

function fresh(): GameState {
  const s = E.newGame('Rook', 'Halberd Dawn', 1, 4242);
  s.threats.nextIn = Infinity;
  s.anomalies.nextIn = Infinity;
  s.trade.nextIn = Infinity;
  return s;
}

describe('hard caps: hold and furnaces', () => {
  it('Expand Hold stops at its max level', () => {
    const s = fresh();
    s.credits = 1e30;
    s.cargoLevel = CONFIG.cargo.maxLevel - 1;
    expect(E.buyCargo(s)).toBe(true);
    expect(E.cargoUpgradeCost(s)).toBeNull();
    expect(E.buyCargo(s)).toBe(false);
    expect(s.cargoLevel).toBe(CONFIG.cargo.maxLevel);
  });

  it('no mix of bonuses lifts the hold past its tonnage cap', () => {
    const s = fresh();
    s.cargoLevel = 60; // an old save from before the cap
    s.research.levels['cargo_compression'] = 5;
    s.drones.hauler = 5000;
    expect(E.cargoCapacity(s)).toBe(CONFIG.cargo.maxCapacity);
    expect(E.cargoUpgradeCost(s)).toBeNull();
  });

  it('a late-game hold (level 23, Cargo Compression 5, 123 Haulers) can still expand', () => {
    const s = fresh();
    s.cargoLevel = 23;
    s.research.levels['cargo_compression'] = 5;
    s.drones.hauler = 123;
    expect(E.cargoCapacity(s)).toBeGreaterThan(250_000_000);
    expect(E.cargoCapacity(s)).toBeLessThan(CONFIG.cargo.maxCapacity);
    expect(E.cargoUpgradeCost(s)).not.toBeNull();
    expect(E.cargoCapacity(s, 24)).toBeGreaterThan(E.cargoCapacity(s));
  });

  it('Furnace Capacity stops at its max level', () => {
    const s = fresh();
    s.research.levels['refinery'] = 1;
    s.credits = 1e30;
    s.refinery.capacityLevel = CONFIG.refinery.maxBatchLevel;
    const cap = E.batchCapacity(s);
    expect(E.furnaceCapacityCost(s)).toBeNull();
    expect(E.buyFurnaceCapacity(s)).toBe(false);
    s.refinery.capacityLevel = 40;
    expect(E.batchCapacity(s)).toBe(cap);
  });
});

describe('Trigger Clamp: hold to drill', () => {
  it('is bought once with credits', () => {
    const s = fresh();
    s.credits = CONFIG.hold.cost;
    expect(s.drill.clamp).toBe(false);
    expect(E.buyClamp(s)).toBe(true);
    expect(s.credits).toBe(0);
    expect(s.drill.clamp).toBe(true);
    s.credits = 1e9;
    expect(E.buyClamp(s)).toBe(false);
  });

  it('Servo Actuators shorten the hold interval', () => {
    const s = fresh();
    expect(E.holdInterval(s)).toBeCloseTo(CONFIG.hold.baseIntervalSec, 9);
    s.research.levels['servo_actuators'] = 5;
    expect(E.holdInterval(s)).toBeCloseTo(CONFIG.hold.baseIntervalSec * CONFIG.hold.servoFactor ** 5, 9);
  });

  it('the Thermal Governor holds back a hit that would leave Overdrive', () => {
    const s = fresh();
    s.drill.heat = CONFIG.heat.overdriveMax - 1;
    expect(E.holdShouldWait(s)).toBe(false); // no governor yet
    s.research.levels['thermal_governor'] = 1;
    expect(E.holdShouldWait(s)).toBe(true);
    s.drill.heat = 0;
    expect(E.holdShouldWait(s)).toBe(false);
  });

  it('stays fitted through a Fold Jump', () => {
    const s = fresh();
    s.drill.clamp = true;
    s.research.levels['fold_drive'] = 1;
    s.fold.charge = 1;
    s.stats.creditsEarned = 1e8;
    expect(F.foldJump(s)!.state.drill.clamp).toBe(true);
  });
});
