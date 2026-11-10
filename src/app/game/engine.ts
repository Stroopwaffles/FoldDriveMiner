/**
 * Pure game rules. Functions here mutate the GameState passed in and never
 * touch the DOM, timers or storage, so they can be unit tested and reused
 * for offline catch-up.
 */
import { CONFIG, ORE_IDS, OreId, ZONES, ZoneDef, ZoneId, oreDef } from './config';
import {
  addOre,
  currentZone,
  zoneBoost,
  emptyFlags,
  emptyOre,
  hasResearch,
  oreReachable,
  researchLevel,
  sumOre,
  zoneUnlocked,
} from './common';
import { advanceCrew, ensureCrew, nightOwlBonus, postBonus } from './crew-rules';
import { DRONE_IDS, DroneType } from './fleet-data';
import {
  advanceFleet,
  buyDronesOf,
  droneCostOf,
  haulerCargoMult,
  maxAffordableOf,
  mechRates,
  miningDroneRates,
  passiveSdRate,
  perDroneRateOf,
  salvagerDataCoreBonus,
  salvagerDepletionBonus,
} from './fleet-rules';
import { RESEARCH, researchNode } from './research';
import { CORES } from './core-data';
import { applySalvage, crackSalvage, rollSpecial, specialComposition, specialName } from './special-rules';
import { specialDef } from './special-data';
import { advanceForge, autoSellAlloys, emptyAlloyFlags, emptyAlloys, emptyForge, forgeReserved, sellAllAlloys } from './alloy-rules';
import { advanceAnomalies, codexProductionBonus, codexSurveyBonus, emptyAnomalies, ensureAnomalies, lensMult } from './anomaly-rules';
import { advanceScan, generateSector, oreCharted, pulsarSurge, sectorHasOre, sectorMods, sectorZones, starLabel } from './sector-rules';
import {
  advanceTrade,
  emptyContracts,
  emptyTrade,
  ensureStoryBonds,
  ensureTradeSector,
  overdriveCellActive,
  surveyMult,
  tradeSellMult,
} from './trade-rules';
import { advanceFold, coreLevel, depthMult, emptyFold, resonanceMult } from './fold-rules';
import { advanceStory, emptyStory, medalMult, openLog } from './story-rules';
import {
  LossContext,
  ONLINE,
  advanceThreats,
  emptyThreats,
  eventPriceMult,
  marketBlocked,
  offlineContext,
  productionMult,
} from './threat-rules';
import { Rng } from './rng';
import {
  AsteroidState,
  ClickResult,
  GameState,
  OfflineReport,
  OreAmounts,
  RefinerySlot,
  ResearchDone,
  TickEvents,
} from './types';

export * from './common';
export * from './crew-rules';
export * from './fleet-rules';
export * from './alloy-rules';
export * from './core-rules';
export * from './special-rules';

function emptyDrones(): Record<DroneType, number> {
  const d = {} as Record<DroneType, number>;
  for (const id of DRONE_IDS) d[id] = 0;
  return d;
}

export function emptyEvents(): TickEvents {
  return {
    research: [],
    levelUps: [],
    syncUps: [],
    autoRepairs: [],
    threatStarted: [],
    threatResolved: [],
    anomaly: [],
    trade: [],
    ingots: emptyOre(),
    alloys: 0,
    charted: [],
    autoSoldCredits: 0,
    story: [],
  };
}

// ---------------------------------------------------------------- setup

export function newGame(commander: string, ship: string, now: number, seed: number): GameState {
  const state: GameState = {
    version: 13,
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
    ingots: emptyOre(),
    matrix: {},
    alloys: emptyAlloys(),
    forge: emptyForge(),
    cargoLevel: 0,
    sensorArray: 0,
    drill: { powerLevel: 0, tier: 1, heat: 0, lockRemaining: 0, heatSinkLevel: 0, clamp: false },
    drones: emptyDrones(),
    dispatch: {},
    mechs: [],
    parts: {},
    pilots: [],
    recruits: [],
    recruitRefresh: 0,
    posts: {},
    nextId: 1,
    wrecks: emptyDrones(),
    threats: emptyThreats(),
    anomalies: emptyAnomalies(),
    trade: emptyTrade(),
    contracts: emptyContracts(),
    bonds: [],
    fold: emptyFold(),
    story: emptyStory(),
    asteroid: null as unknown as AsteroidState,
    sector: { seed: seed >>> 0, code: '00-H', name: 'Home Reach', star: 'Yellow main-sequence', depth: 0, charted: 1, scan: null },
    zone: 'inner',
    research: { levels: {}, active: [] },
    refinery: { slots: [], capacityLevel: 0 },
    autoSell: { ore: emptyFlags(), ingot: emptyFlags(), alloy: emptyAlloyFlags(), smart: false },
    stats: {
      clicks: 0,
      oreMined: 0,
      oreLost: 0,
      asteroidsCracked: 0,
      overdriveClicks: 0,
      overheats: 0,
      creditsEarned: 0,
      ingotsRefined: 0,
      alloysForged: 0,
      researchCompleted: 0,
      mechOre: 0,
      mechsBuilt: 0,
    },
    flags: {},
  };
  syncSector(state);
  ensureAnomalies(state);
  ensureTradeSector(state);
  openLog(state);
  state.asteroid = spawnAsteroid(state);
  return state;
}

