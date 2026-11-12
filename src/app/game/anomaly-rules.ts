/**
 * Anomalies: detection, scanning, responses (missions, decoding, harvest
 * rigs), rewards, the Codex and the Silent Beacon lore.
 */
import { medalMult } from './story-rules';
import { CONFIG, ORE_IDS, zoneDef } from './config';
import { emptyOre, researchLevel, zoneUnlocked } from './common';
import { ANOMALIES, ANOMALY, AnomalyKind, Approach, CODEX_SETS, anomalyDef } from './anomaly-data';
import { generatePilot, hasTrait, pilotById, pilotStats, postBonus, rosterCap } from './crew-rules';
import { PARTS } from './fleet-data';
import { mechCondition, mechOperable, mechPilot, mechStats } from './fleet-rules';
import { Rng } from './rng';
import { sectorMods, sectorOf, sectorZones } from './sector-rules';
import { damageMech, startEvent } from './threat-rules';
import { rollBond } from './trade-rules';
import { AnomaliesState, AnomalyState, GameState, MechState, MissionState, TickEvents } from './types';
import { addToCargo, baseDrillPower, drillPower, droneRates, mechRateTotal, orePrice, overdriveMult } from './engine';

export function emptyAnomalies(): AnomaliesState {
  return { list: [], nextIn: ANOMALY.intervalMin, scan: null, missions: [], codex: {}, lore: 0, curios: [], nextId: 1, sectorKey: '' };
}

function sectorKey(state: GameState): string {
  return `${state.sector.seed}:${state.sector.depth}`;
}

/** Builds the fixed anomaly list for the current sector (once per sector). */
export function ensureAnomalies(state: GameState): void {
  const a = state.anomalies;
  const key = sectorKey(state);
  if (a.sectorKey === key) return;
  const def = sectorOf(state);
  a.list = def.fixed.map((f) => ({
    id: a.nextId++,
    kind: f.kind,
    zone: def.zones[Math.min(f.zone, def.zones.length - 1)].id,
    fixed: true,
    status: 'hidden' as const,
    progress: 0,
    timer: 0,
  }));
  a.missions = [];
  a.scan = null;
  a.sectorKey = key;
}

function news(events: TickEvents, kind: AnomalyKind, text: string, good: boolean, lore?: number): void {
  events.anomaly.push({ kind, text, good, lore });
}

export function anomalyById(state: GameState, id: number): AnomalyState | undefined {
  return state.anomalies.list.find((x) => x.id === id);
}

// ---------------------------------------------------------------- bonuses

export function codexSetsDone(state: GameState) {
  return CODEX_SETS.filter((set) => set.kinds.every((k) => (state.anomalies.codex[k] ?? 0) > 0));
}

export function codexProductionBonus(state: GameState): number {
  return 1 + codexSetsDone(state).reduce((s, x) => s + x.production, 0);
}

export function codexSurveyBonus(state: GameState): number {
  return 1 + codexSetsDone(state).reduce((s, x) => s + x.surveyData, 0);
}

/** Gravity Lens: clicks in its zone hit twice as hard once mapped. */
export function lensMult(state: GameState): number {
  return state.anomalies.list.some((x) => x.kind === 'gravity_lens' && x.zone === state.zone && (x.status === 'scanned' || x.status === 'done'))
    ? 2
    : 1;
}

export function scanSpeed(state: GameState): number {
  const surveyors = Math.min(ANOMALY.surveyorScanCap, state.drones.surveyor * ANOMALY.surveyorScan);
  return (1 + researchLevel(state, 'deep_scan') * ANOMALY.deepScanPerLevel + surveyors + postBonus(state, 'sensor')) * sectorMods(state).scanSpeed;
}

export function scanDuration(state: GameState, a: AnomalyState): number {
  return anomalyDef(a.kind).scanSec / scanSpeed(state);
}

/** Value of everything the fleet makes per second, at current prices. */
export function productionValuePerSec(state: GameState): number {
  const rates = droneRates(state);
  let v = 0;
  for (const id of ORE_IDS) v += rates[id] * orePrice(state, id);
  return v + mechRateTotal(state) * orePrice(state, 'ferrite');
}

// ---------------------------------------------------------------- scanning

