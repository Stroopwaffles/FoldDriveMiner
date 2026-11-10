/** Drones of every type, Fleet Dispatch, mechs, loadouts, repair and techniques. */
import { CONFIG, ZONES, ZoneId, zoneDef } from './config';
import { emptyOre, hasResearch, nextId, researchLevel, splitByZone, zoneUnlocked } from './common';
import { CREW, STORY_PILOTS } from './crew-data';
import { hasTrait, isInjured, pilotById, pilotStats, postBonus, syncLevel, unassign } from './crew-rules';
import {
  CONDITION,
  DRONE_EFFECTS,
  DroneType,
  FrameId,
  MECH,
  MechStat,
  SLOTS,
  SlotId,
  droneDef,
  frameDef,
  partDef,
} from './fleet-data';
import { GameState, MechJob, MechState, OreAmounts, PilotState, TickEvents } from './types';

// ---------------------------------------------------------------- drones

export function droneUnlocked(state: GameState, type: DroneType): boolean {
  const d = droneDef(type);
  if (d.teaser) return false;
  return !d.research || hasResearch(state, d.research);
}

export function droneMultiplier(count: number): number {
  return 2 ** CONFIG.drones.milestones.filter((m) => count >= m).length;
}

export function nextDroneMilestone(count: number): number | null {
  return CONFIG.drones.milestones.find((m) => m > count) ?? null;
}

export function firmwareBonus(state: GameState): number {
  return 1 + researchLevel(state, 'drone_efficiency') * CONFIG.bonuses.dronePerLevel;
}

/** Ore per second for one drone of a mining type, including milestones and firmware. */
export function perDroneRateOf(state: GameState, type: DroneType): number {
  return droneDef(type).orePerSec * droneMultiplier(state.drones[type]) * firmwareBonus(state);
}

export function droneCostOf(state: GameState, type: DroneType, count = 1): number {
  const d = droneDef(type);
  const g = d.costGrowth;
  return (d.baseCost * g ** state.drones[type] * (g ** count - 1)) / (g - 1);
}

export function maxAffordableOf(state: GameState, type: DroneType): number {
  const d = droneDef(type);
  const g = d.costGrowth;
  const first = d.baseCost * g ** state.drones[type];
  if (first <= 0 || state.credits < first) return 0;
  return Math.floor(Math.log((state.credits * (g - 1)) / first + 1) / Math.log(g));
}

export function buyDronesOf(state: GameState, type: DroneType, count: number): number {
  if (!droneUnlocked(state, type)) return 0;
  let n = Math.min(count, maxAffordableOf(state, type));
  // Guard against floating-point rounding in the closed-form max.
  while (n > 0 && droneCostOf(state, type, n) > state.credits) n--;
  if (n <= 0) return 0;
  state.credits -= droneCostOf(state, type, n);
  state.drones[type] += n;
  return n;
}

export function haulerCargoMult(state: GameState): number {
  return 1 + state.drones.hauler * DRONE_EFFECTS.haulerCargoBonus;
}

export function salvagerDepletionBonus(state: GameState): number {
  return state.drones.salvager * DRONE_EFFECTS.salvagerDepletionBonus;
}

export function salvagerDataCoreBonus(state: GameState): number {
  return Math.min(DRONE_EFFECTS.salvagerDataCoreCap, state.drones.salvager * DRONE_EFFECTS.salvagerDataCoreChance);
}

// ---------------------------------------------------------------- dispatch

/** Share of mining drones in each zone. Without Fleet Dispatch, all follow the ship. */
export function dispatchShares(state: GameState): Partial<Record<ZoneId, number>> {
  if (!hasResearch(state, 'fleet_dispatch')) return { [state.zone]: 1 };
  let total = 0;
  const shares: Partial<Record<ZoneId, number>> = {};
  for (const z of ZONES) {
    if (!zoneUnlocked(state, z.id)) continue;
    const w = Math.max(0, state.dispatch[z.id] ?? 0);
    shares[z.id] = w;
    total += w;
  }
  if (total <= 0) return { [state.zone]: 1 };
  for (const id of Object.keys(shares) as ZoneId[]) shares[id] = shares[id]! / total;
  return shares;
}

export function setDispatch(state: GameState, zone: ZoneId, weight: number): boolean {
  if (!hasResearch(state, 'fleet_dispatch') || !zoneUnlocked(state, zone)) return false;
  state.dispatch[zone] = Math.max(0, Math.min(100, Math.round(weight)));
  return true;
}

// ---------------------------------------------------------------- mech stats

export function hangarBays(state: GameState): number {
  if (!hasResearch(state, 'hangar')) return 0;
  return 1 + researchLevel(state, 'hangar_bays');
}

