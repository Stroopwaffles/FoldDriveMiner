/**
 * Sector generation data: star types, ore profiles, sector traits and name
 * pools. A sector = one run (the Fold Jump in Milestone 6 moves between them).
 */
import { OreId } from './config';
import { EventKind } from './threat-data';

export type StarId = 'red_dwarf' | 'yellow' | 'blue_giant' | 'pulsar' | 'nebula' | 'black_hole' | 'binary';

/** Everything a sector can change. Multipliers default to 1, additions to 0. */
export interface SectorMods {
  droneOutput: number;
  clickPower: number;
  asteroidMass: number;
  crackBonus: number;
  refinerySpeed: number;
  sellPrice: number;
  marketAmp: number;
  offlineBonus: number;
  eventInterval: number;
  eventWeights: Partial<Record<EventKind, number>>;
  anomalyChance: number;
  scanSpeed: number;
  heatPerClick: number;
  overdriveBonus: number;
  /** Pulsar: production surges ×2 for 30 s in every 180 s. */
  pulsar: boolean;
}

export const NEUTRAL_MODS: SectorMods = {
  droneOutput: 1,
  clickPower: 1,
  asteroidMass: 1,
  crackBonus: 1,
  refinerySpeed: 1,
  sellPrice: 1,
  marketAmp: 1,
  offlineBonus: 0,
  eventInterval: 1,
  eventWeights: {},
  anomalyChance: 1,
  scanSpeed: 1,
  heatPerClick: 1,
  overdriveBonus: 0,
  pulsar: false,
};

export interface StarDef {
  id: StarId;
  name: string;
  kana: string;
  /** Sun colour for the map and viewport. */
  color: string;
  desc: string;
  minDepth: number;
  weight: number;
  mods: Partial<SectorMods>;
}

export const STARS: readonly StarDef[] = [
  { id: 'yellow', name: 'Yellow main-sequence', kana: 'きいろわいせい', color: '#ffd23f', desc: 'Balanced. No surprises.', minDepth: 0, weight: 3, mods: {} },
  { id: 'red_dwarf', name: 'Red dwarf', kana: 'あかいわいせい', color: '#ff6a3d', desc: 'Calm and dim: fewer events, drones −15%.', minDepth: 1, weight: 3, mods: { eventInterval: 1.4, droneOutput: 0.85 } },
  { id: 'blue_giant', name: 'Blue giant', kana: 'あおいきょせい', color: '#7ad7ff', desc: 'Harsh light: refinery +50% speed, solar flares ×3.', minDepth: 1, weight: 2, mods: { refinerySpeed: 1.5, eventWeights: { flare: 3 } } },
  { id: 'pulsar', name: 'Pulsar', kana: 'パルサー', color: '#c9b8ff', desc: 'Rhythmic: production surges ×2 for 30 s every 3 minutes.', minDepth: 1, weight: 2, mods: { pulsar: true } },
  { id: 'nebula', name: 'Nebula', kana: 'せいうん', color: '#ff7ad9', desc: 'Murky: anomalies ×2, scans 50% slower.', minDepth: 1, weight: 2, mods: { anomalyChance: 2, scanSpeed: 0.67 } },
  { id: 'black_hole', name: 'Black hole', kana: 'ブラックホール', color: '#b07aff', desc: 'Time bends: offline +25%, clicks −25%, Voidglass in the deep field.', minDepth: 3, weight: 1, mods: { offlineBonus: 0.25, clickPower: 0.75 } },
  { id: 'binary', name: 'Binary system', kana: 'れんせい', color: '#ffb547', desc: 'Two stars: both sets of effects apply.', minDepth: 2, weight: 0.6, mods: {} },
];

export interface ProfileDef {
  id: string;
  name: string;
  desc: string;
  /** Weight multipliers applied to each zone's ore mix. */
  shift: Partial<Record<OreId, number>>;
  mods: Partial<SectorMods>;
}

export const PROFILES: readonly ProfileDef[] = [
  { id: 'balanced', name: 'Balanced field', desc: 'A typical mix.', shift: {}, mods: {} },
  { id: 'titanite', name: 'Titanite-heavy', desc: 'Titanite everywhere.', shift: { titanite: 2.2 }, mods: {} },
  { id: 'iridium', name: 'Iridium veins', desc: 'Rich Iridium seams.', shift: { iridium: 2.2, ferrite: 0.7 }, mods: {} },
  { id: 'helium', name: 'Helium-3 ice belts', desc: 'Ice-rich: Helium-3 charges the Fold Drive fast.', shift: { helium3: 2.5 }, mods: {} },
  { id: 'poor', name: 'Poor field', desc: 'Thin pickings (drones −30%), but anomalies ×1.5.', shift: {}, mods: { droneOutput: 0.7, anomalyChance: 1.5 } },
];

