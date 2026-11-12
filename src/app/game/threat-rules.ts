/**
 * Threats: hazard and market events, Pirate Heat, raids resolved as automatic
 * sorties, rogue asteroids, drone wrecks and the Vermilion Jackal.
 */
import { choice, medalMult } from './story-rules';
import { CONFIG, ORE_IDS, OreId, oreDef } from './config';
import { sectorMods, sectorZones } from './sector-rules';
import { emptyOre, hasResearch, oreReachable, researchLevel, splitByZone, currentZone } from './common';
import { hasTrait, pilotById, pilotStats, postBonus, syncLevel } from './crew-rules';
import { DRONE_IDS, DroneType, MECH, PARTS } from './fleet-data';
import { droneCostOf, droneMultiplier, firmwareBonus, mechCondition, mechOperable, mechPilot, mechStats, techniqueName } from './fleet-rules';
import { Rng } from './rng';
import {
  CAPTAINS,
  CaptainId,
  DEFAULT_ORDERS,
  ENEMY_UNITS,
  EventKind,
  JACKAL,
  JackalMood,
  StandingOrders,
  captainDef,
  THREAT,
  eventDef,
  EVENTS,
} from './threat-data';
import { ActiveEvent, GameState, MechState, SortieReport, SortieRound, ThreatState, TickEvents } from './types';
// Engine helpers (cyclic import, only used at call time).
import { addToCargo, baseDrillPower, cargoUsed, drillPower, orePrice } from './engine';
import { deterrentActive, escortStrength, onEscortResult, raidMult, squadBondEffects } from './trade-rules';
import { depthRaidMult } from './fold-rules';

/** Limits on losses while the player is away. */
export interface LossContext {
  offline: boolean;
  droneBudget: number;
  cargoBudget: number;
}

export const ONLINE: LossContext = { offline: false, droneBudget: Infinity, cargoBudget: Infinity };

export function emptyThreats(): ThreatState {
  return {
    events: [],
    nextIn: THREAT.intervalMin,
    clock: 0,
    heat: 0,
    orders: { ...DEFAULT_ORDERS },
    log: [],
    raids: 0,
    raidsWon: 0,
    raidsLost: 0,
    winsSinceBase: 0,
    baseFound: false,
    strikesWon: 0,
    jackalEncounters: 0,
    jackalDefeats: 0,
    raidsSinceJackal: 0,
    captainRaids: 0,
    raidsSinceCaptain: 0,
    captains: {},
    lastSortie: null,
    salvageAcc: 0,
    nextEventId: 1,
  };
}

// ---------------------------------------------------------------- queries

export function inGrace(state: GameState): boolean {
  return state.threats.clock < THREAT.graceSec;
}

export function activeEvent(state: GameState, kind: EventKind): ActiveEvent | undefined {
  return state.threats.events.find((e) => e.kind === kind);
}

function isActive(state: GameState, kind: EventKind): ActiveEvent | undefined {
  return state.threats.events.find((e) => e.kind === kind && e.phase === 'active');
}

/** Production multipliers from active hazards. */
export function productionMult(state: GameState): { drones: number; all: number } {
  const flare = isActive(state, 'flare');
  const drones = flare && flare.response !== 'ride' ? 0 : 1;
  const all = isActive(state, 'reactor') ? THREAT.reactor.output : 1;
  return { drones, all };
}

/** Booms and crashes. */
export function eventPriceMult(state: GameState, ore: OreId): number {
  let m = 1;
  for (const e of state.threats.events) {
    if (e.phase !== 'active' || e.ore !== ore) continue;
    if (e.kind === 'boom') m *= THREAT.market.boom;
    if (e.kind === 'crash') m *= THREAT.market.crash;
  }
  return m;
}

export function marketBlocked(state: GameState): boolean {
  return !!isActive(state, 'blackout');
}

export function heatPerSec(state: GameState): number {
  const h = THREAT.heat;
  const wealth = Math.min(1, Math.log10(1 + state.stats.creditsEarned) / 8);
  return ((h.basePerMin + h.wealthPerMin * wealth) / 60) * (choice(state) === 'break' ? 0.5 : 1);
}

function zoneIndex(state: GameState): number {
  return Math.max(0, sectorZones(state).findIndex((z) => z.id === state.zone));
}

/** How hard a raid hits right now (before Jackal and strike multipliers). */
export function raidStrength(state: GameState): number {
  const r = THREAT.raid;
  const heat = 1 + state.threats.heat / r.heatScale;
  const zone = 1 + zoneIndex(state) * r.zoneScale;
  const wealth = 1 + Math.log10(1 + state.stats.creditsEarned / r.wealthUnit);
  return r.baseStrength * heat * zone * wealth * raidMult(state) * depthRaidMult(state);
}

export function jackalStrengthMult(state: GameState): number {
  const base = THREAT.jackal.strengthMult + THREAT.jackal.perEncounter * state.threats.jackalEncounters;
  return base * (choice(state) === 'master' ? 1.5 : 1);
}

// ---------------------------------------------------------------- pirate captains

/** Who leads the next raid: the Jackal, a rival captain, or nobody (plain raiders). */
export function nextCaptain(state: GameState, rng: Rng): 'jackal' | CaptainId | null {
  const t = state.threats;
  const c = THREAT.captain;
  const jackalOut = choice(state) !== 'break' && state.fold.jumps >= 1;
  // Her entrance: the first raid after the first Fold Jump, no matter what.
  if (jackalOut && t.jackalEncounters === 0) return 'jackal';
  const due =
    t.raids + 1 === c.firstRaid ||
    (t.raids >= c.firstRaid && t.heat >= c.minHeat && (t.raidsSinceCaptain ?? 0) >= c.everyRaids && rng.next() < c.chance);
  if (!due) return null;
  if (jackalOut && (t.captainRaids ?? 0) % c.lieutenantEvery !== c.lieutenantEvery - 1) return 'jackal';
  // Rivals take turns, least-met first.
  const met = (id: CaptainId) => t.captains?.[id] ?? 0;
  return [...CAPTAINS].sort((a, b) => met(a.id) - met(b.id))[0].id;
}

