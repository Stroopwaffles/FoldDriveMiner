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

  /**
   * Captain raids: a named pirate leads the attack. The first comes on the 3rd raid, then one can
   * come every few raids while Heat is up. Before the first Fold Jump a rival captain leads them;
   * from then on it's the Jackal (her entrance is the first raid after that jump), with a rival
   * flying as her lieutenant every third captain raid.
   */
  captain: {
    firstRaid: 3,
    minHeat: 30,
    everyRaids: 4,
    chance: 0.5,
    lieutenantEvery: 3,
  },

  jackal: {
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
  id: 'skiff' | 'gunboat' | 'rogue_frame' | 'jackal' | 'captain';
  name: string;
  /** Share of total strength one unit represents. */
  weight: number;
}

export const ENEMY_UNITS: Record<EnemyUnit['id'], EnemyUnit> = {
  skiff: { id: 'skiff', name: 'Pirate Skiff', weight: 1 },
  gunboat: { id: 'gunboat', name: 'Gunboat', weight: 4 },
  rogue_frame: { id: 'rogue_frame', name: 'Rogue Frame', weight: 10 },
  jackal: { id: 'jackal', name: '"Crimson Fang" — the Jackal\'s frame', weight: 25 },
  captain: { id: 'captain', name: 'Captain\'s flagship', weight: 18 },
};

/** A pirate captain who leads raids before the Jackal takes over the lanes. */
export interface CaptainDef {
  id: 'corrigan' | 'ombra' | 'tollan';
  name: string;
  /** Their flagship, shown in the enemy roster. */
  ship: string;
  /** Raid strength multiplier. */
  strengthMult: number;
  bountyMult: number;
  arrive: string[];
  /** Said when the pirates win, and when they're driven off. */
  win: string[];
  lose: string[];
  /** Said on raids they fly as the Jackal's lieutenant. */
  underJackal: string;
}
export type CaptainId = CaptainDef['id'];

export const CAPTAINS: readonly CaptainDef[] = [
  {
    id: 'corrigan',
    name: 'Mag Corrigan',
    ship: '"Junkjaw", Corrigan\'s salvage hauler',
    strengthMult: 1.3,
    bountyMult: 1.5,
    arrive: [
      'Mag Corrigan of the Rustbelt Reavers. Everything out here is salvage, Commander. Including you.',
      'You again? Good. Your hull plating fetched a fine price last time.',
      'I can smell a full cargo hold from three sectors away.',
    ],
    win: ['Pleasure doing business. Your scrap, my profit.', 'Hah! The Reavers eat well tonight.'],
    lose: ['Fine. FINE. Junkjaw needed a new hull anyway.', "You'll keep. Everything keeps, out here."],
    underJackal: 'The Jackal pays better than Meridian ever did. Nothing personal, Commander.',
  },
  {
    id: 'ombra',
    name: 'Dace Ombra',
    ship: '"Quiet Knife", Ombra\'s stealth cutter',
    strengthMult: 1.35,
    bountyMult: 1.5,
    arrive: [
      "Dace Ombra. You won't remember the name. People rarely live long enough to.",
      "Smile, Commander. You're on my scope.",
      'Quiet Knife is already inside your perimeter. Just thought you should know.',
    ],
    win: ['Clean work. I do love clean work.', 'Thank you for your cooperation.'],
    lose: ["Cut deeper than I expected. I'll remember that.", 'A retreat is just a long knife, Commander.'],
    underJackal: "She says to go easy on you. I don't take orders well.",
  },
  {
    id: 'tollan',
    name: 'Old Tollan',
    ship: '"Turnstile", Tollan\'s toll barge',
    strengthMult: 1.25,
    bountyMult: 1.6,
    arrive: [
      'This lane has a toll, youngster. Old Tollan collects it. Has for forty years.',
      "Toll's gone up. Inflation. You understand.",
      'Pay the toll, or pay the toll with interest. Your choice.',
    ],
    win: ['Toll paid in full. Safe travels!', 'Pleasure, as always. See you next lap.'],
    lose: ["Ach. Waived, this once. Don't tell anyone.", "Forty years and nobody's run my toll like that."],
    underJackal: 'The Jackal owns the lanes now. I just collect for her.',
  },
];