export interface MechStats {
  mining: number;
  combat: number;
  speed: number;
  sensors: number;
  armor: number;
  supply: number;
  draw: number;
  overloaded: boolean;
}

/** The pilot actually flying (injured pilots can't fly). */
export function mechPilot(state: GameState, mech: MechState): PilotState | null {
  const p = pilotById(state, mech.pilotId);
  return p && !isInjured(p) ? p : null;
}

export function mechStats(state: GameState, mech: MechState, parts = mech.parts): MechStats {
  const frame = frameDef(mech.frame);
  const raw: Record<MechStat, number> = { ...frame.base };
  let draw = 0;
  let supply = frame.basePower;
  for (const slot of SLOTS) {
    const id = parts[slot.id];
    if (!id) continue;
    const part = partDef(id);
    for (const [k, v] of Object.entries(part.stats) as [MechStat, number][]) raw[k] += v;
    draw += part.draw;
    supply += part.supply ?? 0;
  }
  supply *= 1 + researchLevel(state, 'reactor_efficiency') * 0.1;

  // Engineering trims part power draw.
  const pilot = mechPilot(state, mech);
  if (pilot) {
    const cut = Math.min(CREW.engineeringDrawCap, pilotStats(pilot).engineering * CREW.engineeringDrawCut);
    draw *= 1 - cut;
  }

  const out = {} as Record<MechStat, number>;
  for (const k of Object.keys(raw) as MechStat[]) out[k] = Math.max(0, raw[k] * (frame.mult[k] ?? 1));
  return { ...out, supply, draw, overloaded: draw > supply + 1e-9 };
}

export function mechCondition(state: GameState, mech: MechState) {
  const max = mechStats(state, mech).armor;
  const frac = max > 0 ? mech.armor / max : 0;
  return { ...CONDITION.find((c) => frac >= c.min)!, frac, max };
}

/** Output multiplier from the pilot (or autopilot). */
export function pilotMultiplier(state: GameState, mech: MechState): number {
  const p = mechPilot(state, mech);
  if (!p) return MECH.autopilot;
  const stats = pilotStats(p);
  let m = 1 + stats.prospecting * CREW.prospectingBonus + (p.level - 1) * CREW.levelBonus + syncLevel(p, mech.frame) * CREW.syncBonus;
  if (hasTrait(p, 'steady_hands')) m *= 1.1;
  if (hasTrait(p, 'hot_blooded')) m *= 1.15;
  return m;
}

/** Can the mech work right now? */
export function mechOperable(state: GameState, mech: MechState): boolean {
  return !mechStats(state, mech).overloaded && mechCondition(state, mech).id !== 'disabled';
}

/** Ore per second a mech produces at the given efficiency (0 if not mining). */
export function mechOreRate(state: GameState, mech: MechState, efficiency = 1): OreAmounts {
  const out = emptyOre();
  if (mech.job !== 'mining' || !mechOperable(state, mech)) return out;
  const stats = mechStats(state, mech);
  const cond = mechCondition(state, mech).mult;
  const boost = mech.boostRemaining > 0 ? MECH.techniqueBoost : 1;
  // Each Mining point is worth MECH.orePerMining Prospector drones, so mechs scale with the fleet.
  const total = stats.mining * MECH.orePerMining * perDroneRateOf(state, 'prospector') * cond * pilotMultiplier(state, mech) * boost * efficiency;
  splitByZone(state, zoneDef(mech.zone), total, out);
  return out;
}

export function mechSdRate(state: GameState, mech: MechState): number {
  if (mech.job !== 'mining' || !mechOperable(state, mech)) return 0;
  return mechStats(state, mech).sensors * MECH.sdPerSensor * mechCondition(state, mech).mult;
}

/** Command Link: drone bonus in a zone from mechs mining there. */
export function commandLink(state: GameState, zone: ZoneId): number {
  let bonus = 0;
  for (const m of state.mechs) {
    if (m.zone !== zone || m.job !== 'mining' || !mechOperable(state, m)) continue;
    const frameBonus = m.frame === 'pickaxe' ? 1.5 : 1;
    bonus += mechStats(state, m).mining * MECH.commandLinkPerMining * frameBonus * mechCondition(state, m).mult;
  }
  return Math.min(MECH.commandLinkCap, bonus);
}

// ---------------------------------------------------------------- fleet production

/** Ore per second from mining drones across dispatched zones, with Command Link. */
export function miningDroneRates(state: GameState, efficiency = 1): OreAmounts {
  const out = emptyOre();
  const shares = dispatchShares(state);
  const prospector = state.drones.prospector * perDroneRateOf(state, 'prospector');
  const cutter = state.drones.cutter * perDroneRateOf(state, 'cutter');
  for (const [zid, share] of Object.entries(shares) as [ZoneId, number][]) {
    if (!share) continue;
    const zone = zoneDef(zid);
    const link = 1 + commandLink(state, zid);
    splitByZone(state, zone, prospector * share * link * efficiency, out);
    splitByZone(state, zone, cutter * share * link * efficiency, out, true);
  }
  return out;
}

