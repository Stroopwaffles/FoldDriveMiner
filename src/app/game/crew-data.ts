/**
 * Crew tuning data: pilot stats, backgrounds, traits, station posts,
 * name pools and the hand-written story pilots.
 */
import { FrameId } from './fleet-data';

export type StatId = 'piloting' | 'prospecting' | 'engineering' | 'instinct' | 'nerve';
export type PostId = 'refinery' | 'repair' | 'sensor' | 'quartermaster' | 'instructor' | 'science';
export type BackgroundId = 'ace' | 'rookie' | 'engineer' | 'prospector' | 'ex_pirate' | 'scholar' | 'trader';

export const STATS: { id: StatId; name: string; short: string; desc: string }[] = [
  { id: 'piloting', name: 'Piloting', short: 'PIL', desc: 'Combat and evasion in sorties (Milestone 4)' },
  { id: 'prospecting', name: 'Prospecting', short: 'PRO', desc: '+2% mech mining output per point' },
  { id: 'engineering', name: 'Engineering', short: 'ENG', desc: 'Lowers part power draw and mech wear' },
  { id: 'instinct', name: 'Instinct', short: 'INS', desc: 'Survey Data, research and scanning' },
  { id: 'nerve', name: 'Nerve', short: 'NRV', desc: 'Haggling now; mission risk later' },
];

export const STAT_IDS: readonly StatId[] = STATS.map((s) => s.id);

export interface BackgroundDef {
  id: BackgroundId;
  name: string;
  /** Starting stats. */
  base: Record<StatId, number>;
  /** Stat growth per level. */
  growth: Record<StatId, number>;
  /** Traits this background tends to roll. */
  traitBias: string[];
}

const S = (piloting: number, prospecting: number, engineering: number, instinct: number, nerve: number) => ({
  piloting, prospecting, engineering, instinct, nerve,
});

export const BACKGROUNDS: readonly BackgroundDef[] = [
  { id: 'ace', name: 'Ace', base: S(16, 8, 6, 9, 12), growth: S(1.4, 0.6, 0.4, 0.7, 1), traitBias: ['hot_blooded', 'steady_hands'] },
  { id: 'rookie', name: 'Rookie', base: S(6, 6, 6, 6, 6), growth: S(1.2, 1.2, 1.2, 1.2, 1.2), traitBias: ['green', 'quick_learner'] },
  { id: 'engineer', name: 'Engineer', base: S(6, 7, 16, 9, 7), growth: S(0.5, 0.6, 1.4, 0.8, 0.6), traitBias: ['grease_monkey'] },
  { id: 'prospector', name: 'Prospector', base: S(7, 16, 8, 9, 7), growth: S(0.6, 1.4, 0.6, 0.8, 0.6), traitBias: ['steady_hands', 'night_owl'] },
  { id: 'ex_pirate', name: 'Ex-Pirate', base: S(13, 7, 8, 8, 14), growth: S(1.1, 0.6, 0.6, 0.7, 1.1), traitBias: ['reckless', 'hot_blooded'] },
  { id: 'scholar', name: 'Scholar', base: S(5, 7, 9, 16, 6), growth: S(0.5, 0.6, 0.8, 1.4, 0.5), traitBias: ['bookworm'] },
  { id: 'trader', name: 'Trader', base: S(6, 8, 7, 10, 14), growth: S(0.5, 0.7, 0.6, 0.9, 1.3), traitBias: ['silver_tongued'] },
];

export function backgroundDef(id: BackgroundId): BackgroundDef {
  return BACKGROUNDS.find((b) => b.id === id)!;
}

export interface TraitDef {
  id: string;
  name: string;
  desc: string;
  /** Effects that only matter once later systems exist. */
  later?: string;
  /** Rookie-only weakness removed at this level. */
  removedAt?: number;
}

export const TRAITS: readonly TraitDef[] = [
  { id: 'steady_hands', name: 'Steady Hands', desc: '+10% mech mining output' },
  { id: 'silver_tongued', name: 'Silver-Tongued', desc: 'Quartermaster bonus ×1.5' },
  { id: 'night_owl', name: 'Night Owl', desc: '+5% offline efficiency while on duty' },
  { id: 'quick_learner', name: 'Quick Learner', desc: '+25% XP' },
  { id: 'grease_monkey', name: 'Grease Monkey', desc: '+25% Repair Chief bonus, −25% mech wear' },
  { id: 'bookworm', name: 'Bookworm', desc: 'Science Officer bonus ×1.5' },
  { id: 'hot_blooded', name: 'Hot-Blooded', desc: '+15% mech mining, +20% mech wear', later: 'Combat bonus in sorties (Milestone 4)' },
  { id: 'reckless', name: 'Reckless', desc: 'Bigger mission rewards, higher risk', later: 'Milestone 4' },
  { id: 'lucky', name: 'Lucky', desc: 'Small chance to turn a failed mission into a success', later: 'Milestone 4' },
  { id: 'green', name: 'Green', desc: '−20% to all stats. Fades at level 10.', removedAt: 10 },
];

export function traitDef(id: string): TraitDef {
  return TRAITS.find((t) => t.id === id)!;
}