/** Display name of whoever leads a raid or sortie. */
export function enemyName(opts: { jackal?: boolean; captain?: CaptainId; strike?: boolean; corporate?: boolean }): string {
  if (opts.jackal) return `${JACKAL.name} and raiders`;
  if (opts.captain) return `${captainDef(opts.captain).name} and raiders`;
  if (opts.corporate) return 'Meridian Security';
  return opts.strike ? 'Pirate base' : 'Pirate raiders';
}

/** Where the Jackal is in the story, which sets what she says. */
export function jackalMood(state: GameState): JackalMood {
  if (choice(state) === 'master') return 'bitter';
  const watched = state.story?.watched ?? 0;
  if (watched >= JACKAL.offerEpisode) return 'offer';
  if (watched >= JACKAL.revealEpisode) return 'revealed';
  return 'pirate';
}

// ---------------------------------------------------------------- combat power

export function guardianPower(state: GameState): number {
  return THREAT.guardian.power * droneMultiplier(state.drones.guardian) * firmwareBonus(state);
}

/** Hit points of one Guardian: they toughen up at the same milestones that double their guns. */
export function guardianHp(state: GameState): number {
  return THREAT.guardian.hp * droneMultiplier(state.drones.guardian);
}

/** A mech's damage per sortie round at full armor. */
export function mechCombatPower(state: GameState, mech: MechState): number {
  const st = mechStats(state, mech);
  const w = THREAT.mech;
  let power = st.combat * w.combatWeight + st.speed * w.speedWeight + st.sensors * w.sensorWeight;
  const p = mechPilot(state, mech);
  if (p) {
    const ps = pilotStats(p);
    power *= 1 + ps.piloting * w.pilotPilotingBonus + (p.level - 1) * w.pilotLevelBonus + syncLevel(p, mech.frame) * w.syncBonus;
    if (hasTrait(p, 'hot_blooded')) power *= 1.2;
    if (hasTrait(p, 'grudge')) power *= 1.5;
  } else {
    power *= MECH.autopilot;
  }
  return power;
}

/** Mechs that can fight: working, not critical, not in repair. */
export function canFight(state: GameState, mech: MechState): boolean {
  if (!mechOperable(state, mech) || mech.job === 'repair') return false;
  const c = mechCondition(state, mech).id;
  return c === 'operational' || c === 'damaged';
}

/** Mechs a raid defense uses under the standing order. */
export function defenders(state: GameState, includeMiners: boolean): MechState[] {
  return state.mechs.filter((m) => canFight(state, m) && (m.job === 'defense' || (includeMiners && m.job === 'mining')));
}

export function defensePower(state: GameState, mechs: MechState[], useGuardians: boolean): number {
  return mechs.reduce((s, m) => s + mechCombatPower(state, m), 0) + (useGuardians ? state.drones.guardian * guardianPower(state) : 0);
}

/** The real shape of a raid fight, for the Defense screen. */
export function raidMatchup(state: GameState, mechs: MechState[], guardians: number, strength: number) {
  const r = THREAT.raid;
  const enemyHp = strength * r.hpPerStrength;
  const fullPower = defensePower(state, mechs, false) + guardians * guardianPower(state);
  // Damage per round right now, with worn mechs fighting below full power.
  const power =
    mechs.reduce((sum, m) => sum + mechCombatPower(state, m) * mechConditionMult(m.armor / Math.max(1, mechStats(state, m).armor)), 0) +
    guardians * guardianPower(state);
  const armor = mechs.reduce((sum, m) => sum + m.armor, 0);
  const maxArmor = mechs.reduce((sum, m) => sum + mechStats(state, m).armor, 0);
  const guardianHpTotal = guardians * guardianHp(state);
  const rounds = power > 0 ? Math.ceil(enemyHp / power) : Infinity;
  // Fire you'd take before they break, if your damage held steady.
  let incoming = 0;
  for (let i = 1; i < Math.min(rounds, r.rounds + 1); i++) incoming += strength * Math.sqrt(Math.max(0, 1 - (power * i) / enemyHp));
  if (rounds > r.rounds) incoming = Infinity;
  // What you can take before the line breaks: Guardians soak part of the fire while mechs stand, all of it alone.
  const a = THREAT.guardian.absorb;
  const soak = mechs.length ? armor + Math.min(guardianHpTotal, (armor * a) / (1 - a)) : guardianHpTotal;
  return { enemyHp, enemyHit: strength, power, fullPower, armor, maxArmor, guardianHp: guardianHpTotal, rounds, incoming, soak, maxRounds: r.rounds };
}

// ---------------------------------------------------------------- sortie simulation

interface Fighter {
  mech: MechState;
  power: number;
  hp: number;
  max: number;
  weight: number;
  disabled: boolean;
  name: string;
}

interface SimResult {
  outcome: 'victory' | 'costly' | 'defeat';
  rounds: SortieRound[];
  fighters: Fighter[];
  guardiansLost: number;
  techniques: { mechId: number; pilotId: number; name: string }[];
  lucky: boolean;
}