export interface SectorTraitDef {
  id: string;
  name: string;
  desc: string;
  polarity: 'good' | 'bad' | 'mixed';
  minDepth: number;
  weight: number;
  mods: Partial<SectorMods>;
}

export const SECTOR_TRAITS: readonly SectorTraitDef[] = [
  { id: 'dense_field', name: 'Dense Field', desc: 'Asteroids have 2× mass; cracking pays 1.5×.', polarity: 'mixed', minDepth: 1, weight: 2, mods: { asteroidMass: 2, crackBonus: 1.5 } },
  { id: 'pirate_haven', name: 'Pirate Haven', desc: 'Raids twice as likely. The Lantern Market trades here.', polarity: 'bad', minDepth: 1, weight: 2, mods: { eventWeights: { raid: 2 } } },
  { id: 'ion_storms', name: 'Ion Storms', desc: 'Clicks −30%, drones +40%.', polarity: 'mixed', minDepth: 1, weight: 2, mods: { clickPower: 0.7, droneOutput: 1.4 } },
  { id: 'trade_hub', name: 'Trade Hub Nearby', desc: 'Prices +10%, but they swing 50% harder.', polarity: 'good', minDepth: 1, weight: 2, mods: { sellPrice: 1.1, marketAmp: 1.5 } },
  { id: 'micrometeor_swarm', name: 'Micrometeor Swarm', desc: 'Micrometeor storms ×3; ore sells for 25% more.', polarity: 'mixed', minDepth: 2, weight: 1.5, mods: { eventWeights: { micrometeor: 3 }, sellPrice: 1.25 } },
  { id: 'ancient_marker', name: 'Ancient Survey Marker', desc: 'One fixed anomaly is guaranteed Rare or better.', polarity: 'good', minDepth: 2, weight: 1, mods: {} },
  { id: 'gravity_shear', name: 'Gravity Shear', desc: 'Heat builds 50% faster; Overdrive hits +1× harder.', polarity: 'mixed', minDepth: 2, weight: 1.5, mods: { heatPerClick: 1.5, overdriveBonus: 1 } },
];

export const SECTOR_NAMES = [
  'Veil of Kestrel', 'Crimson Halo', 'Quiet Drift', 'Ion Tempest', 'Glass Reef', 'Cinder Reach', 'Lantern Deep',
  'Saint Ilse Expanse', 'Hollow Crown', 'Orrery Gap', 'Tidewater Belt', 'Ember Shoals', 'Pale Lattice', 'Wolf\'s Margin',
  'Silver Maw', 'Distant Choir', 'Ashfall Ring', 'Mirror Basin', 'Vesper\'s Rest', 'Thornfield',
];

export const ZONE_NAMES = [
  ['Inner Belt', 'ないそくたい'], ['Trojan Cluster', 'トロヤぐん'], ['Ring Debris', 'リングのはへん'], ['Ice Halo', 'こおりのわ'],
  ['Deep Field', 'しんえん'], ['Cinder Belt', 'もえがらたい'], ['Glass Reef', 'ガラスしょう'], ['Shepherd Moons', 'ひつじかいえいせい'],
  ['Kuiper Drift', 'カイパーりゅう'], ['Ashen Arc', 'はいのこ'], ['Hollow Spires', 'うつろのとう'], ['Frost Lanes', 'しもじ'],
] as const;

/** Survey research that unlocks a sector's 2nd–5th zone. */
export const ZONE_RESEARCH = [undefined, 'survey_trojan', 'survey_ring', 'survey_ice', 'survey_deep'] as const;

/** Base ore mix for zones by depth index, before profile shifts. */
export const ZONE_TEMPLATES: Partial<Record<OreId, number>>[] = [
  { ferrite: 0.85, titanite: 0.15 },
  { ferrite: 0.55, titanite: 0.35, iridium: 0.1 },
  { ferrite: 0.3, titanite: 0.4, iridium: 0.3 },
  { titanite: 0.25, iridium: 0.35, helium3: 0.4 },
  { iridium: 0.35, helium3: 0.45, voidglass: 0.2 },
];

export const ZONE_MASS = [1, 2.5, 5, 10, 20];
export const ZONE_SURVEY = [1, 2, 4, 8, 16];