/** Traits offered at level-up choices (never Green). */
export const CHOOSABLE_TRAITS = TRAITS.filter((t) => t.id !== 'green').map((t) => t.id);

export interface PostDef {
  id: PostId;
  name: string;
  kana: string;
  stat: StatId;
  /** Bonus per stat point, and its cap. */
  perPoint: number;
  cap: number;
  desc: string;
}

export const POSTS: readonly PostDef[] = [
  { id: 'refinery', name: 'Refinery Overseer', kana: 'せいれん', stat: 'engineering', perPoint: 0.01, cap: 0.4, desc: 'Faster refinery batches' },
  { id: 'repair', name: 'Repair Chief', kana: 'しゅうり', stat: 'engineering', perPoint: 0.03, cap: 1.5, desc: 'Faster mech repairs' },
  { id: 'sensor', name: 'Sensor Officer', kana: 'センサー', stat: 'instinct', perPoint: 0.02, cap: 0.8, desc: 'More Survey Data from every source' },
  { id: 'quartermaster', name: 'Quartermaster', kana: 'ほきゅう', stat: 'nerve', perPoint: 0.005, cap: 0.15, desc: 'Better sell prices' },
  { id: 'instructor', name: 'Flight Instructor', kana: 'きょうかん', stat: 'piloting', perPoint: 0.01, cap: 0.5, desc: 'More XP for every other pilot' },
  { id: 'science', name: 'Science Officer', kana: 'かがく', stat: 'instinct', perPoint: 0.01, cap: 0.3, desc: 'Faster research, more EUREKAs' },
];

export const POST_IDS: readonly PostId[] = POSTS.map((p) => p.id);

export function postDef(id: PostId): PostDef {
  return POSTS.find((p) => p.id === id)!;
}

export const CREW = {
  baseRoster: 4,
  rosterPerLevel: 2,
  levelCap: 50,
  /** XP per second while mining in a mech, and while on a station post. */
  xpMining: 1,
  xpPost: 0.5,
  xpIdle: 0,
  /** Cumulative seconds in a frame type needed for Sync 1–5. */
  syncThresholds: [600, 1800, 5400, 14400, 36000],
  /** Pilot output bonus per Sync level. */
  syncBonus: 0.05,
  levelBonus: 0.01,
  prospectingBonus: 0.02,
  /** Engineering reduces part draw and wear by this per point (capped). */
  engineeringDrawCut: 0.01,
  engineeringDrawCap: 0.3,
  traitEvery: 10,
  recruitCount: 3,
  recruitRefreshSec: 1200,
  hireBaseCost: 5000,
  hireCostGrowth: 1.6,
  rerollCost: 1000,
};

export function xpForLevel(level: number): number {
  return Math.round(60 * level ** 1.6);
}

// ---------------------------------------------------------------- names

export const GIVEN_NAMES = [
  'Aiko', 'Bram', 'Cass', 'Dmitri', 'Esme', 'Faro', 'Gale', 'Hana', 'Ivo', 'Jun', 'Kaz', 'Lena', 'Mako',
  'Nils', 'Oriel', 'Pax', 'Quinn', 'Remy', 'Sora', 'Tavi', 'Uma', 'Vex', 'Wren', 'Yuri', 'Zed', 'Ines', 'Theo', 'Noor',
];
export const SURNAMES = [
  'Arden', 'Brask', 'Calloway', 'Dorne', 'Everly', 'Fuse', 'Grail', 'Hollis', 'Ishida', 'Juarez', 'Kade', 'Lorne',
  'Mbeki', 'Novak', 'Oduya', 'Price', 'Quill', 'Rask', 'Sato', 'Thorne', 'Ueda', 'Valdis', 'Wyke', 'Yarrow',
];
export const CALLSIGNS = [
  'Ghost', 'Torch', 'Bishop', 'Kite', 'Rivet', 'Static', 'Mantis', 'Flare', 'Echo', 'Sable', 'Nova', 'Cinder',
  'Halo', 'Jinx', 'Vandal', 'Magpie', 'Tempest', 'Lynx', 'Ember', 'Patch',
];

// ---------------------------------------------------------------- story pilots

export interface StoryPilot {
  story: string;
  name: string;
  callsign: string;
  background: BackgroundId;
  traits: string[];
  portraitSeed: number;
  /** Signature technique names per frame. */
  moves?: Partial<Record<FrameId, string>>;
}

export const STORY_PILOTS: Record<string, StoryPilot> = {
  juno: {
    story: 'juno',
    name: 'Juno Hart',
    callsign: 'Redline',
    background: 'ace',
    traits: ['hot_blooded', 'steady_hands'],
    portraitSeed: 1,
    moves: { pickaxe: 'Burning Redline Breaker', kestrel: 'Redline Comet Dive', bulwark: 'Redline Rampart' },
  },
  kit: {
    story: 'kit',
    name: 'Kit Okafor',
    callsign: 'Wrench',
    background: 'engineer',
    traits: ['grease_monkey', 'quick_learner'],
    portraitSeed: 2,
    moves: { pickaxe: 'Full-Torque Overhaul', kestrel: 'Sparkplug Sprint', bulwark: 'Bolt-Down Bastion' },
  },
};