function unitsFor(strength: number, jackal: boolean, captain?: CaptainId): { name: string; count: number }[] {
  let left = strength;
  const out: { name: string; count: number }[] = [];
  if (jackal) {
    out.push({ name: ENEMY_UNITS.jackal.name, count: 1 });
    left -= strength * 0.4;
  }
  if (captain) {
    out.push({ name: captainDef(captain).ship, count: 1 });
    left -= strength * 0.3;
  }
  const frames = Math.floor(left / 40);
  if (frames) out.push({ name: ENEMY_UNITS.rogue_frame.name, count: frames });
  left -= frames * 40 * 0.6;
  const boats = Math.floor(left / 12);
  if (boats) out.push({ name: ENEMY_UNITS.gunboat.name, count: boats });
  left -= boats * 12 * 0.6;
  out.push({ name: ENEMY_UNITS.skiff.name, count: Math.max(2, Math.round(left / 3)) });
  return out;
}

function simulate(
  state: GameState,
  mechs: MechState[],
  guardians: number,
  strength: number,
  rng: Rng,
  withLines: boolean,
): SimResult {
  const r = THREAT.raid;
  const g = THREAT.guardian;
  const enemyMax = strength * r.hpPerStrength;
  let enemyHp = enemyMax;
  const pilots = mechs.map((m) => mechPilot(state, m)).filter((p) => !!p);
  const reckless = pilots.some((p) => hasTrait(p!, 'reckless'));
  const luckyCount = pilots.filter((p) => hasTrait(p!, 'lucky')).length;
  const traitTaken = (reckless ? 1.15 : 1) * (pilots.some((p) => hasTrait(p!, 'hot_blooded')) ? 1.1 : 1);

  const bonds = squadBondEffects(
    state,
    mechs.map((m) => m.pilotId).filter((x): x is number => x !== null),
  );
  const bondTaken = bonds.damageTaken;
  const fighters: Fighter[] = mechs.map((m) => {
    const max = mechStats(state, m).armor;
    return {
      mech: m,
      power: mechCombatPower(state, m) * (m.pilotId !== null ? (bonds.powerMult.get(m.pilotId) ?? 1) : 1),
      hp: m.armor,
      max,
      weight: m.frame === 'bulwark' ? THREAT.mech.bulwarkTaunt : 1,
      disabled: false,
      name: m.designation,
    };
  });
  const gUnitHp = guardianHp(state);
  let gHp = guardians * gUnitHp;
  const gPower = guardianPower(state);
  const rounds: SortieRound[] = [];
  const techniques: SimResult['techniques'] = [];
  let won = false;
  const takenMult = traitTaken * bondTaken;

  for (let i = 0; i < r.rounds; i++) {
    const lines: string[] = [];
    if (i === 0 && withLines) lines.push(...bonds.lines);
    const gAlive = Math.ceil(gHp / gUnitHp - 1e-9);
    let dmg = 0;
    let technique: SortieRound['technique'];
    for (const f of fighters) {
      if (f.disabled) continue;
      let p = f.power * mechConditionMult(f.hp / f.max);
      const pilot = mechPilot(state, f.mech);
      // A Sync-5 pilot unleashes their technique once, from round 2.
      if (!technique && i >= 1 && pilot && syncLevel(pilot, f.mech.frame) >= 5 && f.mech.cooldown <= 0 && !techniques.some((t) => t.mechId === f.mech.id)) {
        p *= 2;
        const name = techniqueName(state, f.mech);
        technique = { pilotId: pilot.id, name };
        techniques.push({ mechId: f.mech.id, pilotId: pilot.id, name });
        if (withLines) lines.push(`★ ${pilot.callsign}: "${name}!"`);
      }
      dmg += p;
    }
    dmg += gAlive * gPower;
    dmg *= rng.range(0.85, 1.15);
    enemyHp -= dmg;
    if (withLines) {
      const who = fighters.filter((f) => !f.disabled).map((f) => f.name);
      if (gAlive) who.push(`${gAlive} Guardian${gAlive > 1 ? 's' : ''}`);
      lines.push(`${who.join(', ') || 'Nothing'} open fire — ${Math.round(dmg)} damage.`);
    }
    if (enemyHp <= 0) {
      if (withLines) lines.push('Enemy formation broken! They\'re running!');
      rounds.push({ playerDamage: dmg, enemyDamage: 0, enemyHpFrac: 0, lines, technique });
      won = true;
      break;
    }

    // Enemy fire: Guardians soak the first share, the rest hits mechs (Bulwarks draw fire).
    let incoming = strength * Math.sqrt(enemyHp / enemyMax) * rng.range(0.85, 1.15) * takenMult;
    const enemyDamage = incoming;
    const alive = fighters.filter((f) => !f.disabled);
    if (gHp > 0) {
      const soak = Math.min(gHp, alive.length ? incoming * g.absorb : incoming);
      gHp -= soak;
      incoming -= soak;
    }
    const totalW = alive.reduce((s, f) => s + f.weight, 0);
    for (const f of alive) {
      f.hp -= (incoming * f.weight) / totalW;
      if (f.hp <= 0) {
        f.hp = 0;
        f.disabled = true;
        if (withLines) lines.push(`⚠ ${f.name} is hit hard — DISABLED!`);
      }
    }
    if (withLines) lines.push(`Pirates return fire — ${Math.round(enemyDamage)} damage.`);
    rounds.push({ playerDamage: dmg, enemyDamage, enemyHpFrac: Math.max(0, enemyHp / enemyMax), lines, technique });
    if (fighters.every((f) => f.disabled) && gHp <= 0) break;
  }

  let lucky = false;
  if (!won && luckyCount > 0 && rng.next() < 0.15 * luckyCount) {
    won = true;
    lucky = true;
    if (withLines) rounds[rounds.length - 1]?.lines.push('A lucky shot hits their reactor — the pirates break off!');
  }
  const guardiansLost = guardians - Math.ceil(Math.max(0, gHp) / gUnitHp - 1e-9);
  const costly = won && (lucky || fighters.some((f) => f.disabled) || guardiansLost > guardians * 0.3);
  return { outcome: won ? (costly ? 'costly' : 'victory') : 'defeat', rounds, fighters, guardiansLost, techniques, lucky };
}