export function startScan(state: GameState, id: number): boolean {
  const a = anomalyById(state, id);
  if (!a || a.status !== 'signal' || state.anomalies.scan) return false;
  const d = scanDuration(state, a);
  state.anomalies.scan = { anomalyId: id, remaining: d, duration: d };
  return true;
}

function identify(state: GameState, a: AnomalyState, events: TickEvents): void {
  const def = anomalyDef(a.kind);
  a.status = 'scanned';
  const first = !(state.anomalies.codex[a.kind] ?? 0);
  state.anomalies.codex[a.kind] = (state.anomalies.codex[a.kind] ?? 0) + 1;
  news(events, a.kind, `Scan complete: ${def.name} in the ${zoneDef(a.zone).name}.${first ? ' New Codex entry!' : ''}`, true);
  switch (a.kind) {
    case 'gravity_lens':
      news(events, a.kind, `Gravity Lens mapped — drill clicks in the ${zoneDef(a.zone).name} now hit twice as hard.`, true);
      break;
    case 'comet':
      a.status = 'active';
      a.timer = ANOMALY.cometSec;
      news(events, a.kind, `Comet tracked! The ${zoneDef(a.zone).name} produces ×${ANOMALY.cometMult} for ${ANOMALY.cometSec / 60} minutes.`, true);
      break;
    case 'leviathan': {
      a.status = 'done';
      state.surveyData += ANOMALY.leviathanSd * codexSurveyBonus(state);
      news(events, a.kind, `We watched it. It watched us. +${ANOMALY.leviathanSd} Survey Data.`, true);
      break;
    }
  }
  if (first) {
    for (const set of CODEX_SETS) {
      if (set.kinds.includes(a.kind) && set.kinds.every((k) => (state.anomalies.codex[k] ?? 0) > 0)) {
        news(events, a.kind, `Codex set complete: ${set.name}! Permanent bonus: ${set.bonus}.`, true);
      }
    }
  }
}

// ---------------------------------------------------------------- responses

/** Mechs free for a mission: working, healthy, not already busy elsewhere. */
export function missionReady(state: GameState, m: MechState): boolean {
  if (!mechOperable(state, m) || m.job === 'repair' || m.job === 'mission') return false;
  const c = mechCondition(state, m).id;
  return c === 'operational' || c === 'damaged';
}

export function dronesFor(state: GameState, kind: AnomalyKind): number {
  const p = state.drones.prospector;
  if (kind === 'wormhole') return Math.max(5, Math.floor(p * ANOMALY.wormholeDrones));
  return Math.max(5, Math.floor(p * 0.1));
}

export function missionChance(state: GameState, kind: AnomalyKind, approach: Approach, mech?: MechState | null): number {
  if (approach === 'drones') {
    return kind === 'wormhole' ? 1 : kind === 'derelict' ? 0.85 : kind === 'ghost_signal' ? 0.6 : 0.5;
  }
  if (!mech) return 0;
  const st = mechStats(state, mech);
  let c = 0.55 + (st.sensors + st.speed) / 200;
  const p = mechPilot(state, mech);
  if (p) {
    const ps = pilotStats(p);
    c += (ps.instinct + ps.nerve) * 0.005;
    if (hasTrait(p, 'lucky')) c += 0.1;
  }
  if (kind === 'frozen_battlefield') c -= 0.15;
  return Math.max(0.05, Math.min(0.95, c));
}

export function canLaunch(state: GameState, id: number, approach: Approach, mechId?: number): string | null {
  const a = anomalyById(state, id);
  if (!a) return 'Gone';
  const def = anomalyDef(a.kind);
  if (a.status !== 'scanned') return 'Scan it first';
  if (!def.approaches.includes(approach)) return 'Not possible';
  if (state.anomalies.missions.some((m) => m.anomalyId === id)) return 'Mission underway';
  if (approach === 'drones' && state.drones.prospector < 5) return 'Need at least 5 Prospector drones';
  if (approach === 'mech') {
    const m = state.mechs.find((x) => x.id === mechId);
    if (!m || !missionReady(state, m)) return 'Choose a ready mech';
  }
  if (a.kind === 'derelict' && a.progress >= ANOMALY.derelictCycles) return 'Stripped bare';
  if (a.kind === 'frozen_battlefield' && a.progress >= ANOMALY.battlefieldRuns) return 'Nothing left to recover';
  return null;
}