/** Keeps the stored sector labels in step with the generated sector. */
export function syncSector(state: GameState): void {
  const def = generateSector(state.sector.seed, state.sector.depth);
  state.sector.code = def.code;
  state.sector.name = def.name;
  state.sector.star = starLabel(def);
  if (!def.zones.some((z) => z.id === state.zone)) state.zone = def.zones[0].id;
}

export function spawnAsteroid(state: GameState): AsteroidState {
  const rng = new Rng(state.rng);
  const a = CONFIG.asteroid;
  const zone = currentZone(state);
  const growth = Math.min(1 + state.stats.asteroidsCracked * a.massGrowthPerCrack, a.maxMassMult);
  const wobble = rng.range(0.8, 1.25);
  // Scale with drill power too, so upgrades don't make asteroids trivial.
  const mass = Math.round(
    Math.max(a.baseMass * zone.massMult * growth, baseDrillPower(state) * a.minClicks) * wobble * sectorMods(state).asteroidMass,
  );
  // Now and then something better than plain rock drifts in.
  const special = rollSpecial(state, rng, zone);
  const rich = !special && rng.next() < a.richChance;

  // Wobble the zone's mix; rich rocks carry far more of the zone's top ore.
  const top = [...ORE_IDS].reverse().find((id) => (zone.composition[id] ?? 0) > 0)!;
  const composition = emptyOre();
  let total = 0;
  for (const id of ORE_IDS) {
    let w = (zone.composition[id] ?? 0) * rng.range(0.7, 1.3);
    if (rich && id === top) w *= 3;
    composition[id] = w;
    total += w;
  }
  for (const id of ORE_IDS) composition[id] = total > 0 ? composition[id] / total : 0;
  const size = special ? Math.round(mass * specialDef(special.kind).massMult) : mass;

  const asteroid: AsteroidState = {
    shapeSeed: (rng.next() * 4294967296) >>> 0,
    mass: size,
    maxMass: size,
    composition: special ? specialComposition(state, special, composition) : composition,
    rich,
    zone: zone.id,
    special,
  };
  state.rng = rng.state;
  return asteroid;
}

// ---------------------------------------------------------------- research levels & zones

export function setZone(state: GameState, id: ZoneId): boolean {
  if (!zoneUnlocked(state, id) || state.zone === id) return false;
  state.zone = id;
  state.asteroid = spawnAsteroid(state);
  return true;
}

export function unlockedZones(state: GameState): ZoneDef[] {
  return sectorZones(state).filter((z) => zoneUnlocked(state, z.id));
}


// ---------------------------------------------------------------- derived values

/** Drill power from upgrades alone (used to size asteroids and targets). */
export function baseDrillPower(state: GameState): number {
  const d = CONFIG.drill;
  const lvl = state.drill.powerLevel;
  return (d.basePower + lvl * d.powerPerLevel) * 2 ** Math.floor(lvl / d.powerDoublingEvery);
}

/** Power per click right now: upgrades × sector effects × Gravity Lens × comet. */
export function drillPower(state: GameState): number {
  return baseDrillPower(state) * sectorMods(state).clickPower * lensMult(state) * zoneBoost(state, state.zone) * depthMult(state) * medalMult(state, 'drill');
}

export function overdriveMult(state: GameState): number {
  return (
    CONFIG.heat.overdriveMult +
    researchLevel(state, 'overdrive_tuning') * CONFIG.bonuses.overdrivePerLevel +
    sectorMods(state).overdriveBonus +
    coreLevel(state, 'core_overdrive') * 0.5
  );
}

export function heatDecay(state: GameState): number {
  const h = CONFIG.heat;
  return h.decayPerSec * (1 + state.drill.heatSinkLevel * h.sinkDecayBonus);
}