function mechConditionMult(frac: number): number {
  if (frac >= 0.5) return 1;
  if (frac >= 0.25) return 0.75;
  return frac > 0 ? 0.5 : 0;
}

/** Odds of winning a sortie, estimated by simulation without touching the game. */
export function riskPreview(state: GameState, mechs: MechState[], guardians: number, strength: number) {
  const rng = new Rng((state.rng ^ 0x9e3779b9) >>> 0);
  const n = 120;
  let wins = 0;
  let costly = 0;
  let disabled = 0;
  for (let i = 0; i < n; i++) {
    const res = simulate(state, mechs, guardians, strength, rng, false);
    if (res.outcome !== 'defeat') wins++;
    if (res.outcome === 'costly') costly++;
    disabled += res.fighters.filter((f) => f.disabled).length;
  }
  return { win: wins / n, costly: costly / n, avgDisabled: disabled / n };
}

// ---------------------------------------------------------------- losses

function removeDrones(state: GameState, frac: number, ctx: LossContext, types: DroneType[] = [...DRONE_IDS]): number {
  let total = 0;
  for (const t of types) {
    let n = Math.floor(state.drones[t] * frac);
    n = Math.min(n, Math.floor(ctx.droneBudget - total));
    if (n <= 0) continue;
    state.drones[t] -= n;
    state.wrecks[t] += n;
    total += n;
  }
  ctx.droneBudget -= total;
  return total;
}

function removeCargo(state: GameState, frac: number, ctx: LossContext): number {
  let want = 0;
  for (const id of ORE_IDS) want += (state.cargo[id] + state.ingots[id]) * frac;
  const scale = want > ctx.cargoBudget ? Math.max(0, ctx.cargoBudget) / want : 1;
  let lost = 0;
  for (const id of ORE_IDS) {
    const a = state.cargo[id] * frac * scale;
    const b = state.ingots[id] * frac * scale;
    state.cargo[id] -= a;
    state.ingots[id] -= b;
    lost += a + b;
  }
  ctx.cargoBudget -= lost;
  return lost;
}

export function injurePilot(state: GameState, pilotId: number | null): void {
  const p = pilotById(state, pilotId);
  if (!p) return;
  const nerve = pilotStats(p).nerve;
  p.injuredRemaining = THREAT.injurySec * (1 - Math.min(0.5, nerve * 0.01));
}

export function injuryRecoveryMult(state: GameState): number {
  return 1 + researchLevel(state, 'medbay') * THREAT.medbayPerLevel;
}

/** Knocks off a share of a mech's armor; at zero it's disabled (pilot hurt, auto-repair takes over). */
export function damageMech(state: GameState, mech: MechState, frac: number): boolean {
  const max = mechStats(state, mech).armor;
  mech.armor = Math.max(0, mech.armor - max * frac);
  if (mech.armor <= 0) {
    disableMech(state, mech);
    return true;
  }
  return false;
}

function disableMech(state: GameState, mech: MechState): void {
  mech.armor = 0;
  injurePilot(state, mech.pilotId);
  const auto = hasResearch(state, 'auto_repair') && hasResearch(state, 'repair_bay');
  mech.returnJob = auto ? (mech.job === 'repair' ? mech.returnJob : mech.job) : null;
  mech.job = auto ? 'repair' : 'idle';
}

// ---------------------------------------------------------------- log

function log(state: GameState, kind: EventKind | 'strike', text: string, good: boolean, events: TickEvents, sortie?: SortieReport): void {
  const t = state.threats;
  t.log.unshift({ at: t.clock, kind, text, good });
  t.log = t.log.slice(0, THREAT.logSize);
  events.threatResolved.push({ kind: kind === 'strike' ? 'raid' : kind, text, good, sortie });
}

// ---------------------------------------------------------------- sorties

