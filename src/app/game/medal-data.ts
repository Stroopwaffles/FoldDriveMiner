/**
 * Commendations: ribbon/medal achievements in eight categories. Each grants a
 * small permanent bonus and survives Fold Jumps.
 */
import { GameState } from './types';

export type MedalCategory = 'mining' | 'fleet' | 'pilots' | 'exploration' | 'combat' | 'commerce' | 'story' | 'secret';
export type BonusKind = 'production' | 'drill' | 'sell' | 'research' | 'xp';

export interface MedalDef {
  id: string;
  name: string;
  category: MedalCategory;
  desc: string;
  bonus: { kind: BonusKind; amount: number };
  /** Hidden until earned. */
  secret?: boolean;
  check: (s: GameState) => boolean;
}

export const CATEGORIES: { id: MedalCategory; name: string; kana: string; color: string }[] = [
  { id: 'mining', name: 'Mining', kana: 'さいくつ', color: '#ff7a3d' },
  { id: 'fleet', name: 'Fleet', kana: 'かんたい', color: '#4fe3ff' },
  { id: 'pilots', name: 'Pilots', kana: 'パイロット', color: '#ff5fa2' },
  { id: 'exploration', name: 'Exploration', kana: 'たんさ', color: '#6dff9b' },
  { id: 'combat', name: 'Combat', kana: 'せんとう', color: '#ff3b3b' },
  { id: 'commerce', name: 'Commerce', kana: 'しょうぎょう', color: '#ffd23f' },
  { id: 'story', name: 'Story', kana: 'ものがたり', color: '#c77dff' },
  { id: 'secret', name: 'Secret', kana: 'ひみつ', color: '#e8ecff' },
];

export const BONUS_LABEL: Record<BonusKind, string> = {
  production: 'production',
  drill: 'drill power',
  sell: 'sell prices',
  research: 'research speed',
  xp: 'pilot XP',
};

const sum = (o: Record<string, number | undefined>) => Object.values(o).reduce<number>((a, b) => a + (b ?? 0), 0);
const fmt = (n: number) => (n >= 1e12 ? `${n / 1e12}T` : n >= 1e9 ? `${n / 1e9}B` : n >= 1e6 ? `${n / 1e6}M` : n >= 1e3 ? `${n / 1e3}K` : `${n}`);

/** Builds one tiered family: the same check against rising thresholds. */
function tiers(
  key: string,
  category: MedalCategory,
  names: string[],
  thresholds: number[],
  value: (s: GameState) => number,
  desc: (n: string) => string,
  bonus: { kind: BonusKind; amount: number },
): MedalDef[] {
  return thresholds.map((t, i) => ({
    id: `${key}_${i + 1}`,
    name: names[i],
    category,
    desc: desc(fmt(t)),
    bonus,
    check: (s: GameState) => value(s) >= t,
  }));
}

const P = (amount: number) => ({ kind: 'production' as const, amount });
const D = (amount: number) => ({ kind: 'drill' as const, amount });
const S = (amount: number) => ({ kind: 'sell' as const, amount });
const R = (amount: number) => ({ kind: 'research' as const, amount });
const X = (amount: number) => ({ kind: 'xp' as const, amount });

