/**
 * Anomalies: the opportunities and mysteries of a sector.
 * Fixed anomalies are part of the sector and hidden until scanned.
 * Passing anomalies appear during play and expire if ignored.
 */

export type AnomalyKind =
  | 'gravity_lens'
  | 'derelict'
  | 'silent_beacon'
  | 'crystal_bloom'
  | 'frozen_battlefield'
  | 'comet'
  | 'wormhole'
  | 'ghost_signal'
  | 'golden_asteroid'
  | 'leviathan';

export type Rarity = 'common' | 'uncommon' | 'rare' | 'legendary';
export type Approach = 'drones' | 'mech';

export interface AnomalyDef {
  kind: AnomalyKind;
  name: string;
  kana: string;
  rarity: Rarity;
  fixed: boolean;
  minDepth: number;
  weight: number;
  /** Seconds to scan (before Deep Scan, sensors and sector effects). */
  scanSec: number;
  /** Passing only: seconds before it slips away. */
  expireSec?: number;
  /** Which responses are offered once scanned. */
  approaches: Approach[];
  /** Mission length in seconds. */
  missionSec: number;
  desc: string;
  codex: string;
}

export const ANOMALIES: readonly AnomalyDef[] = [
  {
    kind: 'gravity_lens', name: 'Gravity Lens', kana: 'じゅうりょくレンズ', rarity: 'common', fixed: true, minDepth: 0, weight: 3,
    scanSec: 90, approaches: [], missionSec: 0,
    desc: 'Space folds around an invisible mass. Once mapped, drill clicks in this zone hit twice as hard.',
    codex: 'A knot of bent spacetime with nothing at its centre that any instrument can find. Drills bite deeper inside it. VESPER refuses to speculate.',
  },
  {
    kind: 'derelict', name: 'Derelict Megastructure', kana: 'はいきょこうぞうたい', rarity: 'uncommon', fixed: true, minDepth: 0, weight: 2,
    scanSec: 150, approaches: ['drones', 'mech'], missionSec: 120,
    desc: 'A dead station the size of a moon. Send salvage teams: credits, Data Cores and the odd part, until it is stripped.',
    codex: 'Its hull plates carry a manufacturer\'s stamp worn almost smooth. The last legible letters spell "…IDIAN".',
  },
  {
    kind: 'silent_beacon', name: 'Silent Beacon', kana: 'ちんもくのビーコン', rarity: 'rare', fixed: true, minDepth: 0, weight: 1,
    scanSec: 180, approaches: ['drones'], missionSec: 0,
    desc: 'An ancient transmitter, still broadcasting. Decode it fragment by fragment for Survey Data, Data Cores and… answers.',
    codex: 'Fold navigation markers, older than any charted lane. They should not be addressed to anyone. This one is.',
  },
  {
    kind: 'crystal_bloom', name: 'Crystal Bloom', kana: 'けっしょうのはな', rarity: 'rare', fixed: true, minDepth: 2, weight: 1,
    scanSec: 150, approaches: ['drones'], missionSec: 0,
    desc: 'Voidglass that grows back. Deploy a harvest rig (no Mk.V drill needed) for a steady flow of the most valuable ore there is, and upgrade the rig to widen it.',
    codex: 'Crystals that regrow in hard vacuum, in perfect lattices, at exactly the rate you harvest them. As if they were expecting you.',
  },
  {
    kind: 'frozen_battlefield', name: 'Frozen Battlefield', kana: 'こおりのせんじょう', rarity: 'rare', fixed: true, minDepth: 2, weight: 1,
    scanSec: 150, approaches: ['mech'], missionSec: 180,
    desc: 'Wrecked mechs from a forgotten war. Send a pilot to recover parts — and maybe a survivor. Dangerous ground.',
    codex: 'Hundreds of frames, all facing the same way, all frozen mid-stride. Their designations are FDM. Every one.',
  },
  {
    kind: 'comet', name: 'Comet Pass', kana: 'すいせいつうか', rarity: 'common', fixed: false, minDepth: 0, weight: 3,
    scanSec: 20, expireSec: 150, approaches: [], missionSec: 0,
    desc: 'A comet grazes a zone. Track it and that zone produces double for three minutes.',
    codex: 'Ice, dust and a long blue tail. Some things are exactly what they look like.',
  },
  {
    kind: 'golden_asteroid', name: 'Golden Asteroid', kana: 'おうごんのしょうわくせい', rarity: 'common', fixed: false, minDepth: 0, weight: 2,
    scanSec: 0, expireSec: 60, approaches: [], missionSec: 0,
    desc: 'A fragile, glittering rock drifts past. Crack it with the drill before it leaves for a huge payout.',
    codex: 'Platinum-group metals in a crust thin as eggshell. Rare enough that prospectors toast them for a week.',
  },
  {
    kind: 'wormhole', name: 'Wormhole Flicker', kana: 'ワームホール', rarity: 'uncommon', fixed: false, minDepth: 0, weight: 1.5,
    scanSec: 30, expireSec: 180, approaches: ['drones'], missionSec: 60,
    desc: 'A pinhole into somewhere else. Send drones through for a random prize. Not all of them come back.',
    codex: 'The drones that return carry dust from a star that is not on any chart, and their clocks are eleven seconds fast.',
  },
  {
    kind: 'ghost_signal', name: 'Ghost Signal', kana: 'ゆうれいしんごう', rarity: 'uncommon', fixed: false, minDepth: 0, weight: 1.5,
    scanSec: 40, expireSec: 300, approaches: ['drones', 'mech'], missionSec: 90,
    desc: 'A distress call. Survivors, a pirate trap, or an old message — only one way to find out.',
    codex: 'The voice on the loop says "Halberd, do you copy." It is your own voice.',
  },
  {
    kind: 'leviathan', name: 'Stellar Leviathan', kana: 'ほしのリヴァイアサン', rarity: 'legendary', fixed: false, minDepth: 8, weight: 0.3,
    scanSec: 60, expireSec: 240, approaches: [], missionSec: 0,
    desc: 'Something vast drifts through the belt. Observe it before it leaves.',
    codex: 'It turned to look at us. Then it folded — the way we do — and was gone.',
  },
];