function runSortie(
  state: GameState,
  opts: { mechs: MechState[]; guardians: number; strength: number; jackal: boolean; captain?: CaptainId; strike: boolean; title: string },
  events: TickEvents,
  ctx: LossContext,
): SortieReport {
  const t = state.threats;
  const rng = new Rng(state.rng);
  const res = simulate(state, opts.mechs, opts.guardians, opts.strength, rng, true);
  state.rng = rng.state;

  // Apply damage, disables, guardian losses, technique cooldowns, XP and sync.
  const losses: string[] = [];
  const rewards: string[] = [];
  for (const f of res.fighters) {
    f.mech.armor = Math.max(0, Math.min(f.max, f.hp));
    if (f.disabled) {
      const p = pilotById(state, f.mech.pilotId);
      disableMech(state, f.mech);
      losses.push(`${f.mech.designation} disabled${p ? ` — ${p.name} injured` : ''}`);
    }
    const p = pilotById(state, f.mech.pilotId);
    if (p && !f.disabled) {
      const bonus = squadBondEffects(state, opts.mechs.map((m) => m.pilotId).filter((x): x is number => x !== null)).xpMult.get(p.id) ?? 1;
      p.xp += (THREAT.raid.xpBase + THREAT.raid.xpPerRound * res.rounds.length) * bonus * medalMult(state, 'xp');
      p.sync[f.mech.frame] += THREAT.raid.syncSec;
    }
  }
  for (const tq of res.techniques) {
    const m = state.mechs.find((x) => x.id === tq.mechId);
    if (m) m.cooldown = MECH.techniqueCooldownSec;
  }
  if (res.guardiansLost > 0) {
    state.drones.guardian -= res.guardiansLost;
    state.wrecks.guardian += res.guardiansLost;
    losses.push(`${res.guardiansLost} Guardian drone${res.guardiansLost > 1 ? 's' : ''} destroyed (wrecks recoverable)`);
  }

  const reckless = opts.mechs.some((m) => {
    const p = mechPilot(state, m);
    return p && hasTrait(p, 'reckless');
  });

  if (res.outcome !== 'defeat') {
    const r = THREAT.raid;
    let bounty = opts.strength * r.bountyPerStrength * (1 + Math.log10(1 + state.stats.creditsEarned / 1e4));
    if (opts.jackal) bounty *= THREAT.jackal.bountyMult;
    if (opts.captain) bounty *= captainDef(opts.captain).bountyMult;
    if (opts.strike) bounty *= THREAT.strike.bountyMult;
    if (reckless) bounty *= 1.3;
    state.credits += bounty;
    state.stats.creditsEarned += bounty;
    rewards.push(`${Math.round(bounty).toLocaleString()} cr bounty`);
    const rng2 = new Rng(state.rng);
    if (rng2.next() < r.dataCoreChance || opts.strike) {
      state.dataCores++;
      rewards.push('1 Data Core salvaged');
    }
    if ((opts.jackal && rng2.next() < THREAT.jackal.partChance) || opts.strike) {
      const part = uniquePartFor(state);
      if (part) {
        state.parts[part.id] = (state.parts[part.id] ?? 0) + 1;
        rewards.push(`Unique part recovered: ${part.name}`);
      }
    }
    state.rng = rng2.state;
    t.heat = opts.strike ? 0 : Math.max(0, t.heat - THREAT.heat.victoryDrop);
    rewards.push(opts.strike ? 'Pirate Heat reset to zero' : `Pirate Heat −${THREAT.heat.victoryDrop}`);
  } else {
    const cargo = removeCargo(state, THREAT.raid.defeatCargo, ctx);
    const drones = removeDrones(state, THREAT.raid.defeatDrones, ctx, ['prospector', 'cutter', 'hauler', 'surveyor', 'salvager']);
    if (cargo > 0) losses.push(`${Math.round(cargo).toLocaleString()} t of cargo stolen`);
    if (drones > 0) losses.push(`${drones} drones lost (wrecks recoverable)`);
    t.heat = Math.max(0, t.heat - THREAT.heat.defeatDrop);
  }

  const report: SortieReport = {
    id: t.nextEventId++,
    title: opts.title,
    enemy: enemyName(opts),
    units: unitsFor(opts.strength, opts.jackal, opts.captain),
    jackal: opts.jackal,
    ...(opts.captain ? { captain: opts.captain } : {}),
    strike: opts.strike,
    mechIds: opts.mechs.map((m) => m.id),
    guardians: opts.guardians,
    rounds: res.rounds,
    outcome: res.outcome,
    rewards,
    losses,
  };
  t.lastSortie = report;
  return report;
}

function uniquePartFor(state: GameState) {
  const uniques = PARTS.filter((p) => p.rarity === 'unique');
  const missing = uniques.filter((p) => !(state.parts[p.id] > 0) && !state.mechs.some((m) => Object.values(m.parts).includes(p.id)));
  return missing[0] ?? null;
}

function resolveRaid(state: GameState, ev: ActiveEvent, events: TickEvents, ctx: LossContext, manualMechs?: MechState[], useGuardians = true): SortieReport {
  const t = state.threats;
  t.raids++;
  t.raidsSinceJackal++;
  t.raidsSinceCaptain = (t.raidsSinceCaptain ?? 0) + 1;
  const order = t.orders.raid;
  const mechs = manualMechs ?? (order === 'surrender' ? [] : defenders(state, order === 'defend_all'));
  const guardians = order === 'surrender' && !manualMechs ? 0 : useGuardians ? state.drones.guardian : 0;
  const strength = ev.strength ?? raidStrength(state);

  if (ev.jackal) {
    t.jackalEncounters++;
    t.raidsSinceJackal = 0;
  }
  if (ev.jackal || ev.captain) {
    t.captainRaids = (t.captainRaids ?? 0) + 1;
    t.raidsSinceCaptain = 0;
  }
  if (ev.captain) {
    t.captains ??= {};
    t.captains[ev.captain] = (t.captains[ev.captain] ?? 0) + 1;
  }

  if (mechs.length === 0 && guardians === 0) {
    const lost = removeCargo(state, THREAT.raid.surrenderCargo, ctx);
    t.heat = Math.max(0, t.heat - THREAT.heat.surrenderDrop);
    t.raidsLost++;
    const report: SortieReport = {
      id: t.nextEventId++,
      title: 'Pirate Raid',
      enemy: enemyName(ev),
      units: unitsFor(strength, !!ev.jackal, ev.captain),
      jackal: !!ev.jackal,
      ...(ev.captain ? { captain: ev.captain } : {}),
      strike: false,
      mechIds: [],
      guardians: 0,
      rounds: [],
      outcome: 'surrender',
      rewards: [`Pirate Heat −${THREAT.heat.surrenderDrop}`],
      losses: [`${Math.round(lost).toLocaleString()} t of cargo handed over`],
    };
    t.lastSortie = report;
    log(state, 'raid', `Raid: cargo surrendered (${Math.round(lost).toLocaleString()} t).`, false, events, report);
    return report;
  }

  const report = runSortie(state, { mechs, guardians, strength, jackal: !!ev.jackal, captain: ev.captain, strike: false, title: 'Raid Defense' }, events, ctx);
  if (report.outcome === 'defeat') {
    t.raidsLost++;
    log(state, 'raid', `Raid: defense failed. ${report.losses.join('; ')}.`, false, events, report);
  } else {
    t.raidsWon++;
    t.winsSinceBase++;
    if (ev.jackal) t.jackalDefeats++;
    const need = t.strikesWon === 0 ? THREAT.strike.winsToFind : THREAT.strike.winsToRefind;
    if (!t.baseFound && t.winsSinceBase >= need) t.baseFound = true;
    log(state, 'raid', `Raid repelled${report.outcome === 'costly' ? ' (costly)' : ''}! ${report.rewards[0]}.`, true, events, report);
  }
  return report;
}

