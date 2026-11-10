/**
 * Threat tuning: hazard events, market events, Pirate Heat, raids,
 * sorties, the Vermilion Jackal and offline loss caps.
 */

export type EventKind = 'raid' | 'flare' | 'rogue' | 'micrometeor' | 'reactor' | 'blackout' | 'boom' | 'crash';
export type RaidOrder = 'defend' | 'defend_all' | 'surrender';
export type FlareOrder = 'shelter' | 'ride';
export type RogueOrder = 'intercept' | 'ignore';

export interface StandingOrders {
  raid: RaidOrder;
  flare: FlareOrder;
  rogue: RogueOrder;
}

export const DEFAULT_ORDERS: StandingOrders = { raid: 'defend', flare: 'shelter', rogue: 'intercept' };

export interface EventDef {
  kind: EventKind;
  name: string;
  kana: string;
  /** Hostile events are held back during the first-run grace period. */
  hostile: boolean;
  /** Seconds of warning before it hits (0 = immediate). */
  warning: number;
  /** Seconds the effect lasts once active (0 = instant). */
  duration: number;
  weight: number;
  desc: string;
}

export const EVENTS: readonly EventDef[] = [
  { kind: 'raid', name: 'Pirate Raid', kana: 'かいぞくしゅうげき', hostile: true, warning: 45, duration: 0, weight: 3, desc: 'Pirates are coming for your cargo. Defend with mechs and Guardian drones, or hand over a share of the hold.' },
  { kind: 'flare', name: 'Solar Flare', kana: 'たいようフレア', hostile: true, warning: 60, duration: 45, weight: 2, desc: 'Radiation is about to sweep the belt. Shelter the drones (they stop mining) or ride it out (some are lost).' },
  { kind: 'rogue', name: 'Rogue Asteroid', kana: 'きけんしょうわくせい', hostile: true, warning: 40, duration: 0, weight: 1.5, desc: 'A huge rock is on a collision course. Crack it by clicking it, or let a mech intercept. Success pays big.' },
  { kind: 'micrometeor', name: 'Micrometeor Storm', kana: 'びせきうんう', hostile: true, warning: 0, duration: 60, weight: 1.5, desc: 'Grit is shredding drones. Guardians shield the swarm.' },
  { kind: 'reactor', name: 'Reactor Fault', kana: 'ろしんいじょう', hostile: true, warning: 0, duration: 90, weight: 1, desc: 'Ship systems at 70% until repaired. A Repair Chief fixes it faster.' },
  { kind: 'blackout', name: 'Comms Blackout', kana: 'つうしんしょうがい', hostile: true, warning: 0, duration: 45, weight: 1, desc: 'The exchange is out of reach. No selling until the signal returns.' },
  { kind: 'boom', name: 'Ore Boom', kana: 'こうきょう', hostile: false, warning: 0, duration: 300, weight: 1.5, desc: 'Demand spike! One ore sells at double price.' },
  { kind: 'crash', name: 'Market Crash', kana: 'ぼうらく', hostile: false, warning: 0, duration: 300, weight: 1, desc: 'One ore crashes to half price. Refine it or hold it until it recovers.' },
];

export function eventDef(kind: EventKind): EventDef {
  return EVENTS.find((e) => e.kind === kind)!;
}