export function mechRates(state: GameState, efficiency = 1): OreAmounts {
  const out = emptyOre();
  for (const m of state.mechs) {
    const r = mechOreRate(state, m, efficiency);
    for (const k of Object.keys(out) as (keyof OreAmounts)[]) out[k] += r[k];
  }
  return out;
}

/** Survey Data per second from Surveyor drones and mech sensors (before Sensor Officer). */
export function passiveSdRate(state: GameState): number {
  const drones = state.drones.surveyor * DRONE_EFFECTS.surveyorSdPerSec * droneMultiplier(state.drones.surveyor);
  const mechs = state.mechs.reduce((s, m) => s + mechSdRate(state, m), 0);
  return (drones + mechs) * (1 + postBonus(state, 'sensor'));
}

// ---------------------------------------------------------------- mech management

const MECH_NAMES = ['Kestrel', 'Anvil', 'Mule', 'Lantern', 'Sparrow', 'Bastion', 'Gravel', 'Ironclad', 'Marigold', 'Hammerhead', 'Wayfarer', 'Rook'];

export function buildMech(state: GameState, frame: FrameId): MechState | null {
  const def = frameDef(frame);
  if (state.mechs.length >= hangarBays(state) || state.credits < def.cost) return null;
  state.credits -= def.cost;
  const id = nextId(state);
  const name = MECH_NAMES[id % MECH_NAMES.length];
  const mech: MechState = {
    id,
    name,
    designation: `FDM-${String(++state.stats.mechsBuilt).padStart(2, '0')}`,
    frame,
    parts: {},
    armor: 0,
    job: 'idle',
    returnJob: null,
    zone: state.zone,
    pilotId: null,
    boostRemaining: 0,
    cooldown: 0,
  };
  mech.armor = mechStats(state, mech).armor;
  state.mechs.push(mech);
  return mech;
}

/** Dismantles a mech: parts go back to storage, the frame is lost. */
export function scrapMech(state: GameState, mechId: number): boolean {
  const mech = state.mechs.find((m) => m.id === mechId);
  if (!mech) return false;
  for (const id of Object.values(mech.parts)) if (id) state.parts[id] = (state.parts[id] ?? 0) + 1;
  state.mechs = state.mechs.filter((m) => m.id !== mechId);
  return true;
}

export function mechById(state: GameState, id: number): MechState | null {
  return state.mechs.find((m) => m.id === id) ?? null;
}

export function setMechJob(state: GameState, mechId: number, job: MechJob): boolean {
  const mech = mechById(state, mechId);
  if (!mech) return false;
  if (job === 'repair' && !hasResearch(state, 'repair_bay')) return false;
  if (job === 'mining' && !mechOperable(state, mech)) return false;
  mech.job = job;
  mech.returnJob = null;
  return true;
}

export function setMechZone(state: GameState, mechId: number, zone: ZoneId): boolean {
  const mech = mechById(state, mechId);
  if (!mech || !zoneUnlocked(state, zone)) return false;
  mech.zone = zone;
  return true;
}

export function seatPilot(state: GameState, mechId: number, pilotId: number | null): boolean {
  const mech = mechById(state, mechId);
  if (!mech) return false;
  if (pilotId === null) {
    mech.pilotId = null;
    return true;
  }
  const p = pilotById(state, pilotId);
  if (!p || isInjured(p)) return false;
  unassign(state, p);
  mech.pilotId = p.id;
  return true;
}

export function buyPart(state: GameState, partId: string): boolean {
  const part = partDef(partId);
  if (part.research && !hasResearch(state, part.research)) return false;
  if (state.credits < part.cost) return false;
  state.credits -= part.cost;
  state.parts[partId] = (state.parts[partId] ?? 0) + 1;
  return true;
}

/** Equips a part from storage (or clears the slot with null). The old part returns to storage. */
export function equipPart(state: GameState, mechId: number, slot: SlotId, partId: string | null): boolean {
  const mech = mechById(state, mechId);
  if (!mech) return false;
  if (partId) {
    if (partDef(partId).slot !== slot || (state.parts[partId] ?? 0) <= 0) return false;
    state.parts[partId]--;
  }
  const old = mech.parts[slot];
  if (old) state.parts[old] = (state.parts[old] ?? 0) + 1;
  if (partId) mech.parts[slot] = partId;
  else delete mech.parts[slot];
  // Keep armor within the new maximum; a brand-new plate arrives intact only up to current wear.
  const max = mechStats(state, mech).armor;
  mech.armor = Math.min(mech.armor, max);
  if (mechStats(state, mech).overloaded && mech.job === 'mining') mech.job = 'idle';
  return true;
}