/** True while the drill is warm from use but still in the cool Overdrive band. */
export function isOverdrive(state: GameState): boolean {
  const heat = state.drill.heat;
  return state.drill.lockRemaining <= 0 && heat > 0 && heat <= CONFIG.heat.overdriveMax;
}

/** Warm enough to be out of Overdrive, not yet locked out. */
export function isHot(state: GameState): boolean {
  return state.drill.lockRemaining <= 0 && state.drill.heat > CONFIG.heat.overdriveMax;
}

export function cargoCapacity(state: GameState, level = state.cargoLevel): number {
  const c = CONFIG.cargo;
  const bonus = 1 + researchLevel(state, 'cargo_compression') * CONFIG.bonuses.cargoPerLevel;
  const lv = Math.min(level, c.maxLevel);
  return Math.min(c.maxCapacity, Math.floor(c.baseCapacity * c.capacityGrowth ** lv * bonus * haulerCargoMult(state)));
}

/**
 * Hold space in use: raw ore, finished ingots (1 t each), and space reserved
 * for ingots still in the furnaces, so a finished batch always has room.
 */
export function cargoUsed(state: GameState): number {
  return (
    sumOre(state.cargo) +
    sumOre(state.ingots) +
    refineryReserved(state) +
    Object.values(state.alloys).reduce((a, b) => a + b, 0) +
    forgeReserved(state)
  );
}

/** Ingots currently being made, which already have hold space set aside. */
export function refineryReserved(state: GameState): number {
  const ratio = oreRatio(state);
  return state.refinery.slots.reduce((s, slot) => s + (slot.batch > 0 ? slot.batch / ratio : 0), 0);
}

export function perDroneRate(state: GameState): number {
  return perDroneRateOf(state, 'prospector');
}

/** Ore per second from mining drones (all dispatched zones, with Command Link). */
export function droneRates(state: GameState): OreAmounts {
  return miningDroneRates(
    state,
    sectorMods(state).droneOutput * (pulsarSurge(state) ? 2 : 1) * codexProductionBonus(state) * resonanceMult(state) * depthMult(state) * medalMult(state, 'production'),
  );
}

export function droneRateTotal(state: GameState): number {
  return sumOre(droneRates(state));
}

export function mechRateTotal(state: GameState): number {
  return sumOre(mechRates(state));
}

export function surveyDataPerCrack(state: GameState): number {
  const bonus = 1 + researchLevel(state, 'core_sampling') * CONFIG.bonuses.surveyDataPerLevel;
  return (
    currentZone(state).surveyData *
    CONFIG.asteroid.surveyDataPerCrack *
    bonus *
    (1 + postBonus(state, 'sensor')) *
    codexSurveyBonus(state) *
    surveyMult(state)
  );
}

export function offlineEfficiency(state: GameState): number {
  return (
    CONFIG.offline.efficiency +
    researchLevel(state, 'offline_efficiency') * CONFIG.bonuses.offlineEfficiencyPerLevel +
    nightOwlBonus(state) +
    sectorMods(state).offlineBonus +
    coreLevel(state, 'core_offline') * 0.1
  );
}

export function offlineCapHours(state: GameState): number {
  return CONFIG.offline.capHours + researchLevel(state, 'offline_cap') * CONFIG.bonuses.offlineCapHoursPerLevel + coreLevel(state, 'core_offline') * 2;
}

// ---------------------------------------------------------------- market

/** Market multiplier, roughly 0.8–1.2, deterministic from the market clock. */
export function marketMultiplier(clock: number, ore: OreId): number {
  const m = CONFIG.market;
  const i = ORE_IDS.indexOf(ore);
  const slow = Math.sin((2 * Math.PI * clock) / m.slowPeriodSec + i * 1.9);
  const fast = Math.sin((2 * Math.PI * clock) / m.fastPeriodSec + i * 4.3);
  return 1 + slow * m.slowAmp + fast * m.fastAmp;
}

/** Sell price including the Quartermaster's haggling. */
export function orePrice(state: GameState, ore: OreId): number {
  return (
    oreDef(ore).baseValue *
    // Trade hubs swing harder.
    (1 + (marketMultiplier(state.marketClock, ore) - 1) * mods(state).marketAmp) *
    eventPriceMult(state, ore) *
    mods(state).sellPrice *
    tradeSellMult(state, ore) *
    (1 + postBonus(state, 'quartermaster')) *
    medalMult(state, 'sell')
  );
}