export function launchMission(state: GameState, id: number, approach: Approach, mechId?: number): boolean {
  if (canLaunch(state, id, approach, mechId) !== null) return false;
  const a = anomalyById(state, id)!;
  const def = anomalyDef(a.kind);
  const mech = approach === 'mech' ? state.mechs.find((x) => x.id === mechId)! : null;
  let drones = 0;
  if (approach === 'drones') {
    drones = dronesFor(state, a.kind);
    state.drones.prospector -= drones;
  }
  if (mech) {
    mech.returnJob = mech.job === 'mission' ? mech.returnJob : mech.job;
    mech.job = 'mission';
  }
  const duration = def.missionSec / (mech && a.kind === 'derelict' ? ANOMALY.derelictMechSpeed : 1);
  state.anomalies.missions.push({
    id: state.anomalies.nextId++,
    anomalyId: id,
    approach,
    mechId: mech?.id ?? null,
    drones,
    remaining: duration,
    duration,
    chance: missionChance(state, a.kind, approach, mech),
  });
  if (a.kind !== 'derelict' && a.kind !== 'frozen_battlefield') a.status = 'active';
  return true;
}

export function startDecode(state: GameState, id: number): boolean {
  const a = anomalyById(state, id);
  if (!a || a.kind !== 'silent_beacon' || a.status !== 'scanned') return false;
  a.status = 'active';
  return true;
}

export function deployRig(state: GameState, id: number): boolean {
  const a = anomalyById(state, id);
  if (!a || a.kind !== 'crystal_bloom' || a.status !== 'scanned' || state.credits < ANOMALY.bloomRigCost) return false;
  state.credits -= ANOMALY.bloomRigCost;
  a.status = 'active';
  a.progress = 1;
  return true;
}

/** Harvest rig level (1 when first deployed); stored in the anomaly's progress. */
export function rigLevel(a: AnomalyState): number {
  return Math.max(1, a.progress);
}

export function rigMaxLevel(): number {
  return ANOMALY.bloomRigMult.length;
}

/** Voidglass per second from a Crystal Bloom rig. */
export function bloomRate(a: AnomalyState): number {
  return ANOMALY.bloomPerSec * ANOMALY.bloomRigMult[Math.min(rigLevel(a), rigMaxLevel()) - 1];
}

/** Credits for the next rig upgrade, or null at max. */
export function rigUpgradeCost(a: AnomalyState): number | null {
  const lvl = rigLevel(a);
  if (lvl >= rigMaxLevel()) return null;
  return Math.round(ANOMALY.bloomRigCost * ANOMALY.bloomUpgradeGrowth ** lvl);
}

export function upgradeRig(state: GameState, id: number): boolean {
  const a = anomalyById(state, id);
  if (!a || a.kind !== 'crystal_bloom' || a.status !== 'active') return false;
  const cost = rigUpgradeCost(a);
  if (cost === null || state.credits < cost) return false;
  state.credits -= cost;
  a.progress = rigLevel(a) + 1;
  return true;
}

/** A harvest rig is running somewhere in this sector. */
export function bloomHarvesting(state: GameState): boolean {
  return state.anomalies.list.some((a) => a.kind === 'crystal_bloom' && a.status === 'active');
}

export function decodeSpeed(state: GameState): number {
  const scholars = state.pilots.filter((p) => p.background === 'scholar' && Object.values(state.posts).includes(p.id)).length;
  return 1 + postBonus(state, 'science') + 0.5 * scholars + researchLevel(state, 'deep_scan') * 0.25 + researchLevel(state, 'beacon_decoding') * 0.5;
}

// ---------------------------------------------------------------- golden asteroid

export interface GoldenClick {
  locked: boolean;
  overheated: boolean;
  damage: number;
  cracked: boolean;
  credits: number;
}

export function goldenTarget(state: GameState): AnomalyState | undefined {
  return state.anomalies.list.find((x) => x.kind === 'golden_asteroid' && x.status === 'signal' && x.zone === state.zone);
}

