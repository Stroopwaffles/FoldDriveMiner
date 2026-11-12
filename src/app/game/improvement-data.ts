/**
 * Sector improvements: facilities the corporations pay you to build in a sector, out of ingots and
 * alloys. Each gives a sector-wide bonus for as long as you stay in that sector.
 */
import type { AlloyId } from './alloy-data';
import type { OreId } from './config';
import type { CorpId } from './trade-data';

export type ImprovementId =
  | 'mining_station'
  | 'refinery_annex'
  | 'fusion_plant'
  | 'fuel_depot'
  | 'sensor_relay'
  | 'research_lab'
  | 'defense_platform'
  | 'habitat_dome'
  | 'spaceport'
  | 'terraform_array';

/** What an improvement boosts in its sector. */
export type ImprovementKind = 'production' | 'refinery' | 'research' | 'scan' | 'survey' | 'raids' | 'sell' | 'convoys' | 'fuel';

export interface ImprovementDef {
  id: ImprovementId;
  name: string;
  kana: string;
  /** Corporations that commission it. */
  corps: CorpId[];
  /** 1: ingots only · 2: ingots and a simple alloy · 3: advanced alloys. */
  tier: 1 | 2 | 3;
  /** Materials, in "units" (one unit is about a furnace batch of ingots). */
  ingots: Partial<Record<OreId, number>>;
  alloys: Partial<Record<AlloyId, number>>;
  /** Sector-wide bonuses while you stay here (0.2 = +20%; for raids, 20% weaker). */
  bonus: Partial<Record<ImprovementKind, number>>;
  effect: string;
}

export const IMPROVEMENTS: readonly ImprovementDef[] = [
  {
    id: 'mining_station', name: 'Mining Station', kana: 'さいくつきち', corps: ['meridian'], tier: 1,
    ingots: { ferrite: 3, titanite: 2 }, alloys: {}, bonus: { production: 0.2 },
    effect: '+20% ore from drones and mechs in this sector',
  },
  {
    id: 'refinery_annex', name: 'Refinery Annex', kana: 'せいれんべっかん', corps: ['meridian'], tier: 2,
    ingots: { titanite: 3 }, alloys: { duralloy: 1 }, bonus: { refinery: 0.5 },
    effect: 'Furnaces and the forge work 50% faster in this sector',
  },
  {
    id: 'fusion_plant', name: 'Fusion Plant', kana: 'かくゆうごうろ', corps: ['aster_lune'], tier: 2,
    ingots: { iridium: 3 }, alloys: { cryoplate: 1 }, bonus: { production: 0.15, fuel: 0.15 },
    effect: '+15% ore output and +15% Fold Drive charge efficiency in this sector',
  },
  {
    id: 'fuel_depot', name: 'Helium Fuel Depot', kana: 'ねんりょうこ', corps: ['aster_lune'], tier: 3,
    // Helium-3 and Cryoplate only, so it can be built in sectors with no Voidglass.
    ingots: { helium3: 4, iridium: 2 }, alloys: { cryoplate: 1.5 }, bonus: { fuel: 0.5 },
    effect: '+50% Fold Drive charge efficiency in this sector',
  },
  {
    id: 'sensor_relay', name: 'Sensor Relay', kana: 'センサーちゅうけい', corps: ['orrery'], tier: 1,
    ingots: { titanite: 3, iridium: 2 }, alloys: {}, bonus: { scan: 0.5, survey: 0.2 },
    effect: '+50% anomaly and sector scan speed and +20% Survey Data in this sector',
  },
  {
    id: 'research_lab', name: 'Research Lab', kana: 'けんきゅうじょ', corps: ['orrery', 'colonial'], tier: 2,
    ingots: { titanite: 3 }, alloys: { iridsteel: 1 }, bonus: { research: 0.3 },
    effect: '+30% research speed in this sector',
  },
  {
    id: 'defense_platform', name: 'Defense Platform', kana: 'ぼうえいきち', corps: ['vanguard'], tier: 2,
    ingots: { ferrite: 3 }, alloys: { duralloy: 1, iridsteel: 1 }, bonus: { raids: 0.3 },
    effect: 'Raids in this sector are 30% weaker',
  },
  {
    id: 'habitat_dome', name: 'Habitat Dome', kana: 'きょじゅうドーム', corps: ['colonial'], tier: 1,
    ingots: { ferrite: 3, titanite: 2 }, alloys: {}, bonus: { sell: 0.1 },
    effect: 'Colonists buy locally: ore, ingots and alloys sell for 10% more in this sector',
  },
  {
    id: 'spaceport', name: 'Spaceport', kana: 'うちゅうこう', corps: ['colonial'], tier: 2,
    ingots: { titanite: 2 }, alloys: { duralloy: 1, iridsteel: 1 }, bonus: { convoys: 1, sell: 0.05 },
    effect: 'Merchant convoys arrive twice as often and goods sell 5% higher in this sector',
  },
  {
    id: 'terraform_array', name: 'Terraforming Array', kana: 'テラフォーミング', corps: ['colonial'], tier: 3,
    ingots: { iridium: 3 }, alloys: { cryoplate: 1, nullsteel: 1 }, bonus: { production: 0.25, research: 0.1 },
    effect: 'A world takes root: +25% ore output and +10% research speed in this sector',
  },
];

export function improvementDef(id: ImprovementId): ImprovementDef {
  return IMPROVEMENTS.find((i) => i.id === id)!;
}

export const IMPROVEMENT = {
  /** Contract reward: market value of the materials × this. */
  rewardMult: 2.2,
  /** Standing for building one (other contracts give 2). */
  standing: 3,
  /** Construction contracts get this many times the usual deadline. */
  deadlineMult: 2.5,
  /** Colonial Trust perk (Trusted): improvements need this share of the materials. */
  colonialDiscount: 0.8,
};