export function ingotPrice(state: GameState, ore: OreId): number {
  return orePrice(state, ore) * CONFIG.refinery.ingotValueMult;
}

/** +1 rising, -1 falling, 0 flat. */
export function priceTrend(state: GameState, ore: OreId): number {
  const d = marketMultiplier(state.marketClock + 1, ore) - marketMultiplier(state.marketClock, ore);
  return Math.abs(d) < 0.0005 ? 0 : Math.sign(d);
}

/** Best price multiplier in the next `horizon` seconds (Market Analysis). */
export function priceForecast(state: GameState, ore: OreId, horizon = 90): { peak: number; inSec: number } {
  let peak = marketMultiplier(state.marketClock, ore);
  let inSec = 0;
  for (let t = 1; t <= horizon; t++) {
    const m = marketMultiplier(state.marketClock + t, ore);
    if (m > peak) {
      peak = m;
      inSec = t;
    }
  }
  return { peak, inSec };
}

// ---------------------------------------------------------------- costs

/** Prospector cost for `count` more drones. */
export function droneCost(state: GameState, count = 1): number {
  return droneCostOf(state, 'prospector', count);
}

export function maxAffordableDrones(state: GameState): number {
  return maxAffordableOf(state, 'prospector');
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

/** Price of the next Expand Hold level, or null once the hold is at its cap. */
export function cargoUpgradeCost(state: GameState): number | null {
  const c = CONFIG.cargo;
  if (state.cargoLevel >= c.maxLevel || cargoCapacity(state) >= c.maxCapacity) return null;
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

// ---------------------------------------------------------------- drilling

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
    surveyData: 0,
  };
  const drill = state.drill;
  if (drill.lockRemaining > 0) {
    result.locked = true;
    return result;
  }

  state.stats.clicks++;
  const cell = overdriveCellActive(state);
  drill.heat += h.perClick * sectorMods(state).heatPerClick;
  if (cell) drill.heat = Math.min(drill.heat, h.max - 1);
  if (drill.heat >= h.max) {
    drill.heat = h.max;
    drill.lockRemaining = h.lockSec;
    state.stats.overheats++;
    result.overheated = true;
    return result;
  }
  result.overdrive = cell || drill.heat <= h.overdriveMax;
  if (result.overdrive) state.stats.overdriveClicks++;

  const asteroid = state.asteroid;
  const power = drillPower(state) * (result.overdrive ? overdriveMult(state) : 1);
  const mined = Math.min(power, asteroid.mass);
  asteroid.mass -= mined;
  // Special rocks give more ore per tonne cut.
  const spec = asteroid.special ? specialDef(asteroid.special.kind) : null;
  const yieldMult = spec?.yieldMult ?? 1;

  const haul = emptyOre();
  for (const id of ORE_IDS) {
    const amount = mined * yieldMult * asteroid.composition[id];
    if (oreReachable(state, id)) haul[id] = amount;
    else result.slag += amount;
  }

  if (asteroid.mass <= 1e-9) {
    result.cracked = true;
    const a = CONFIG.asteroid;
    const bonusFrac =
      a.depletionBonusFrac *
      (1 + researchLevel(state, 'depletion_bonus') * CONFIG.bonuses.depletionPerLevel + salvagerDepletionBonus(state)) *
      sectorMods(state).crackBonus *
      (spec?.crackMult ?? 1);
    for (const id of ORE_IDS) {
      if (oreReachable(state, id)) haul[id] += asteroid.maxMass * bonusFrac * asteroid.composition[id];
    }
    const rng = new Rng(state.rng);
    if (asteroid.special) {
      const salvage = crackSalvage(state, asteroid, currentZone(state), rng);
      for (const id of ORE_IDS) if (oreReachable(state, id)) haul[id] += salvage.ore[id];
      applySalvage(state, salvage);
      const key = asteroid.special.derelict ? `derelict:${asteroid.special.derelict}` : asteroid.special.kind;
      state.stats.specials = { ...(state.stats.specials ?? {}), [key]: (state.stats.specials?.[key] ?? 0) + 1 };
      result.special = { name: specialName(asteroid.special), salvage: salvage.text, kind: asteroid.special.kind };
    }
    const lattice = 1 + researchLevel(state, 'core_lattice') * CORES.latticePerLevel;
    if (rng.next() < a.dataCoreChance * lattice + salvagerDataCoreBonus(state)) {
      result.dataCore = true;
      state.dataCores++;
    }
    state.rng = rng.state;
    result.surveyData = surveyDataPerCrack(state);
    state.surveyData += result.surveyData;
    state.stats.asteroidsCracked++;
    state.asteroid = spawnAsteroid(state);
  }

  const { added, lost } = addToCargo(state, haul);
  result.gained = added;
  result.lost = lost;
  return result;
}