/** Player-launched defense during a raid warning. */
export function launchDefense(state: GameState, eventId: number, mechIds: number[], useGuardians: boolean, events: TickEvents): SortieReport | null {
  const ev = state.threats.events.find((e) => e.id === eventId && e.kind === 'raid');
  if (!ev) return null;
  const mechs = state.mechs.filter((m) => mechIds.includes(m.id) && canFight(state, m));
  if (!mechs.length && !(useGuardians && state.drones.guardian > 0)) return null;
  state.threats.events = state.threats.events.filter((e) => e !== ev);
  return resolveRaid(state, ev, events, ONLINE, mechs, useGuardians);
}

/** Hand over cargo straight away instead of fighting. */
export function surrenderRaid(state: GameState, eventId: number, events: TickEvents): SortieReport | null {
  const ev = state.threats.events.find((e) => e.id === eventId && e.kind === 'raid');
  if (!ev) return null;
  state.threats.events = state.threats.events.filter((e) => e !== ev);
  const saved = state.threats.orders.raid;
  state.threats.orders.raid = 'surrender';
  const r = resolveRaid(state, ev, events, ONLINE);
  state.threats.orders.raid = saved;
  return r;
}

export function strikeStrength(state: GameState): number {
  return raidStrength(state) * THREAT.strike.strengthMult;
}

export function launchStrike(state: GameState, mechIds: number[], useGuardians: boolean, events: TickEvents): SortieReport | null {
  const t = state.threats;
  if (!t.baseFound) return null;
  const mechs = state.mechs.filter((m) => mechIds.includes(m.id) && canFight(state, m));
  if (!mechs.length) return null;
  const rng = new Rng(state.rng);
  const jackal = t.jackalEncounters > 0 && rng.next() < THREAT.strike.jackalChance;
  state.rng = rng.state;
  const strength = strikeStrength(state) * (jackal ? jackalStrengthMult(state) : 1);
  if (jackal) t.jackalEncounters++;
  const report = runSortie(state, { mechs, guardians: useGuardians ? state.drones.guardian : 0, strength, jackal, strike: true, title: 'Strike on the Pirate Base' }, events, ONLINE);
  if (report.outcome !== 'defeat') {
    t.strikesWon++;
    t.baseFound = false;
    t.winsSinceBase = 0;
    if (jackal) t.jackalDefeats++;
    log(state, 'strike', `Pirate base destroyed! ${report.rewards.join('; ')}.`, true, events, report);
  } else {
    log(state, 'strike', `Strike failed. ${report.losses.join('; ') || 'The fleet fell back.'}`, false, events, report);
  }
  return report;
}

// ---------------------------------------------------------------- rogue asteroid

export interface RogueClick {
  locked: boolean;
  overheated: boolean;
  overdrive: boolean;
  damage: number;
  cracked: boolean;
}

/** Clicking the rogue asteroid uses the drill (and its heat) just like mining. */
export function rogueClick(state: GameState, events: TickEvents): RogueClick | null {
  const ev = state.threats.events.find((e) => e.kind === 'rogue' && e.phase === 'warning');
  if (!ev) return null;
  const h = CONFIG.heat;
  const drill = state.drill;
  const out: RogueClick = { locked: false, overheated: false, overdrive: false, damage: 0, cracked: false };
  if (drill.lockRemaining > 0) {
    out.locked = true;
    return out;
  }
  drill.heat += h.perClick;
  if (drill.heat >= h.max) {
    drill.heat = h.max;
    drill.lockRemaining = h.lockSec;
    out.overheated = true;
    return out;
  }
  out.overdrive = drill.heat <= h.overdriveMax;
  const mult = out.overdrive ? h.overdriveMult + researchLevel(state, 'overdrive_tuning') * CONFIG.bonuses.overdrivePerLevel : 1;
  out.damage = drillPower(state) * mult;
  ev.rogueHp = Math.max(0, (ev.rogueHp ?? 0) - out.damage);
  if (ev.rogueHp <= 0) {
    out.cracked = true;
    state.threats.events = state.threats.events.filter((e) => e !== ev);
    rogueReward(state, 1, events, 'Rogue asteroid cracked by hand');
  }
  return out;
}

function rogueReward(state: GameState, scale: number, events: TickEvents, what: string): void {
  const ore = emptyOre();
  splitByZone(state, currentZone(state), drillPower(state) * THREAT.rogue.rewardClicks * scale, ore);
  const { added } = addToCargo(state, ore);
  const total = Object.values(added).reduce((a, b) => a + b, 0);
  // Ore that doesn't fit in the hold is sold on the spot, so a full hold never wastes the reward.
  let overflow = 0;
  for (const id of ORE_IDS) overflow += Math.max(0, ore[id] - added[id]) * orePrice(state, id);
  if (overflow > 0) {
    state.credits += overflow;
    state.stats.creditsEarned += overflow;
  }
  const rng = new Rng(state.rng);
  const core = rng.next() < THREAT.rogue.dataCoreChance * scale;
  state.rng = rng.state;
  if (core) state.dataCores++;
  const parts = [];
  if (total >= 1) parts.push(`+${Math.round(total).toLocaleString()} t of ore`);
  if (overflow >= 1) parts.push(`+${Math.round(overflow).toLocaleString()} cr for ore the hold couldn't take`);
  if (core) parts.push('+1 Data Core');
  log(state, 'rogue', `${what}! ${parts.join(', ')}.`, true, events);
}