// ---------------------------------------------------------------- techniques

export function techniqueName(state: GameState, mech: MechState): string {
  const p = mechPilot(state, mech);
  const story = p?.story ? STORY_PILOTS[p.story]?.moves?.[mech.frame] : undefined;
  if (story) return story;
  return `${p?.callsign ?? 'Auto'} ${frameDef(mech.frame).move}`;
}

export function techniqueReady(state: GameState, mech: MechState): boolean {
  const p = mechPilot(state, mech);
  return !!p && syncLevel(p, mech.frame) >= 5 && mech.cooldown <= 0 && mech.job === 'mining' && mechOperable(state, mech);
}

export function useTechnique(state: GameState, mechId: number): boolean {
  const mech = mechById(state, mechId);
  if (!mech || !techniqueReady(state, mech)) return false;
  mech.boostRemaining = MECH.techniqueSec;
  mech.cooldown = MECH.techniqueCooldownSec;
  return true;
}

// ---------------------------------------------------------------- repair

export function repairRate(state: GameState, mech: MechState): number {
  const max = mechStats(state, mech).armor;
  return ((max * MECH.repairPerMin) / 60) * (1 + postBonus(state, 'repair'));
}

/** Pays for `points` of armor if possible; returns how many were affordable. */
function payForRepair(state: GameState, points: number): number {
  const byCredits = state.credits / MECH.repairCreditsPerPoint;
  const oreAvail = MECH.repairOres.reduce((s, o) => s + state.cargo[o], 0) / MECH.repairOrePerPoint;
  const n = Math.max(0, Math.min(points, byCredits, oreAvail));
  if (n <= 0) return 0;
  state.credits -= n * MECH.repairCreditsPerPoint;
  let oreNeeded = n * MECH.repairOrePerPoint;
  for (const o of MECH.repairOres) {
    const take = Math.min(oreNeeded, state.cargo[o]);
    state.cargo[o] -= take;
    oreNeeded -= take;
  }
  return n;
}

export function repairCostPerPoint(): { credits: number; ore: number } {
  return { credits: MECH.repairCreditsPerPoint, ore: MECH.repairOrePerPoint };
}

// ---------------------------------------------------------------- time

/** Mech wear, repairs, sync, technique timers and auto-repair. Returns ore mined by mechs. */
export function advanceFleet(state: GameState, dt: number, efficiency: number, events: TickEvents): OreAmounts {
  const mined = emptyOre();
  const autoRepair = hasResearch(state, 'auto_repair') && hasResearch(state, 'repair_bay');

  for (const mech of state.mechs) {
    if (mech.cooldown > 0) mech.cooldown = Math.max(0, mech.cooldown - dt);
    if (mech.boostRemaining > 0) mech.boostRemaining = Math.max(0, mech.boostRemaining - dt);
    const stats = mechStats(state, mech);
    const max = stats.armor;

    if (mech.job === 'mining' && mechOperable(state, mech)) {
      const r = mechOreRate(state, mech, efficiency);
      for (const k of Object.keys(mined) as (keyof OreAmounts)[]) mined[k] += r[k] * dt;

      // Wear, softened by Engineering and Grease Monkey, never below the floor.
      const pilot = mechPilot(state, mech);
      let wear = ((max * MECH.wearPerMin) / 60) * dt;
      if (mech.frame === 'bulwark') wear *= 0.6;
      if (pilot) {
        wear *= 1 - Math.min(0.5, pilotStats(pilot).engineering * 0.01);
        if (hasTrait(pilot, 'grease_monkey')) wear *= 0.75;
        if (hasTrait(pilot, 'hot_blooded')) wear *= 1.2;
        const before = syncLevel(pilot, mech.frame);
        pilot.sync[mech.frame] += dt;
        const after = syncLevel(pilot, mech.frame);
        if (after > before) events.syncUps.push({ pilotId: pilot.id, frame: mech.frame, level: after });
      }
      mech.armor = Math.max(Math.min(mech.armor, max * MECH.wearFloor), mech.armor - wear);

      if (autoRepair && mech.armor / max < MECH.autoRepairBelow) {
        mech.job = 'repair';
        mech.returnJob = 'mining';
        events.autoRepairs.push(mech.id);
      }
    } else if (mech.job === 'repair' && hasResearch(state, 'repair_bay')) {
      const want = Math.min(max - mech.armor, repairRate(state, mech) * dt);
      mech.armor += payForRepair(state, want);
      if (mech.armor >= max - 1e-6) {
        mech.armor = max;
        mech.job = mech.returnJob ?? 'idle';
        mech.returnJob = null;
      }
    }
  }
  state.stats.mechOre += Object.values(mined).reduce((a, b) => a + b, 0);
  return mined;
}

