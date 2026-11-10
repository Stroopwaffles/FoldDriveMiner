/**
 * Pure game rules. Functions here mutate the GameState passed in and never
 * touch the DOM, timers or storage, so they can be unit tested and reused
 * for offline catch-up.
 */
import { CONFIG, ORE_IDS, OreId, oreDef } from './config';
import { Rng } from './rng';
import {
  AsteroidState,
  ClickResult,
  GameState,
  OfflineReport,
  OreAmounts,
} from './types';

export function emptyOre(): OreAmounts {
  return { ferrite: 0, titanite: 0, iridium: 0, helium3: 0, voidglass: 0 };
}

function sumOre(a: OreAmounts): number {
  return ORE_IDS.reduce((s, id) => s + a[id], 0);
}

// ---------------------------------------------------------------- setup

export function newGame(commander: string, ship: string, now: number, seed: number): GameState {
  const state: GameState = {
    version: 1,
    commander,
    ship,
    createdAt: now,
    lastSeen: now,
    playtimeSec: 0,
    marketClock: 0,
    rng: seed >>> 0,
    credits: 0,
    dataCores: 0,
    surveyData: 0,
    cargo: emptyOre(),
    cargoLevel: 0,
    drill: { powerLevel: 0, tier: 1, heat: 0, lockRemaining: 0, heatSinkLevel: 0 },
    drones: { prospector: 0 },
    asteroid: null as unknown as AsteroidState,
    sector: { code: '00-H', name: 'Home Reach', star: 'Yellow main-sequence', depth: 0 },
    stats: {
      clicks: 0,
      oreMined: 0,
      oreLost: 0,
      asteroidsCracked: 0,
      overdriveClicks: 0,
      overheats: 0,
      creditsEarned: 0,
    },
    flags: {},
  };
  state.asteroid = spawnAsteroid(state);
  return state;
}

export function spawnAsteroid(state: GameState): AsteroidState {
  const rng = new Rng(state.rng);
  const a = CONFIG.asteroid;
  const growth = Math.min(1 + state.stats.asteroidsCracked * a.massGrowthPerCrack, a.maxMassMult);
  const mass = Math.round(a.baseMass * growth * rng.range(0.8, 1.25));
  const rich = rng.next() < a.richChance;

  // Wobble the home field's mix; rich rocks carry far more Titanite.
  const composition = emptyOre();
  const field = CONFIG.homeField;
  let total = 0;
  for (const id of ORE_IDS) {
    let w = (field[id] ?? 0) * rng.range(0.7, 1.3);
    if (rich && id !== 'ferrite') w *= 3;
    composition[id] = w;
    total += w;
  }
  for (const id of ORE_IDS) composition[id] = total > 0 ? composition[id] / total : 0;

  const asteroid: AsteroidState = {
    shapeSeed: (rng.next() * 4294967296) >>> 0,
    mass,
    maxMass: mass,
    composition,
    rich,
  };
  state.rng = rng.state;
  return asteroid;
}

// ---------------------------------------------------------------- derived values

export function drillPower(state: GameState): number {
  const d = CONFIG.drill;
  const lvl = state.drill.powerLevel;
  return (d.basePower + lvl * d.powerPerLevel) * 2 ** Math.floor(lvl / d.powerDoublingEvery);
}

export function heatDecay(state: GameState): number {
  const h = CONFIG.heat;
  return h.decayPerSec * (1 + state.drill.heatSinkLevel * h.sinkDecayBonus);
}

export function isOverdrive(state: GameState): boolean {
  return state.drill.lockRemaining <= 0 && state.drill.heat >= CONFIG.heat.overdriveMin;
}

export function cargoCapacity(state: GameState): number {
  const c = CONFIG.cargo;
  return Math.floor(c.baseCapacity * c.capacityGrowth ** state.cargoLevel);
}

export function cargoUsed(state: GameState): number {
  return sumOre(state.cargo);
}

export function droneMultiplier(count: number): number {
  return 2 ** CONFIG.drones.milestones.filter((m) => count >= m).length;
}

export function nextDroneMilestone(count: number): number | null {
  return CONFIG.drones.milestones.find((m) => m > count) ?? null;
}

/** Ore per second from drones, split by the field mix, for ores the drill can reach. */
export function droneRates(state: GameState): OreAmounts {
  const rates = emptyOre();
  const n = state.drones.prospector;
  if (n === 0) return rates;
  const total = n * CONFIG.drones.prospector.orePerSec * droneMultiplier(n);
  const field = CONFIG.homeField;
  for (const id of ORE_IDS) {
    if (oreDef(id).tier <= state.drill.tier) rates[id] = total * (field[id] ?? 0);
  }
  return rates;
}