export function goldenClick(state: GameState, events: TickEvents): GoldenClick | null {
  const a = goldenTarget(state);
  if (!a) return null;
  const drill = state.drill;
  const out: GoldenClick = { locked: false, overheated: false, damage: 0, cracked: false, credits: 0 };
  if (drill.lockRemaining > 0) {
    out.locked = true;
    return out;
  }
  const h = CONFIG.heat;
  drill.heat += h.perClick * sectorMods(state).heatPerClick;
  if (drill.heat >= h.max) {
    drill.heat = h.max;
    drill.lockRemaining = h.lockSec;
    out.overheated = true;
    return out;
  }
  out.damage = drillPower(state) * (drill.heat <= h.overdriveMax ? overdriveMult(state) : 1);
  a.hp = Math.max(0, (a.hp ?? 0) - out.damage);
  if (a.hp <= 0) {
    out.cracked = true;
    out.credits = Math.max(ANOMALY.goldenMinCredits, productionValuePerSec(state) * ANOMALY.goldenValueSec);
    state.credits += out.credits;
    state.stats.creditsEarned += out.credits;
    a.status = 'done';
    state.anomalies.codex.golden_asteroid = (state.anomalies.codex.golden_asteroid ?? 0) + 1;
    news(events, 'golden_asteroid', `Golden asteroid cracked! +${Math.round(out.credits).toLocaleString()} cr.`, true);
  }
  return out;
}

// ---------------------------------------------------------------- mission results

function credits(state: GameState, sec: number): number {
  return Math.max(2000, productionValuePerSec(state) * sec);
}

function grantPart(state: GameState, rng: Rng, uniqueChance: number): string {
  const pool = rng.next() < uniqueChance ? PARTS.filter((p) => p.rarity === 'unique') : PARTS.filter((p) => p.rarity === 'standard' && !p.research);
  const p = pool[Math.floor(rng.next() * pool.length)];
  state.parts[p.id] = (state.parts[p.id] ?? 0) + 1;
  return p.name;
}

function resolveMission(state: GameState, m: MissionState, events: TickEvents): void {
  const a = anomalyById(state, m.anomalyId);
  const mech = m.mechId !== null ? state.mechs.find((x) => x.id === m.mechId) ?? null : null;
  const rng = new Rng(state.rng);
  const ok = rng.next() < m.chance;
  const def = a ? anomalyDef(a.kind) : null;
  let returning = m.drones;

  if (mech) {
    mech.job = mech.returnJob && mech.returnJob !== 'mission' ? mech.returnJob : 'idle';
    mech.returnJob = null;
    const p = pilotById(state, mech.pilotId);
    if (p) {
      p.xp += (150 + 50 * (ok ? 2 : 1)) * medalMult(state, 'xp');
      p.sync[mech.frame] += 120;
    }
  }

  if (a && def) {
    switch (a.kind) {
      case 'derelict': {
        a.progress++;
        const c = credits(state, ok ? 90 : 30) * (mech ? 1.5 : 1);
        state.credits += c;
        state.stats.creditsEarned += c;
        const gains = [`+${Math.round(c).toLocaleString()} cr`];
        if (ok && rng.next() < 0.25) {
          state.dataCores++;
          gains.push('+1 Data Core');
        }
        if (ok && rng.next() < (mech ? 0.15 : 0.05)) gains.push(`part: ${grantPart(state, rng, 0.1)}`);
        a.status = a.progress >= ANOMALY.derelictCycles ? 'done' : 'scanned';
        news(events, a.kind, `Salvage run ${a.progress}/${ANOMALY.derelictCycles} at the derelict: ${gains.join(', ')}.${a.status === 'done' ? ' It\'s stripped bare.' : ''}`, true);
        break;
      }
      case 'wormhole': {
        returning = Math.floor(m.drones * rng.range(0.7, 1));
        const roll = rng.next();
        let prize: string;
        if (roll < 0.45) {
          const c = credits(state, 300);
          state.credits += c;
          state.stats.creditsEarned += c;
          prize = `${Math.round(c).toLocaleString()} cr in strange ore`;
        } else if (roll < 0.65) {
          const n = 1 + Math.floor(rng.next() * 3);
          state.dataCores += n;
          prize = `${n} Data Core${n > 1 ? 's' : ''}`;
        } else if (roll < 0.85) {
          const sd = 20 + 10 * state.sector.depth + sectorZones(state).length * 5;
          state.surveyData += sd;
          prize = `${sd} Survey Data`;
        } else if (roll < 0.95) {
          prize = `a part: ${grantPart(state, rng, 0.25)}`;
        } else {
          returning = 0;
          prize = 'nothing — the wormhole collapsed';
        }
        a.status = 'done';
        news(events, a.kind, `Drones back through the wormhole: ${prize}.${m.drones - returning > 0 ? ` ${m.drones - returning} drones never returned.` : ''}`, returning > 0 && !prize.startsWith('nothing'));
        break;
      }
      case 'ghost_signal': {
        a.status = 'done';
        const roll = rng.next();
        if (!ok) {
          news(events, a.kind, `The ghost signal faded before we reached it.`, false);
        } else if (roll < 0.4 && mech) {
          if (state.pilots.length < rosterCap(state)) {
            const pilot = generatePilot(state, rng);
            state.pilots.push(pilot);
            rollBond(state, pilot, rng);
            news(events, a.kind, `Survivors! ${pilot.name} "${pilot.callsign}" (${pilot.background}) joins the crew.`, true);
          } else {
            const c = credits(state, 120);
            state.credits += c;
            news(events, a.kind, `Survivors rescued and dropped at a station — their reward: ${Math.round(c).toLocaleString()} cr.`, true);
          }
        } else if (roll < 0.7) {
          news(events, a.kind, `It was a trap! Pirates were waiting on the signal.`, false);
          if (mech && rng.next() < 0.5) damageMech(state, mech, 0.4);
          if (!state.threats.events.some((e) => e.kind === 'raid')) {
            const raid = startEvent(state, 'raid', events, rng);
            raid.remaining = 20;
          }
        } else {
          const sd = 30;
          state.surveyData += sd * codexSurveyBonus(state);
          news(events, a.kind, `An old message on a loop. It said our ship's name. +${sd} Survey Data.`, true);
        }
        break;
      }
      case 'frozen_battlefield': {
        a.progress++;
        if (ok) {
          const parts = [grantPart(state, rng, 0.2)];
          if (rng.next() < 0.5) parts.push(grantPart(state, rng, 0.1));
          let extra = '';
          if (rng.next() < 0.15 && state.pilots.length < rosterCap(state)) {
            const pilot = generatePilot(state, rng, 'ace');
            state.pilots.push(pilot);
            rollBond(state, pilot, rng);
            extra = ` A frozen pilot was revived: ${pilot.name} joins the crew!`;
          }
          news(events, a.kind, `Battlefield expedition ${a.progress}/${ANOMALY.battlefieldRuns}: recovered ${parts.join(', ')}.${extra}`, true);
        } else if (mech) {
          damageMech(state, mech, 0.5);
          news(events, a.kind, `Battlefield expedition went wrong — ${mech.designation} took heavy damage.`, false);
        }
        a.status = a.progress >= ANOMALY.battlefieldRuns ? 'done' : 'scanned';
        break;
      }
    }
  }
  state.drones.prospector += returning;
  state.rng = rng.state;
}