export function anomalyDef(kind: AnomalyKind): AnomalyDef {
  return ANOMALIES.find((a) => a.kind === kind)!;
}

export const RARITY_COLOR: Record<Rarity, string> = {
  common: '#8d95c7',
  uncommon: '#4fe3ff',
  rare: '#c77dff',
  legendary: '#ffb547',
};

export const ANOMALY = {
  /** Passing anomalies: seconds between rolls. */
  intervalMin: 360,
  intervalMax: 720,
  /** Deep Scan research: +50% scan speed per level. */
  deepScanPerLevel: 0.5,
  /** Each Surveyor drone adds this much scan speed (capped). */
  surveyorScan: 0.01,
  surveyorScanCap: 1,
  derelictCycles: 8,
  derelictMechSpeed: 2,
  beaconFragments: 5,
  beaconSecPerFragment: 900,
  bloomPerSec: 0.01,
  bloomRigCost: 250000,
  /** Harvest rig upgrades: output multiplier per rig level (level 1 = the base rig). */
  bloomRigMult: [1, 2.5, 5, 10, 20],
  /** Each upgrade costs the rig price × this per level already built. */
  bloomUpgradeGrowth: 3,
  battlefieldRuns: 5,
  cometSec: 180,
  cometMult: 2,
  goldenClicks: 60,
  /** Golden asteroid pays this many seconds of current production value. */
  goldenValueSec: 240,
  goldenMinCredits: 5000,
  /** Wormholes take this share of Prospectors (at least 5). */
  wormholeDrones: 0.05,
  leviathanSd: 100,
};

/** Silent Beacon fragments. {ship} is replaced with the player's ship name. */
export const BEACON_LORE = [
  '…CARRIER 7.2 GHz… FOLD MARKER… DO NOT… ACKNOWLEDGE…',
  '…NAVIGATION LOCK FOR VESSEL… CLASS: FOLD… COUNT: [CORRUPTED]…',
  '…{ship}, THIS IS {ship}. IF YOU ARE RECEIVING THIS, THE DRIVE HAS ALREADY…',
  '…EVERY JUMP IS THE SAME JUMP. THE CREW REMEMBERS. THE HULL DOES NOT…',
  '…DO NOT TRUST HALE. DO NOT FEED THE CORE. FIND THE JACKAL. HE WAS ONE OF US…',
];

/** Codex sets: discovering every anomaly in a set grants a permanent bonus. */
export const CODEX_SETS: { id: string; name: string; kinds: AnomalyKind[]; bonus: string; production: number; surveyData: number }[] = [
  { id: 'home', name: 'Home Reach Survey', kinds: ['gravity_lens', 'derelict', 'silent_beacon'], bonus: '+5% all production', production: 0.05, surveyData: 0 },
  { id: 'passing', name: 'Passing Wonders', kinds: ['comet', 'golden_asteroid', 'wormhole', 'ghost_signal'], bonus: '+10% Survey Data', production: 0, surveyData: 0.1 },
  { id: 'deep', name: 'Deep Mysteries', kinds: ['crystal_bloom', 'frozen_battlefield', 'leviathan'], bonus: '+10% all production, +10% Survey Data', production: 0.1, surveyData: 0.1 },
];