export function droneRateTotal(state: GameState): number {
  return sumOre(droneRates(state));
}

/** Market multiplier, roughly 0.8–1.2, deterministic from the market clock. */
export function marketMultiplier(clock: number, ore: OreId): number {
  const m = CONFIG.market;
  const i = ORE_IDS.indexOf(ore);
  const slow = Math.sin((2 * Math.PI * clock) / m.slowPeriodSec + i * 1.9);
  const fast = Math.sin((2 * Math.PI * clock) / m.fastPeriodSec + i * 4.3);
  return 1 + slow * m.slowAmp + fast * m.fastAmp;
}

export function orePrice(state: GameState, ore: OreId): number {
  return oreDef(ore).baseValue * marketMultiplier(state.marketClock, ore);
}

/** +1 rising, -1 falling, 0 flat. */
export function priceTrend(state: GameState, ore: OreId): number {
  const d = marketMultiplier(state.marketClock + 1, ore) - marketMultiplier(state.marketClock, ore);
  return Math.abs(d) < 0.0005 ? 0 : Math.sign(d);
}

// ---------------------------------------------------------------- costs

export function droneCost(state: GameState, count = 1): number {
  const p = CONFIG.drones.prospector;
  const owned = state.drones.prospector;
  // Geometric series: base * g^owned * (g^count - 1) / (g - 1)
  return (p.baseCost * p.costGrowth ** owned * (p.costGrowth ** count - 1)) / (p.costGrowth - 1);
}

export function maxAffordableDrones(state: GameState): number {
  const p = CONFIG.drones.prospector;
  const g = p.costGrowth;
  const first = p.baseCost * g ** state.drones.prospector;
  if (state.credits < first) return 0;
  return Math.floor(Math.log((state.credits * (g - 1)) / first + 1) / Math.log(g));
}

export function drillPowerCost(state: GameState): number {
  const d = CONFIG.drill;
  return Math.ceil(d.powerCostBase * d.powerCostGrowth ** state.drill.powerLevel);
}

export function nextTierUpgrade(state: GameState) {
  return CONFIG.drill.tierUpgrades.find((t) => t.tier === state.drill.tier + 1) ?? null;
}

export function heatSinkCost(state: GameState): number | null {
  const h = CONFIG.heat;
  if (state.drill.heatSinkLevel >= h.sinkMaxLevel) return null;
  return Math.ceil(h.sinkCostBase * h.sinkCostGrowth ** state.drill.heatSinkLevel);
}

export function cargoUpgradeCost(state: GameState): number {
  const c = CONFIG.cargo;
  return Math.ceil(c.costBase * c.costGrowth ** state.cargoLevel);
}

// ---------------------------------------------------------------- cargo

/** Adds ore up to free capacity (scaled evenly if it doesn't all fit). Returns amount lost. */
export function addToCargo(state: GameState, amounts: OreAmounts): { added: OreAmounts; lost: number } {
  const total = sumOre(amounts);
  const free = Math.max(0, cargoCapacity(state) - cargoUsed(state));
  const scale = total <= free ? 1 : free / total;
  const added = emptyOre();
  for (const id of ORE_IDS) {
    added[id] = amounts[id] * scale;
    state.cargo[id] += added[id];
  }
  const lost = total - sumOre(added);
  state.stats.oreMined += total - lost;
  state.stats.oreLost += lost;
  return { added, lost };
}

// ---------------------------------------------------------------- actions