// ---------------------------------------------------------------- time

export function advanceAnomalies(state: GameState, dt: number, events: TickEvents, offline: boolean): void {
  ensureAnomalies(state);
  const A = state.anomalies;

  // Fixed anomalies are detected once their zone is surveyed.
  for (const a of A.list) {
    if (a.status === 'hidden' && zoneUnlocked(state, a.zone)) {
      a.status = 'signal';
      news(events, a.kind, `Unknown signal detected in the ${zoneDef(a.zone).name}. Scan it from the MAP.`, true);
    }
  }

  // Scan.
  if (A.scan) {
    A.scan.remaining -= dt;
    const a = anomalyById(state, A.scan.anomalyId);
    if (!a) A.scan = null;
    else if (A.scan.remaining <= 0) {
      A.scan = null;
      identify(state, a, events);
    }
  }

  // Passing anomalies appear (not while away — you'd never see them).
  A.nextIn -= dt * sectorMods(state).anomalyChance;
  if (A.nextIn <= 0) {
    const rng = new Rng(state.rng);
    A.nextIn = rng.range(ANOMALY.intervalMin, ANOMALY.intervalMax);
    if (!offline) spawnPassing(state, rng, events);
    state.rng = rng.state;
  }

  for (const a of [...A.list]) {
    // Expiry of passing signals.
    if (!a.fixed && (a.status === 'signal' || a.status === 'scanned') && a.expires !== undefined) {
      a.expires -= dt;
      if (a.expires <= 0 && !A.missions.some((m) => m.anomalyId === a.id)) {
        a.status = 'done';
        if (A.scan?.anomalyId === a.id) A.scan = null;
        news(events, a.kind, `The ${anomalyDef(a.kind).name} slipped away.`, false);
      }
    }
    // Comet window.
    if (a.kind === 'comet' && a.status === 'active') {
      a.timer -= dt;
      if (a.timer <= 0) {
        a.status = 'done';
        news(events, a.kind, 'The comet has passed.', true);
      }
    }
    // Beacon decoding.
    if (a.kind === 'silent_beacon' && a.status === 'active') {
      a.timer += dt * decodeSpeed(state);
      while (a.timer >= ANOMALY.beaconSecPerFragment && a.progress < ANOMALY.beaconFragments) {
        a.timer -= ANOMALY.beaconSecPerFragment;
        a.progress++;
        A.lore = Math.max(A.lore, a.progress);
        state.surveyData += 25 * codexSurveyBonus(state);
        news(events, a.kind, `Beacon fragment ${a.progress}/${ANOMALY.beaconFragments} decoded. +25 Survey Data. Read it in the CODEX.`, true, a.progress);
        if (a.progress >= ANOMALY.beaconFragments) {
          a.status = 'done';
          state.dataCores += 3;
          news(events, a.kind, 'The Silent Beacon is fully decoded. +3 Data Cores. VESPER has gone very quiet.', true);
        }
      }
    }
    // Crystal Bloom harvest rig.
    if (a.kind === 'crystal_bloom' && a.status === 'active') {
      const ore = emptyOre();
      ore.voidglass = bloomRate(a) * dt;
      addToCargo(state, ore);
    }
  }
  A.list = A.list.filter((a) => a.fixed || a.status !== 'done');

  // Missions.
  for (const m of [...A.missions]) {
    m.remaining -= dt;
    if (m.remaining > 0) continue;
    A.missions = A.missions.filter((x) => x !== m);
    resolveMission(state, m, events);
  }
}