function rogueImpact(state: GameState, events: TickEvents, ctx: LossContext): void {
  const r = THREAT.rogue;
  const cargo = removeCargo(state, r.impactCargo, ctx);
  const drones = removeDrones(state, r.impactDrones, ctx);
  const hit: string[] = [];
  for (const m of state.mechs) {
    if (m.job === 'mining' && m.zone === state.zone && damageMech(state, m, r.impactMechDamage)) hit.push(m.designation);
  }
  log(
    state,
    'rogue',
    `Rogue asteroid impact! ${Math.round(cargo).toLocaleString()} t of cargo lost, ${drones} drones wrecked${hit.length ? `, ${hit.join(', ')} disabled` : ''}.`,
    false,
    events,
  );
}

function resolveRogue(state: GameState, ev: ActiveEvent, events: TickEvents, ctx: LossContext): void {
  if (state.threats.orders.rogue === 'intercept') {
    const ready = state.mechs.filter((m) => canFight(state, m) && m.job !== 'repair');
    if (ready.length) {
      const best = ready.reduce((a, b) => {
        const sa = mechStats(state, a);
        const sb = mechStats(state, b);
        return sa.mining + sa.combat >= sb.mining + sb.combat ? a : b;
      });
      const st = mechStats(state, best);
      const chance = Math.min(0.95, 0.4 + (st.mining + st.combat) / 80);
      const rng = new Rng(state.rng);
      const ok = rng.next() < chance;
      state.rng = rng.state;
      if (ok) {
        rogueReward(state, THREAT.rogue.interceptReward, events, `${best.designation} intercepted the rogue asteroid`);
        return;
      }
      damageMech(state, best, 0.25);
    }
  }
  rogueImpact(state, events, ctx);
}

// ---------------------------------------------------------------- events

function pickEvent(state: GameState, rng: Rng): EventKind | null {
  const t = state.threats;
  const options = EVENTS.filter((e) => {
    if (e.hostile && inGrace(state)) return false;
    if (e.kind === 'raid' && deterrentActive(state)) return false;
    if (t.events.some((x) => x.kind === e.kind)) return false;
    // Only one hostile event at a time.
    if (e.hostile && t.events.some((x) => eventDef(x.kind).hostile)) return false;
    return true;
  });
  if (!options.length) return null;
  const sectorWeights = sectorMods(state).eventWeights;
  const weight = (k: EventKind) => {
    const base = eventDef(k).weight * (sectorWeights[k] ?? 1);
    return k === 'raid' ? base * (1 + t.heat * THREAT.heat.raidWeightPerHeat) : base;
  };
  const total = options.reduce((s, e) => s + weight(e.kind), 0);
  let roll = rng.next() * total;
  for (const e of options) {
    roll -= weight(e.kind);
    if (roll <= 0) return e.kind;
  }
  return options[options.length - 1].kind;
}

export function startEvent(state: GameState, kind: EventKind, events: TickEvents, rng = new Rng(state.rng)): ActiveEvent {
  const t = state.threats;
  const def = eventDef(kind);
  const ev: ActiveEvent = { id: t.nextEventId++, kind, phase: def.warning > 0 ? 'warning' : 'active', remaining: def.warning || def.duration };
  if (kind === 'raid') {
    const lead = nextCaptain(state, rng);
    const jackal = lead === 'jackal';
    ev.jackal = jackal;
    if (lead && lead !== 'jackal') ev.captain = lead;
    ev.strength = raidStrength(state) * (jackal ? jackalStrengthMult(state) : ev.captain ? captainDef(ev.captain).strengthMult : 1);
    // Break the Cycle: Meridian sends its own security wings.
    if (!lead && choice(state) === 'break' && rng.next() < THREAT.corporateChance) {
      ev.corporate = true;
      ev.strength *= THREAT.corporateStrength;
    }
  }
  if (kind === 'rogue') {
    ev.rogueMax = baseDrillPower(state) * THREAT.rogue.clicks;
    ev.rogueHp = ev.rogueMax;
  }
  if (kind === 'boom' || kind === 'crash') {
    const ores = ORE_IDS.filter((o) => oreReachable(state, o));
    ev.ore = ores[Math.floor(rng.next() * ores.length)];
  }
  if (kind === 'reactor') ev.remaining = def.duration / (1 + postBonus(state, 'repair'));
  state.rng = rng.state;
  t.events.push(ev);
  events.threatStarted.push(ev);
  return ev;
}

/** Player's choice during a warning (overrides the standing order for this event). */
export function respondToEvent(state: GameState, eventId: number, response: string): boolean {
  const ev = state.threats.events.find((e) => e.id === eventId);
  if (!ev || ev.phase !== 'warning') return false;
  ev.response = response;
  return true;
}

export function setStandingOrder<K extends keyof StandingOrders>(state: GameState, key: K, value: StandingOrders[K]): void {
  state.threats.orders[key] = value;
}

function onWarningEnd(state: GameState, ev: ActiveEvent, events: TickEvents, ctx: LossContext): boolean {
  switch (ev.kind) {
    case 'raid': {
      if (ev.response === 'surrender') {
        const saved = state.threats.orders.raid;
        state.threats.orders.raid = 'surrender';
        resolveRaid(state, ev, events, ctx);
        state.threats.orders.raid = saved;
      } else {
        resolveRaid(state, ev, events, ctx);
      }
      return false;
    }
    case 'flare': {
      const response = ev.response ?? state.threats.orders.flare;
      ev.response = response;
      if (response === 'ride') {
        const lost = removeDrones(state, THREAT.flare.rideLoss, ctx, ['prospector', 'cutter', 'hauler', 'surveyor', 'salvager']);
        for (const m of state.mechs) if (m.job === 'mining') damageMech(state, m, THREAT.flare.mechDamage);
        log(state, 'flare', `Rode out the solar flare: ${lost} drones lost (wrecks recoverable).`, false, events);
      } else {
        log(state, 'flare', 'Drones sheltered from the solar flare — mining paused until it passes.', true, events);
      }
      ev.phase = 'active';
      ev.remaining = eventDef('flare').duration;
      return true;
    }
    case 'rogue':
      resolveRogue(state, ev, events, ctx);
      return false;
    default:
      ev.phase = 'active';
      ev.remaining = eventDef(ev.kind).duration;
      return true;
  }
}