export function click(state: GameState): ClickResult {
  const h = CONFIG.heat;
  const result: ClickResult = {
    locked: false,
    overheated: false,
    overdrive: false,
    gained: emptyOre(),
    slag: 0,
    lost: 0,
    cracked: false,
    dataCore: false,
  };
  const drill = state.drill;
  if (drill.lockRemaining > 0) {
    result.locked = true;
    return result;
  }

  state.stats.clicks++;
  drill.heat += h.perClick;
  if (drill.heat >= h.max) {
    drill.heat = h.max;
    drill.lockRemaining = h.lockSec;
    state.stats.overheats++;
    result.overheated = true;
    return result;
  }
  result.overdrive = drill.heat >= h.overdriveMin;
  if (result.overdrive) state.stats.overdriveClicks++;

  const asteroid = state.asteroid;
  const power = drillPower(state) * (result.overdrive ? h.overdriveMult : 1);
  const mined = Math.min(power, asteroid.mass);
  asteroid.mass -= mined;

  const haul = emptyOre();
  for (const id of ORE_IDS) {
    const amount = mined * asteroid.composition[id];
    if (oreDef(id).tier <= drill.tier) haul[id] = amount;
    else result.slag += amount;
  }

  if (asteroid.mass <= 1e-9) {
    result.cracked = true;
    const a = CONFIG.asteroid;
    for (const id of ORE_IDS) {
      if (oreDef(id).tier <= drill.tier) {
        haul[id] += asteroid.maxMass * a.depletionBonusFrac * asteroid.composition[id];
      }
    }
    const rng = new Rng(state.rng);
    if (rng.next() < a.dataCoreChance) {
      result.dataCore = true;
      state.dataCores++;
    }
    state.rng = rng.state;
    state.surveyData += a.surveyDataPerCrack;
    state.stats.asteroidsCracked++;
    state.asteroid = spawnAsteroid(state);
  }

  const { added, lost } = addToCargo(state, haul);
  result.gained = added;
  result.lost = lost;
  return result;
}

export function sell(state: GameState, ore: OreId): number {
  const amount = Math.floor(state.cargo[ore]);
  if (amount <= 0) return 0;
  const credits = amount * orePrice(state, ore);
  state.cargo[ore] -= amount;
  state.credits += credits;
  state.stats.creditsEarned += credits;
  return credits;
}

export function sellAll(state: GameState): number {
  return ORE_IDS.reduce((sum, id) => sum + sell(state, id), 0);
}

export function buyDrones(state: GameState, count: number): number {
  let n = Math.min(count, maxAffordableDrones(state));
  // Guard against floating-point rounding in the closed-form max.
  while (n > 0 && droneCost(state, n) > state.credits) n--;
  if (n <= 0) return 0;
  state.credits -= droneCost(state, n);
  state.drones.prospector += n;
  return n;
}

export function buyDrillPower(state: GameState): boolean {
  const cost = drillPowerCost(state);
  if (state.credits < cost) return false;
  state.credits -= cost;
  state.drill.powerLevel++;
  return true;
}

export function buyDrillTier(state: GameState): boolean {
  const up = nextTierUpgrade(state);
  if (!up || up.tier > CONFIG.drill.maxTier || state.credits < up.cost) return false;
  state.credits -= up.cost;
  state.drill.tier = up.tier;
  return true;
}

export function buyHeatSink(state: GameState): boolean {
  const cost = heatSinkCost(state);
  if (cost === null || state.credits < cost) return false;
  state.credits -= cost;
  state.drill.heatSinkLevel++;
  return true;
}

export function buyCargo(state: GameState): boolean {
  const cost = cargoUpgradeCost(state);
  if (state.credits < cost) return false;
  state.credits -= cost;
  state.cargoLevel++;
  return true;
}

// ---------------------------------------------------------------- time

/** Advances the game by dt seconds while the game is open. */
export function tick(state: GameState, dt: number): void {
  state.playtimeSec += dt;
  state.marketClock += dt;

  const drill = state.drill;
  if (drill.lockRemaining > 0) {
    drill.lockRemaining = Math.max(0, drill.lockRemaining - dt);
    // Vent heat to zero over the lockout.
    drill.heat = (CONFIG.heat.max * drill.lockRemaining) / CONFIG.heat.lockSec;
  } else {
    drill.heat = Math.max(0, drill.heat - heatDecay(state) * dt);
  }

  produce(state, dt, 1);
}

function produce(state: GameState, seconds: number, efficiency: number): { added: OreAmounts; lost: number } {
  const rates = droneRates(state);
  const amounts = emptyOre();
  for (const id of ORE_IDS) amounts[id] = rates[id] * seconds * efficiency;
  return addToCargo(state, amounts);
}

/** Applies time spent away at reduced efficiency, capped. */
export function simulateOffline(state: GameState, seconds: number): OfflineReport {
  const o = CONFIG.offline;
  const capped = Math.min(seconds, o.capHours * 3600);
  state.marketClock += capped;
  state.drill.heat = 0;
  state.drill.lockRemaining = 0;
  const { added, lost } = produce(state, capped, o.efficiency);
  return {
    seconds,
    cappedSeconds: capped,
    gained: added,
    lost,
    cargoFull: cargoUsed(state) >= cargoCapacity(state) - 1e-6,
  };
}
