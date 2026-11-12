/**
 * Zone names for generated sectors: a word themed on the zone's ore plus a feature ("Rime Shoals",
 * "Cobalt Narrows"). A save never repeats a name until every name in the pool has been used.
 */
import { ORES, OreId } from './config';
import { Rng } from './rng';
import { GameState } from './types';

/** [English, kana] per ore theme: rusty for Ferrite, icy for Helium-3, dark for Voidglass... */
const WORDS: Record<OreId, [string, string][]> = {
  ferrite: [
    ['Rust', 'さび'], ['Cinder', 'もえがら'], ['Iron', 'くろがね'], ['Slag', 'かなくそ'],
    ['Ochre', 'おうど'], ['Anvil', 'かなとこ'], ['Forge', 'かじ'], ['Scoria', 'スコリア'],
  ],
  titanite: [
    ['Cobalt', 'コバルト'], ['Steel', 'はがね'], ['Pewter', 'しろめ'], ['Slate', 'スレート'],
    ['Azure', 'あお'], ['Gunmetal', 'ガンメタル'], ['Tinsmith', 'すず'], ['Quartz', 'せきえい'],
  ],
  iridium: [
    ['Silver', 'ぎん'], ['Argent', 'アージェント'], ['Mirror', 'かがみ'], ['Halo', 'ひかりのわ'],
    ['Pearl', 'しんじゅ'], ['Platinum', 'はっきん'], ['Lustre', 'つや'], ['Moonlit', 'つきあかり'],
  ],
  helium3: [
    ['Rime', 'むひょう'], ['Frost', 'しも'], ['Glacier', 'ひょうが'], ['Hoarfrost', 'じゅひょう'],
    ['Snowfall', 'ゆき'], ['Boreal', 'きた'], ['Icefall', 'こおり'], ['Winter', 'ふゆ'],
  ],
  voidglass: [
    ['Void', 'こくう'], ['Obsidian', 'こくようせき'], ['Umbral', 'かげ'], ['Nightglass', 'よるガラス'],
    ['Eclipse', 'しょく'], ['Hollow', 'うつろ'], ['Abyssal', 'しんえん'], ['Shade', 'やみ'],
  ],
};

const FEATURES: [string, string][] = [
  ['Belt', 'たい'], ['Drift', 'りゅう'], ['Shoals', 'あさせ'], ['Reef', 'しょう'], ['Expanse', 'ひろがり'],
  ['Reach', 'かいいき'], ['Spur', 'みさき'], ['Lanes', 'こうろ'], ['Field', 'げん'], ['Cluster', 'ぐん'],
  ['Shelf', 'だな'], ['Narrows', 'せと'], ['Veil', 'とばり'], ['Arc', 'こ'], ['Gyre', 'うず'],
];

export interface ZoneName {
  name: string;
  kana: string;
}

function namesFor(ore: OreId): ZoneName[] {
  return WORDS[ore].flatMap(([w, wk]) => FEATURES.map(([f, fk]) => ({ name: `${w} ${f}`, kana: `${wk}の${fk}` })));
}

/** Every name in the pool (600). */
export const ALL_ZONE_NAMES: readonly ZoneName[] = ORES.flatMap((o) => namesFor(o.id));

/** The ore a zone's name is themed on: its most valuable ore with a real share, else its main ore. */
export function themeOre(comp: Partial<Record<OreId, number>>): OreId {
  const rich = [...ORES].reverse().find((o) => (comp[o.id] ?? 0) >= 0.25);
  if (rich) return rich.id;
  let best: OreId = 'ferrite';
  for (const o of ORES) if ((comp[o.id] ?? 0) > (comp[best] ?? 0)) best = o.id;
  return best;
}

/**
 * Picks a fresh name for each zone of the current sector and records them on the save.
 * Names already used in this save are skipped; once the whole pool is used, it starts over.
 */
export function assignZoneNames(state: GameState, zones: readonly { composition: Partial<Record<OreId, number>> }[]): ZoneName[] {
  let used = new Set(state.zoneNamesUsed ?? []);
  const rng = new Rng(state.rng);
  const out: ZoneName[] = [];
  for (const z of zones) {
    const taken = (n: ZoneName) => used.has(n.name) || out.some((o) => o.name === n.name);
    let pool = namesFor(themeOre(z.composition)).filter((n) => !taken(n));
    if (!pool.length) pool = ALL_ZONE_NAMES.filter((n) => !taken(n));
    if (!pool.length) {
      // Every name has been used: start the pool over (still no repeats within this sector).
      used = new Set();
      pool = namesFor(themeOre(z.composition)).filter((n) => !taken(n));
    }
    const pick = pool[Math.floor(rng.next() * pool.length)];
    out.push(pick);
    used.add(pick.name);
  }
  state.rng = rng.state;
  for (const o of out) used.add(o.name);
  state.zoneNamesUsed = [...used];
  state.sector.zoneNames = out.map((n) => [n.name, n.kana]);
  return out;
}