export function captainDef(id: CaptainId): CaptainDef {
  return CAPTAINS.find((c) => c.id === id)!;
}

/**
 * The Jackal's mood follows the story: a showboating pirate at first, cryptic once her face is
 * known (Episode 13), pleading once she's made her offer (Episode 22), bitter if you chose to
 * master the cycle.
 */
export type JackalMood = 'pirate' | 'revealed' | 'offer' | 'bitter';

export const JACKAL = {
  name: 'The Vermilion Jackal',
  callsign: 'Jackal',
  /** Episodes that move her to the next mood. */
  revealEpisode: 13,
  offerEpisode: 22,
  /** Her entrance, the first raid after your first Fold Jump: [speaker, line, delay ms]. */
  intro: [
    ['JACKAL', "So you're the new one. Fold-class, fresh paint, first jump still ringing in your hull.", 1200],
    ['JACKAL', "I'm the Vermilion Jackal. Everything past the field edge pays toll to me now, little bird.", 4200],
    ['JUNO', "That's no pirate scrap-frame. Commander, that's a Meridian chassis!", 7200],
    ['VESPER', 'Her transponder is scrubbed. But her fold wake... matches our own drive signature.', 10200],
    ['JACKAL', 'Of course it does. Ask your ship what it remembers. Then come and take it from me.', 13200],
  ] as [string, string, number][],
  /** Her parting words after the entrance raid. */
  introWin: "First jump's the hardest. You'll get used to losing things.",
  introLose: 'Ha! Good. You fly like someone I used to know. See you on the far side of the next fold.',
  lines: {
    pirate: {
      arrive: [
        'Miss me? I followed your fold wake. You leave such a pretty trail.',
        'Again, Commander? You really should learn to share.',
        'Your cargo looks heavy, little bird. Let me lighten it.',
      ],
      win: ['Ha! Thanks for the donation. Same time next week?', 'Too slow. Tell Meridian the Jackal sends regards.'],
      lose: [
        "Tch. Not bad. This isn't over.",
        'You got lucky. Next time I bring the whole pack.',
        "Run along, little prospector. You don't even know what that drive of yours really does.",
      ],
    },
    revealed: {
      arrive: [
        "Hull eight. You're further along than I was at this point.",
        "I'm not here for your cargo. I'm here to see if you've noticed yet.",
        'Count the seconds on your next jump, little bird. Then come find me.',
      ],
      win: ["I've lost this fight a hundred times. Winning it feels worse.", 'Take it as a lesson. I took mine harder.'],
      lose: ['Good. You have to be strong enough to break it.', 'Every time you beat me, I learn the shape of your next loop.'],
    },
    offer: {
      arrive: [
        "I won't ask twice. I'll ask every loop. Break the drive with me.",
        'Is Saffi still flying with you? Keep her close. She sees the edges.',
        'Hale is counting your jumps, Commander. So am I. For different reasons.',
      ],
      win: ["Don't make me keep doing this.", 'One way, Commander. No more loop. Think about it.'],
      lose: ["You're ready. You were always ready.", 'Still fighting me. Still the wrong enemy.'],
    },
    bitter: {
      arrive: [
        "You chose the harvest. Then I'm the weed it can't kill.",
        'Another loop, another hull eight. Was it worth it?',
        'Hale must be so proud of you.',
      ],
      win: ['Every loop you get richer. Every loop I get angrier.', "Keep your profits. I'll keep coming."],
      lose: ['See you next loop. And the one after that.', "You can't harvest me, Commander."],
    },
  } satisfies Record<JackalMood, { arrive: string[]; win: string[]; lose: string[] }>,
};