// ---------------------------------------------------------------- selling

export function sell(state: GameState, ore: OreId): number {
  if (marketBlocked(state)) return 0;
  const amount = Math.floor(state.cargo[ore]);
  if (amount <= 0) return 0;
  const credits = amount * orePrice(state, ore);
  state.cargo[ore] -= amount;
  earn(state, credits);
  return credits;
}

export function sellIngots(state: GameState, ore: OreId): number {
  if (marketBlocked(state)) return 0;
  const amount = Math.floor(state.ingots[ore]);
  if (amount <= 0) return 0;
  const credits = amount * ingotPrice(state, ore);
  state.ingots[ore] -= amount;
  earn(state, credits);
  return credits;
}

export function sellAll(state: GameState): number {
  return ORE_IDS.reduce((sum, id) => sum + sell(state, id) + sellIngots(state, id), 0) + sellAllAlloys(state);
}

export function earn(state: GameState, credits: number): void {
  state.credits += credits;
  state.stats.creditsEarned += credits;
}

/** Sells everything flagged for auto-sell. Smart Sell skips below-average prices. */
function runAutoSell(state: GameState): number {
  if (!hasResearch(state, 'auto_sell')) return 0;
  const smart = state.autoSell.smart && hasResearch(state, 'market_analysis');
  let total = 0;
  for (const id of ORE_IDS) {
    if (smart && marketMultiplier(state.marketClock, id) < 1) continue;
    if (state.autoSell.ore[id]) total += sell(state, id);
    if (state.autoSell.ingot[id]) total += sellIngots(state, id);
  }
  return total + autoSellAlloys(state, smart);
}

export function toggleAutoSell(state: GameState, kind: 'ore' | 'ingot', ore: OreId): boolean {
  if (!hasResearch(state, 'auto_sell')) return false;
  state.autoSell[kind][ore] = !state.autoSell[kind][ore];
  return true;
}

export function toggleSmartSell(state: GameState): boolean {
  if (!hasResearch(state, 'market_analysis')) return false;
  state.autoSell.smart = !state.autoSell.smart;
  return true;
}

// ---------------------------------------------------------------- shop