/** Events, Heat, hazards and wrecks over time. */
export function advanceThreats(state: GameState, dt: number, events: TickEvents, ctx: LossContext = ONLINE): void {
  const t = state.threats;
  t.clock += dt;
  t.heat = Math.min(THREAT.heat.max, t.heat + heatPerSec(state) * dt);

  // Roll the next event.
  t.nextIn -= dt;
  if (t.nextIn <= 0) {
    const rng = new Rng(state.rng);
    const kind = pickEvent(state, rng);
    t.nextIn = rng.range(THREAT.intervalMin, THREAT.intervalMax) * sectorMods(state).eventInterval;
    state.rng = rng.state;
    if (kind) startEvent(state, kind, events);
  }

  // Count down warnings and effects.
  for (const ev of [...t.events]) {
    ev.remaining -= dt;
    if (ev.phase === 'active' && ev.kind === 'micrometeor') {
      const shield = Math.min(THREAT.micrometeor.shieldCap, state.drones.guardian * THREAT.micrometeor.shieldPerGuardian);
      const types: DroneType[] = ['prospector', 'cutter', 'hauler', 'surveyor', 'salvager'];
      const pool = types.reduce((s, k) => s + state.drones[k], 0);
      ev.acc = (ev.acc ?? 0) + pool * THREAT.micrometeor.lossPerSec * (1 - shield) * dt;
      while (ev.acc >= 1 && ctx.droneBudget >= 1) {
        // Lose one drone from the biggest group.
        const k = types.reduce((a, b) => (state.drones[a] >= state.drones[b] ? a : b));
        if (state.drones[k] <= 0) break;
        state.drones[k]--;
        state.wrecks[k]++;
        ctx.droneBudget--;
        ev.acc -= 1;
      }
    }
    if (ev.remaining > 0) continue;
    if (ev.phase === 'warning') {
      if (!onWarningEnd(state, ev, events, ctx)) t.events = t.events.filter((e) => e !== ev);
    } else {
      t.events = t.events.filter((e) => e !== ev);
      if (ev.kind === 'micrometeor') log(state, 'micrometeor', 'Micrometeor storm passed.', true, events);
      if (ev.kind === 'reactor') log(state, 'reactor', 'Reactor repaired — full power restored.', true, events);
      if (ev.kind === 'blackout') log(state, 'blackout', 'Comms restored. Exchange back online.', true, events);
    }
  }

  // Wrecks drift away; Salvagers bring some home for free.
  const w = THREAT.wrecks;
  for (const id of DRONE_IDS) state.wrecks[id] = Math.max(0, state.wrecks[id] - state.wrecks[id] * (w.decayPerMin / 60) * dt);
  t.salvageAcc += state.drones.salvager * w.salvagerPerSec * dt;
  while (t.salvageAcc >= 1) {
    const k = DRONE_IDS.reduce((a, b) => (state.wrecks[a] >= state.wrecks[b] ? a : b));
    if (state.wrecks[k] < 1) {
      t.salvageAcc = 0;
      break;
    }
    state.wrecks[k]--;
    state.drones[k]++;
    t.salvageAcc -= 1;
  }
}

// ---------------------------------------------------------------- wrecks

export function wreckRebuildCost(state: GameState, type: DroneType): number {
  const frac = state.trade?.perks.includes('combine_overhaul') ? 0.1 : THREAT.wrecks.rebuildFrac;
  return droneCostOf(state, type, 1) * frac;
}

/** Escort a merchant convoy past the raiders shadowing it. */
export function launchEscort(state: GameState, mechIds: number[], useGuardians: boolean, events: TickEvents): SortieReport | null {
  const f = state.trade.fleet;
  if (!f || f.escortDone) return null;
  const mechs = state.mechs.filter((m) => mechIds.includes(m.id) && canFight(state, m));
  if (!mechs.length && !(useGuardians && state.drones.guardian > 0)) return null;
  const report = runSortie(
    state,
    { mechs, guardians: useGuardians ? state.drones.guardian : 0, strength: escortStrength(state), jackal: false, strike: false, title: 'Convoy Escort' },
    events,
    ONLINE,
  );
  report.enemy = 'Raiders shadowing the convoy';
  onEscortResult(state, report.outcome !== 'defeat', events);
  return report;
}

/** Rebuild as many whole wrecks of a type as credits allow. */
export function rebuildWrecks(state: GameState, type: DroneType): number {
  let n = 0;
  while (state.wrecks[type] >= 1) {
    const cost = wreckRebuildCost(state, type);
    if (state.credits < cost) break;
    state.credits -= cost;
    state.wrecks[type]--;
    state.drones[type]++;
    n++;
  }
  return n;
}

/** For the offline report and loss caps. */
export function offlineContext(state: GameState): LossContext {
  const drones = DRONE_IDS.reduce((s, id) => s + state.drones[id], 0);
  const cargo = cargoUsed(state);
  return {
    offline: true,
    droneBudget: Math.floor(drones * THREAT.offlineDroneLossCap),
    cargoBudget: cargo * THREAT.offlineCargoLossCap,
  };
}

export function oreName(ore: OreId): string {
  return oreDef(ore).name;
}