export const MEDALS: readonly MedalDef[] = [
  // Mining
  ...tiers('ore', 'mining', ['Rock Hound', 'Seam Chaser', 'Belt Breaker', 'Core Cutter', 'Moon Eater', 'Star Miner'],
    [1e3, 1e5, 1e7, 1e9, 1e11, 1e13], (s) => s.stats.oreMined, (n) => `Mine ${n} t of ore.`, P(0.01)),
  ...tiers('crack', 'mining', ['First Crack', 'Rubblemaker', 'Asteroid Breaker', 'Field Clearer'],
    [10, 100, 1000, 10000], (s) => s.stats.asteroidsCracked, (n) => `Crack ${n} asteroids.`, D(0.02)),
  ...tiers('overdrive', 'mining', ['Cool Head', 'Steady Rhythm', 'Ice in the Veins'],
    [100, 1000, 10000], (s) => s.stats.overdriveClicks, (n) => `Drill ${n} times in Overdrive.`, D(0.02)),
  ...tiers('click', 'mining', ['Trigger Finger', 'Iron Wrist', 'Ten Thousand Taps'],
    [1000, 10000, 100000], (s) => s.stats.clicks, (n) => `Drill ${n} times by hand.`, D(0.02)),
  ...tiers('ingot', 'mining', ['Smelter', 'Foundry Hand', 'Forge Master'],
    [100, 1e4, 1e6], (s) => s.stats.ingotsRefined, (n) => `Refine ${n} ingots.`, S(0.01)),
  // Fleet
  ...tiers('drones', 'fleet', ['Swarm Seed', 'Hive Keeper', 'Cloud Commander', 'Flock Admiral', 'Living Nebula'],
    [10, 100, 500, 2000, 10000], (s) => sum(s.drones), (n) => `Command ${n} drones at once.`, P(0.01)),
  ...tiers('mechs', 'fleet', ['First Frame', 'Hangar Full', 'Mech Foundry'],
    [1, 5, 15], (s) => s.stats.mechsBuilt, (n) => `Build ${n} mechs.`, P(0.01)),
  {
    id: 'all_drones', name: 'Full Spectrum', category: 'fleet', desc: 'Own every kind of drone at once.', bonus: P(0.02),
    check: (s) => Object.values(s.drones).every((n) => n > 0),
  },
  // Pilots
  ...tiers('level', 'pilots', ['Wings', 'Veteran', 'Living Legend'],
    [10, 25, 50], (s) => Math.max(0, ...s.pilots.map((p) => p.level)), (n) => `Raise a pilot to level ${n}.`, X(0.03)),
  ...tiers('roster', 'pilots', ['Full Mess Hall', 'Crowded Corridors'],
    [6, 10], (s) => s.pilots.length, (n) => `Have ${n} pilots on the roster.`, X(0.02)),
  ...tiers('bonds', 'pilots', ['Tight Crew', 'Found Family'],
    [2, 5], (s) => s.bonds.length, (n) => `Form ${n} pilot bonds.`, X(0.02)),
  {
    id: 'story_crew', name: 'The Anchors', category: 'pilots', desc: 'Have all four story pilots aboard.', bonus: X(0.05),
    check: (s) => ['juno', 'kit', 'saffi', 'ansel'].every((k) => s.pilots.some((p) => p.story === k)),
  },
  {
    id: 'sync5', name: 'Perfect Sync', category: 'pilots', desc: 'Reach Sync 5 with any frame and unlock a Special Technique.', bonus: X(0.03),
    check: (s) => s.pilots.some((p) => Object.values(p.sync).some((v) => v >= 5)),
  },
  // Exploration
  ...tiers('codex', 'exploration', ['Curious', 'Cataloguer', 'Codex Keeper'],
    [3, 6, 10], (s) => Object.keys(s.anomalies.codex).length, (n) => `Identify ${n} kinds of anomaly.`, R(0.02)),
  ...tiers('lore', 'exploration', ['Static Listener', 'Signal Reader', 'Beacon Whisperer'],
    [1, 3, 5], (s) => s.anomalies.lore, (n) => `Decode ${n} Silent Beacon fragments.`, R(0.02)),
  ...tiers('scans', 'exploration', ['Surveyor', 'Deep Scanner', 'Eye of the Frontier'],
    [10, 50, 200], (s) => sum(s.anomalies.codex), (n) => `Identify ${n} anomalies.`, R(0.02)),
  ...tiers('sectors', 'exploration', ['Wanderer', 'Pathfinder', 'Cartographer', 'Lost in Space'],
    [2, 5, 10, 20], (s) => s.story.logbook.length, (n) => `Visit ${n} sectors.`, P(0.01)),
  ...tiers('depth', 'exploration', ['Deep Runner', 'Abyss Diver', 'Edge of the Map'],
    [3, 6, 10], (s) => s.sector.depth, (n) => `Reach sector depth ${n}.`, P(0.01)),
  // Combat
  ...tiers('raids', 'combat', ['First Blood', 'Defender', 'Bulwark of the Belt', 'Pirate Bane'],
    [1, 10, 50, 200], (s) => s.threats.raidsWon, (n) => `Win ${n} raid defenses.`, X(0.02)),
  ...tiers('jackal', 'combat', ['Jackal Hunter', 'Vermilion Nemesis'],
    [1, 5], (s) => s.threats.jackalDefeats, (n) => `Defeat the Vermilion Jackal ${n} time(s).`, X(0.03)),
  ...tiers('strikes', 'combat', ['Raider Raider', 'Base Breaker'],
    [1, 5], (s) => s.threats.strikesWon, (n) => `Win ${n} strike(s) on the pirate base.`, X(0.02)),
  // Commerce
  ...tiers('credits', 'commerce', ['Pocket Money', 'Going Concern', 'Ore Baron', 'Belt Magnate', 'Sector Tycoon', 'Galactic Fortune'],
    [1e4, 1e6, 1e8, 1e10, 1e12, 1e14], (s) => s.stats.creditsEarned, (n) => `Earn ${n} credits in total.`, S(0.01)),
  ...tiers('contracts', 'commerce', ['Signed', 'Reliable Supplier', 'Preferred Vendor'],
    [1, 10, 50], (s) => s.contracts.completed, (n) => `Complete ${n} contract(s).`, S(0.01)),
  ...tiers('convoys', 'commerce', ['Open for Business', 'Convoy Regular'],
    [5, 25], (s) => s.trade.visits, (n) => `Host ${n} merchant convoys.`, S(0.01)),
  {
    id: 'partner', name: 'Trusted Partner', category: 'commerce', desc: 'Reach Partner reputation with a merchant clan.', bonus: S(0.02),
    check: (s) => Object.values(s.trade.rep).some((r) => r >= 30),
  },
  // Story
  ...tiers('episodes', 'story', ['Pilot Episode', 'Season Regular', 'Signal Chaser', 'Series Finale'],
    [4, 8, 17, 26], (s) => s.story.watched, (n) => `Watch ${n} episodes.`, R(0.02)),
  ...tiers('jumps', 'story', ['Folded', 'Frequent Folder', 'Loop Veteran', 'Recursion', 'Eternal Return'],
    [1, 3, 5, 10, 25], (s) => s.fold.jumps, (n) => `Make ${n} Fold Jump(s).`, P(0.02)),
  {
    id: 'finale', name: 'The Choice', category: 'story', desc: 'Decide the fate of the cycle.', bonus: P(0.03),
    check: (s) => s.story.choice !== null,
  },
  {
    id: 'deep_fold', name: 'Into the Deep', category: 'story', desc: 'Make a Deep Fold.', bonus: P(0.03),
    check: (s) => (s.fold.deepFolds ?? 0) >= 1,
  },
  {
    id: 'side', name: 'Between Episodes', category: 'story', desc: 'Watch 3 side stories.', bonus: R(0.02),
    check: (s) => s.story.sideWatched >= 3,
  },
  // Secret
  { id: 'overheat', name: 'Meltdown Enthusiast', category: 'secret', secret: true, desc: 'Overheat the drill 100 times.', bonus: D(0.03), check: (s) => s.stats.overheats >= 100 },
  { id: 'spilled', name: 'Spilled Cargo', category: 'secret', secret: true, desc: 'Lose 1M t of ore to a full hold.', bonus: P(0.02), check: (s) => s.stats.oreLost >= 1e6 },
  { id: 'marathon', name: 'Long Haul', category: 'secret', secret: true, desc: 'Play for 24 hours in total.', bonus: P(0.02), check: (s) => s.playtimeSec >= 86400 },
  { id: 'hoarder', name: 'Core Hoarder', category: 'secret', secret: true, desc: 'Hold 25 Data Cores at once.', bonus: R(0.03), check: (s) => s.dataCores >= 25 },
];

export function medalDef(id: string): MedalDef | undefined {
  return MEDALS.find((m) => m.id === id);
}