export function buyDrones(state: GameState, count: number, type: DroneType = 'prospector'): number {
  return buyDronesOf(state, type, count);
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
  if (!up || state.credits < up.cost) return false;
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

// ---------------------------------------------------------------- Trigger Clamp (hold to drill)

export function buyClamp(state: GameState): boolean {
  if (state.drill.clamp || state.credits < CONFIG.hold.cost) return false;
  state.credits -= CONFIG.hold.cost;
  state.drill.clamp = true;
  return true;
}

/** Seconds between hits while the mouse button is held on the asteroid. */
export function holdInterval(state: GameState): number {
  const h = CONFIG.hold;
  return h.baseIntervalSec * h.servoFactor ** researchLevel(state, 'servo_actuators');
}

/**
 * With the Thermal Governor, a held drill skips a hit that would push it out
 * of Overdrive, so holding stays in the cool zone by itself.
 */
export function holdShouldWait(state: GameState): boolean {
  if (!hasResearch(state, 'thermal_governor') || overdriveCellActive(state)) return false;
  const next = state.drill.heat + CONFIG.heat.perClick * sectorMods(state).heatPerClick;
  return next > CONFIG.heat.overdriveMax;
}

export function buyCargo(state: GameState): boolean {
  const cost = cargoUpgradeCost(state);
  if (cost === null || state.credits < cost) return false;
  state.credits -= cost;
  state.cargoLevel++;
  return true;
}

// ---------------------------------------------------------------- research

export function labSlots(state: GameState): number {
  return CONFIG.research.baseLabSlots + researchLevel(state, 'lab_slot_2') + researchLevel(state, 'lab_slot_3');
}

/** Level a node will have once queued/active jobs finish. */
function plannedLevel(state: GameState, id: string): number {
  const active = state.research.active.filter((j) => j.id === id).length;
  return researchLevel(state, id) + active;
}

export function researchCost(state: GameState, id: string): { sd: number; cr: number; sec: number; cores: number } {
  const n = researchNode(id);
  const lvl = plannedLevel(state, id);
  const g = n.growth ** lvl;
  return {
    sd: Math.ceil(n.sd * g),
    cr: Math.ceil(n.cr * g),
    sec: Math.ceil(n.sec * Math.sqrt(g)),
    cores: n.cores ? n.cores + lvl : 0,
  };
}

export type ResearchStatus = 'teaser' | 'locked' | 'maxed' | 'active' | 'available';

export function researchStatus(state: GameState, id: string): ResearchStatus {
  const n = researchNode(id);
  if (n.teaser) return 'teaser';
  if (researchLevel(state, id) >= n.maxLevel) return 'maxed';
  if (state.research.active.some((j) => j.id === id)) return 'active';
  const prereqs = n.requires.every((r) => hasResearch(state, r));
  const tier = !n.requiresTier || state.drill.tier >= n.requiresTier;
  const zones = !n.requiresZones || sectorZones(state).filter((z) => zoneUnlocked(state, z.id)).length >= n.requiresZones;
  const ore = !n.requiresOre || oreCharted(state, n.requiresOre);
  return prereqs && tier && zones && ore ? 'available' : 'locked';
}

/** Why a node can't be started right now, or null if it can. */
export function researchBlocker(state: GameState, id: string): string | null {
  const n = researchNode(id);
  const status = researchStatus(state, id);
  if (status === 'teaser') return `Arrives in ${n.teaser}`;
  if (status === 'maxed') return 'Fully researched';
  if (status === 'active') return 'In progress';
  const missing = n.requires.filter((r) => !hasResearch(state, r)).map((r) => researchNode(r).name);
  if (missing.length) return `Requires ${missing.join(', ')}`;
  if (n.requiresOre && !sectorHasOre(state, n.requiresOre)) return `No ${oreDef(n.requiresOre).name} in this sector`;
  if (n.requiresOre && !oreCharted(state, n.requiresOre)) return `Scan the sector until a zone with ${oreDef(n.requiresOre).name} is charted (MAP)`;
  if (n.requiresZones && sectorZones(state).filter((z) => zoneUnlocked(state, z.id)).length < n.requiresZones)
    return `Chart ${n.requiresZones} zones with sector scans (MAP)`;
  if (n.requiresTier && state.drill.tier < n.requiresTier) return `Requires Drill Mk.${['I', 'II', 'III', 'IV', 'V'][n.requiresTier - 1]}`;
  if (state.research.active.length >= labSlots(state)) return 'All lab benches busy';
  const cost = researchCost(state, id);
  if (state.surveyData < cost.sd) return 'Not enough Survey Data';
  if (state.credits < cost.cr) return 'Not enough credits';
  if (state.dataCores < cost.cores) return 'Not enough Data Cores';
  return null;
}

export function startResearch(state: GameState, id: string): boolean {
  if (researchBlocker(state, id) !== null) return false;
  const cost = researchCost(state, id);
  state.surveyData -= cost.sd;
  state.credits -= cost.cr;
  state.dataCores -= cost.cores;
  state.research.active.push({
    id,
    level: researchLevel(state, id) + 1,
    remaining: cost.sec,
    duration: cost.sec,
    paidSd: cost.sd,
    paidCr: cost.cr,
    paidCores: cost.cores,
  });
  return true;
}

export function cancelResearch(state: GameState, index: number): boolean {
  const job = state.research.active[index];
  if (!job) return false;
  state.research.active.splice(index, 1);
  state.surveyData += job.paidSd;
  state.credits += job.paidCr;
  state.dataCores += job.paidCores ?? 0;
  return true;
}

function advanceResearch(state: GameState, dt: number): ResearchDone[] {
  const done: ResearchDone[] = [];
  const speed = (1 + postBonus(state, 'science')) * medalMult(state, 'research');
  for (const job of state.research.active) job.remaining -= dt * speed;
  const finished = state.research.active.filter((j) => j.remaining <= 0);
  if (!finished.length) return done;
  state.research.active = state.research.active.filter((j) => j.remaining > 0);

  const rng = new Rng(state.rng);
  for (const job of finished) {
    state.research.levels[job.id] = Math.max(researchLevel(state, job.id), job.level);
    state.stats.researchCompleted++;
    applyResearchEffect(state, job.id);
    const eureka = rng.next() < CONFIG.research.eurekaChance * (1 + postBonus(state, 'science'));
    if (eureka) {
      state.surveyData += job.paidSd;
      state.credits += job.paidCr;
    }
    done.push({ id: job.id, level: job.level, eureka });
  }
  state.rng = rng.state;
  return done;
}

function applyResearchEffect(state: GameState, id: string): void {
  switch (id) {
    case 'drill_mk3':
      state.drill.tier = Math.max(state.drill.tier, 3);
      break;
    case 'drill_mk4':
      state.drill.tier = Math.max(state.drill.tier, 4);
      break;
    case 'drill_mk5':
      state.drill.tier = Math.max(state.drill.tier, 5);
      break;
    case 'refinery':
    case 'refinery_slots':
      syncRefinerySlots(state);
      break;
    case 'hangar':
    case 'repair_bay':
      ensureCrew(state);
      break;
  }
}

// ---------------------------------------------------------------- refinery

export function refinerySlotCount(state: GameState): number {
  if (!hasResearch(state, 'refinery')) return 0;
  return 1 + researchLevel(state, 'refinery_slots');
}

/** Makes the slot array match the researched slot count. */
export function syncRefinerySlots(state: GameState): void {
  const want = refinerySlotCount(state);
  while (state.refinery.slots.length < want) {
    state.refinery.slots.push({ ore: null, batch: 0, remaining: 0, duration: 0, repeat: false });
  }
}

export function oreRatio(state: GameState): number {
  const r = CONFIG.refinery;
  return Math.max(r.minRatio, r.baseRatio - researchLevel(state, 'refinery_yield'));
}

/** Most ore a furnace takes in one batch (rounded down to whole ingots). */
export function batchCapacity(state: GameState, level = state.refinery.capacityLevel): number {
  const r = CONFIG.refinery;
  const ratio = oreRatio(state);
  const raw = r.baseBatch * r.batchGrowth ** Math.min(level, r.maxBatchLevel);
  return Math.max(ratio, Math.floor(raw / ratio) * ratio);
}

/** Price of the next Furnace Capacity level, or null at the cap. */
export function furnaceCapacityCost(state: GameState): number | null {
  const r = CONFIG.refinery;
  if (state.refinery.capacityLevel >= r.maxBatchLevel) return null;
  return Math.ceil(r.batchCostBase * r.batchCostGrowth ** state.refinery.capacityLevel);
}

export function buyFurnaceCapacity(state: GameState): boolean {
  if (!hasResearch(state, 'refinery')) return false;
  const cost = furnaceCapacityCost(state);
  if (cost === null || state.credits < cost) return false;
  state.credits -= cost;
  state.refinery.capacityLevel++;
  return true;
}

export function batchDuration(state: GameState): number {
  const r = CONFIG.refinery;
  return (
    (r.baseDurationSec * r.speedFactor ** researchLevel(state, 'refinery_speed') * (1 - postBonus(state, 'refinery'))) /
    sectorMods(state).refinerySpeed
  );
}

/** Loads a batch into a slot from cargo. Returns false if there isn't enough ore. */
export function startBatch(state: GameState, index: number, ore: OreId): boolean {
  const slot = state.refinery.slots[index];
  if (!slot || slot.batch > 0 || !oreReachable(state, ore)) return false;
  slot.ore = ore;
  return loadBatch(state, slot);
}

function loadBatch(state: GameState, slot: RefinerySlot): boolean {
  if (!slot.ore) return false;
  const ratio = oreRatio(state);
  const amount = Math.min(batchCapacity(state), Math.floor(state.cargo[slot.ore] / ratio) * ratio);
  if (amount < ratio) return false;
  state.cargo[slot.ore] -= amount;
  slot.batch = amount;
  slot.duration = batchDuration(state);
  slot.remaining = slot.duration;
  return true;
}

export function setSlotRepeat(state: GameState, index: number, repeat: boolean): boolean {
  const slot = state.refinery.slots[index];
  if (!slot || !hasResearch(state, 'auto_refine')) return false;
  slot.repeat = repeat;
  return true;
}

/** Clears an idle slot's assignment. Running batches finish first. */
export function clearSlot(state: GameState, index: number): boolean {
  const slot = state.refinery.slots[index];
  if (!slot || slot.batch > 0) return false;
  slot.ore = null;
  slot.repeat = false;
  return true;
}

function advanceRefinery(state: GameState, dt: number): OreAmounts {
  const made = emptyOre();
  const ratio = oreRatio(state);
  for (const slot of state.refinery.slots) {
    let left = dt;
    // Loop so long offline steps can finish several batches.
    while (left > 0) {
      if (slot.batch <= 0) {
        if (!(slot.repeat && hasResearch(state, 'auto_refine') && loadBatch(state, slot))) break;
      }
      const step = Math.min(left, slot.remaining);
      slot.remaining -= step;
      left -= step;
      if (slot.remaining <= 1e-9 && slot.ore) {
        const ingots = slot.batch / ratio;
        state.ingots[slot.ore] += ingots;
        made[slot.ore] += ingots;
        state.stats.ingotsRefined += ingots;
        slot.batch = 0;
        slot.remaining = 0;
      }
    }
  }
  return made;
}

// ---------------------------------------------------------------- time

/** Everything that runs over time: drones, mechs, crew, refinery, research, auto-sell. */
function advance(
  state: GameState,
  dt: number,
  efficiency: number,
  ctx: LossContext = ONLINE,
): TickEvents & { added: OreAmounts; lost: number } {
  const events = emptyEvents();
  state.marketClock += dt;

  // Hazards: sheltering from a flare stops drones; a reactor fault slows everything.
  const hazard = productionMult(state);
  const m = sectorMods(state);
  const boost = (pulsarSurge(state) ? 2 : 1) * codexProductionBonus(state) * resonanceMult(state) * depthMult(state) * medalMult(state, 'production') * hazard.all;
  const amounts = miningDroneRates(state, efficiency * hazard.drones * m.droneOutput * boost);
  for (const id of ORE_IDS) amounts[id] *= dt;
  addOre(amounts, advanceFleet(state, dt, efficiency * boost, events));
  const { added, lost } = addToCargo(state, amounts);
  state.surveyData += passiveSdRate(state) * dt * efficiency * codexSurveyBonus(state) * surveyMult(state);

  advanceCrew(state, dt, events);
  events.ingots = advanceRefinery(state, dt);
  events.alloys = advanceForge(state, dt);
  const charted = advanceScan(state, dt);
  if (charted) events.charted.push(charted.name);
  events.research = advanceResearch(state, dt);
  advanceTrade(state, dt, events, ctx.offline);
  advanceFold(state);
  events.autoSoldCredits = runAutoSell(state);
  advanceThreats(state, dt, events, ctx);
  advanceAnomalies(state, dt, events, ctx.offline);
  advanceStory(state, events);
  return { ...events, added, lost };
}

/** Advances the game by dt seconds while the game is open. */
export function tick(state: GameState, dt: number): TickEvents {
  state.playtimeSec += dt;

  const drill = state.drill;
  if (drill.lockRemaining > 0) {
    drill.lockRemaining = Math.max(0, drill.lockRemaining - dt);
    // Vent heat to zero over the lockout.
    drill.heat = (CONFIG.heat.max * drill.lockRemaining) / CONFIG.heat.lockSec;
  } else {
    drill.heat = Math.max(0, drill.heat - heatDecay(state) * dt);
  }

  const { added: _added, lost: _lost, ...events } = advance(state, dt, 1);
  return events;
}

/**
 * Applies time spent away. Drones run at reduced efficiency; the refinery and
 * research run at full speed. Simulated in chunks so auto-sell and refining
 * interleave with production.
 */
export function simulateOffline(state: GameState, seconds: number): OfflineReport {
  const capped = Math.min(seconds, offlineCapHours(state) * 3600);
  const efficiency = offlineEfficiency(state);
  state.drill.heat = 0;
  state.drill.lockRemaining = 0;

  const report: OfflineReport = {
    seconds,
    cappedSeconds: capped,
    efficiency,
    gained: emptyOre(),
    ingots: emptyOre(),
    alloys: 0,
    credits: 0,
    research: [],
    lost: 0,
    cargoFull: false,
    threats: [],
  };
  const ctx = offlineContext(state);
  const steps = Math.min(600, Math.max(1, Math.ceil(capped / 10)));
  const dt = capped / steps;
  for (let i = 0; i < steps; i++) {
    const r = advance(state, dt, efficiency, ctx);
    for (const t of r.threatResolved) report.threats.push(t.text);
    for (const a of r.anomaly) report.threats.push(a.text);
    for (const t of r.trade) report.threats.push(t.text);
    addOre(report.gained, r.added);
    addOre(report.ingots, r.ingots);
    report.alloys += r.alloys;
    report.credits += r.autoSoldCredits;
    report.research.push(...r.research);
    report.lost += r.lost;
  }
  report.cargoFull = report.lost > 0;
  return report;
}

/** All research nodes, for UI iteration. */
export { RESEARCH };

function mods(state: GameState) {
  return sectorMods(state);
}

export { ensureStoryBonds };
export { bondsOf } from './trade-rules';