function spawnPassing(state: GameState, rng: Rng, events: TickEvents): void {
  const A = state.anomalies;
  const options = ANOMALIES.filter(
    (d) => !d.fixed && d.minDepth <= state.sector.depth && !A.list.some((x) => x.kind === d.kind && x.status !== 'done'),
  );
  if (!options.length) return;
  const total = options.reduce((s, d) => s + d.weight, 0);
  let roll = rng.next() * total;
  let def = options[0];
  for (const d of options) {
    roll -= d.weight;
    if (roll <= 0) {
      def = d;
      break;
    }
  }
  const zones = sectorZones(state).filter((z) => zoneUnlocked(state, z.id));
  // Golden asteroids drift through where the ship is, so you can click them.
  const zone = def.kind === 'golden_asteroid' ? state.zone : zones[Math.floor(rng.next() * zones.length)].id;
  const a: AnomalyState = {
    id: A.nextId++,
    kind: def.kind,
    zone,
    fixed: false,
    status: 'signal',
    expires: def.expireSec,
    progress: 0,
    timer: 0,
  };
  if (def.kind === 'golden_asteroid') {
    a.hpMax = baseDrillPower(state) * ANOMALY.goldenClicks;
    a.hp = a.hpMax;
  }
  A.list.push(a);
  news(
    events,
    def.kind,
    def.kind === 'golden_asteroid'
      ? 'A golden asteroid is drifting past! Crack it before it leaves!'
      : `ANOMALOUS READING in the ${zoneDef(zone).name}. It won't last — scan it from the MAP.`,
    true,
  );
}

/** Spawn a specific passing anomaly (tests and debugging). */
export function spawnAnomaly(state: GameState, kind: AnomalyKind, events: TickEvents): AnomalyState {
  const def = anomalyDef(kind);
  const a: AnomalyState = {
    id: state.anomalies.nextId++,
    kind,
    zone: state.zone,
    fixed: def.fixed,
    status: 'signal',
    expires: def.expireSec,
    progress: 0,
    timer: 0,
  };
  if (kind === 'golden_asteroid') {
    a.hpMax = baseDrillPower(state) * ANOMALY.goldenClicks;
    a.hp = a.hpMax;
  }
  state.anomalies.list.push(a);
  news(events, kind, `${def.name} detected.`, true);
  return a;
}

/** Hide a mech's mission state if the mech is scrapped. */
export function mechOnMission(state: GameState, mechId: number): boolean {
  return state.anomalies.missions.some((m) => m.mechId === mechId);
}