export const THREAT = {
  /** After Break the Cycle: share of raids that are Meridian Security, and how much harder they hit. */
  corporateChance: 0.3,
  corporateStrength: 1.2,
  /** No hostile events for this long (game time) in a new game. */
  graceSec: 1200,
  /** Seconds between events, picked at random in this range. */
  intervalMin: 180,
  intervalMax: 420,

  heat: {
    max: 100,
    /** Heat per minute: base plus up to `wealthPerMin` as lifetime earnings grow. */
    basePerMin: 0.5,
    wealthPerMin: 1.5,
    victoryDrop: 25,
    surrenderDrop: 10,
    defeatDrop: 5,
    /** Extra raid weight per point of Heat. */
    raidWeightPerHeat: 0.05,
  },

  raid: {
    baseStrength: 12,
    /** Strength multipliers: per 50 Heat, per zone index, per decade of lifetime credits. */
    heatScale: 50,
    zoneScale: 0.5,
    wealthUnit: 1e5,
    /** Enemy HP is strength × this; they hit for `strength` per round. */
    hpPerStrength: 6,
    rounds: 6,
    surrenderCargo: 0.2,
    defeatCargo: 0.25,
    defeatDrones: 0.03,
    bountyPerStrength: 60,
    dataCoreChance: 0.25,
    xpBase: 200,
    xpPerRound: 50,
    syncSec: 300,
  },

  guardian: {
    power: 3,
    hp: 15,
    /** Share of incoming fire Guardians soak up before mechs are hit. */
    absorb: 0.4,
  },

  mech: {
    combatWeight: 3,
    speedWeight: 1,
    sensorWeight: 0.5,
    pilotPilotingBonus: 0.03,
    pilotLevelBonus: 0.01,
    syncBonus: 0.05,
    /** Bulwarks draw fire. */
    bulwarkTaunt: 1.5,
  },

  flare: { rideLoss: 0.08, mechDamage: 0.1 },
  micrometeor: { lossPerSec: 0.0015, shieldPerGuardian: 0.01, shieldCap: 0.9 },
  reactor: { output: 0.7 },
  market: { boom: 2, crash: 0.5 },

  rogue: {
    /** HP in normal clicks at the current drill power. */
    clicks: 120,
    /** Ore reward = this many clicks' worth of ore. */
    rewardClicks: 360,
    interceptReward: 0.6,
    impactCargo: 0.15,
    impactDrones: 0.02,
    impactMechDamage: 0.3,
    dataCoreChance: 0.5,
  },

  injurySec: 1200,
  medbayPerLevel: 1,

  wrecks: {
    rebuildFrac: 0.25,
    decayPerMin: 0.01,
    /** Wrecks each Salvager drone recovers per second, for free. */
    salvagerPerSec: 0.005,
  },

  /** While away, never lose more than these shares per absence. */
  offlineDroneLossCap: 0.1,
  offlineCargoLossCap: 0.25,

  jackal: {
    firstRaid: 3,
    minHeat: 30,
    everyRaids: 4,
    chance: 0.5,
    strengthMult: 1.6,
    perEncounter: 0.2,
    bountyMult: 2,
    partChance: 0.3,
  },

  strike: {
    /** Raid wins needed to trace the pirate base (first time, then again). */
    winsToFind: 3,
    winsToRefind: 5,
    strengthMult: 2.5,
    bountyMult: 3,
    jackalChance: 0.5,
  },

  logSize: 30,
};

export interface EnemyUnit {
  id: 'skiff' | 'gunboat' | 'rogue_frame' | 'jackal';
  name: string;
  /** Share of total strength one unit represents. */
  weight: number;
}

export const ENEMY_UNITS: Record<EnemyUnit['id'], EnemyUnit> = {
  skiff: { id: 'skiff', name: 'Pirate Skiff', weight: 1 },
  gunboat: { id: 'gunboat', name: 'Gunboat', weight: 4 },
  rogue_frame: { id: 'rogue_frame', name: 'Rogue Frame', weight: 10 },
  jackal: { id: 'jackal', name: '"Crimson Fang" — the Jackal\'s frame', weight: 25 },
};

export const JACKAL = {
  name: 'The Vermilion Jackal',
  callsign: 'Jackal',
  /** Comm lines by situation. */
  arrive: [
    'Well, well. A Meridian prospector, all alone out here. Your cargo looks heavy, Commander — let me lighten it.',
    'Miss me? I followed your fold wake. You leave such a pretty trail.',
    'Again, Commander? You really should learn to share.',
  ],
  win: ['Ha! Thanks for the donation. Same time next week?', 'Too slow. Tell Meridian the Jackal sends regards.'],
  lose: [
    'Tch — not bad. This isn\'t over. I\'ll be waiting on the far side of your next fold.',
    'You got lucky. Next time I bring the whole pack.',
    'Run along, little prospector. You don\'t even know what that drive of yours really does.',
  ],
};
