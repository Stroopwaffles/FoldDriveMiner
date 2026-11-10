/**
 * Milestone 5b tuning: merchant clans and their stock, megacorps and
 * contracts, sector-local outfits, and pilot bonds.
 */
import { OreId } from './config';

// ---------------------------------------------------------------- merchants

export type ClanId = 'halcyon' | 'grey_tithe' | 'okonkwo' | 'lantern';

export interface ClanDef {
  id: ClanId;
  name: string;
  captain: string;
  kana: string;
  color: string;
  specialty: string;
  /** Ores the clan barters for at a good rate. */
  wants: OreId[];
  /** Exclusive item unlocked at Partner reputation. */
  exclusive: string;
  greet: string;
  /** Only appears in Pirate Haven sectors. */
  blackMarket?: boolean;
}

export const CLANS: readonly ClanDef[] = [
  {
    id: 'halcyon', name: 'Halcyon Free Traders', captain: 'Captain Lio Marchetti', kana: 'ハルシオン', color: '#ff7ad9',
    specialty: 'Mech parts, including parts found only in this sector', wants: ['titanite', 'iridium'], exclusive: 'halcyon_chrome',
    greet: 'Darling! Look at that hull — you need upgrades. I have upgrades.',
  },
  {
    id: 'grey_tithe', name: 'Grey Tithe Convoy', captain: 'Elder Maren of the Tithe', kana: 'グレイ・タイズ', color: '#c0c8d8',
    specialty: 'Relics, lore, Data Cores and Survey Data', wants: ['helium3', 'voidglass'], exclusive: 'tithe_codex',
    greet: 'We have followed fold wakes for longer than you have been alive, Commander. Yours is… familiar.',
  },
  {
    id: 'okonkwo', name: 'Okonkwo-Varga Salvage Combine', captain: 'Foreman Ade Okonkwo-Varga', kana: 'オコンクォ', color: '#ffd23f',
    specialty: 'Drones, repair kits and medical supplies', wants: ['ferrite', 'titanite'], exclusive: 'combine_overhaul',
    greet: 'Salvage Combine. We fix things and we sell things. Mostly we sell things.',
  },
  {
    id: 'lantern', name: 'The Lantern Market', captain: '"Wick"', kana: 'ランタン', color: '#ff3b3b',
    specialty: 'Contraband: risky, powerful, no questions', wants: ['iridium', 'helium3'], exclusive: 'jackal_map',
    greet: 'Shh. Lanterns off. You didn\'t see us, we didn\'t see you, and the prices are… flexible.',
    blackMarket: true,
  },
];

export function clanDef(id: ClanId): ClanDef {
  return CLANS.find((c) => c.id === id)!;
}

export type ItemKind =
  | 'part'
  | 'chart'
  | 'ore_contract'
  | 'countermeasure'
  | 'drones'
  | 'repair_kit'
  | 'medkit'
  | 'overdrive_cell'
  | 'deterrent'
  | 'fold_cell'
  | 'pilot'
  | 'curio'
  | 'data_cores'
  | 'survey_data'
  | 'exclusive'
  | 'relic';

export const ITEM_INFO: Record<ItemKind, { name: string; desc: string; sectorBound?: boolean; contraband?: boolean }> = {
  part: { name: 'Mech part', desc: 'Goes to parts storage.' },
  chart: { name: 'Local star chart', desc: 'Reveals this sector\'s hidden anomalies.', sectorBound: true },
  ore_contract: { name: 'Sector ore contract', desc: '+25% sell price for one ore while you stay in this sector.', sectorBound: true },
  countermeasure: { name: 'Hazard countermeasure', desc: 'Cancels one harmful sector trait while you stay here.', sectorBound: true },
  drones: { name: 'Drone pack', desc: 'Drones delivered straight to the bay.' },
  repair_kit: { name: 'Repair kit', desc: 'Instantly repairs one mech (use from the HANGAR).' },
  medkit: { name: 'Med kit', desc: 'Instantly heals one injured pilot (use from CREW).' },
  overdrive_cell: { name: 'Overdrive cell', desc: 'For 60 s every click hits at Overdrive, whatever the heat.', contraband: true },
  deterrent: { name: 'Deterrent beacon', desc: 'Pirate Heat −30 and no raids for 10 minutes.' },
  fold_cell: { name: 'Fold charge cell', desc: 'Stored for the Fold Drive (Milestone 6).', contraband: true },
  pilot: { name: 'Pilot contract', desc: 'A pilot looking for work joins your crew.' },
  curio: { name: 'Curio', desc: 'A strange relic. Adds Survey Data and a Codex note.' },
  data_cores: { name: 'Data Cores', desc: 'Pristine Data Cores.' },
  survey_data: { name: 'Survey archive', desc: 'Survey Data from another expedition.' },
  exclusive: { name: 'Clan exclusive', desc: 'Only for the clan\'s partners.' },
  relic: { name: 'Legendary part', desc: 'A one-of-a-kind part. Sold only for Data Cores.' },
};

/** What each clan tends to stock. */
export const CLAN_STOCK: Record<ClanId, ItemKind[]> = {
  halcyon: ['part', 'part', 'part', 'countermeasure', 'ore_contract', 'pilot'],
  grey_tithe: ['curio', 'chart', 'data_cores', 'survey_data', 'fold_cell'],
  okonkwo: ['drones', 'drones', 'repair_kit', 'medkit', 'deterrent', 'part'],
  lantern: ['overdrive_cell', 'fold_cell', 'part', 'deterrent', 'pilot', 'data_cores'],
};

export const REP_TIERS = [
  { min: 0, name: 'Stranger', discount: 0, extraItems: 0 },
  { min: 5, name: 'Known', discount: 0.05, extraItems: 0 },
  { min: 15, name: 'Trusted', discount: 0.1, extraItems: 1 },
  { min: 30, name: 'Partner', discount: 0.15, extraItems: 1 },
];

export const MERCHANT = {
  /** Seconds between convoys, and how long they stay. */
  intervalMin: 600,
  intervalMax: 1200,
  stayMin: 900,
  stayMax: 1800,
  /** After an offline arrival the convoy waits this long after you return. */
  waitAfterReturn: 900,
  baseItems: 4,
  /** Barter pays this share of market value in goods (they want it). */
  barterRate: 1.3,
  /** Rep per 1% of your credits spent, capped per purchase. */
  repPerPurchase: 1,
  escortRep: 5,
  favorRep: 3,
  favorRewardMult: 2,
  stingChance: 0.25,
  overdriveCellSec: 60,
  deterrentSec: 600,
  deterrentHeat: 30,
};

// ---------------------------------------------------------------- contracts

export type CorpId = 'meridian' | 'aster_lune' | 'orrery' | 'vanguard';
export type ContractType = 'delivery' | 'refinement' | 'bounty' | 'survey' | 'blitz' | 'sustain';

export interface CorpDef {
  id: CorpId;
  name: string;
  kana: string;
  color: string;
  liaison: string;
  types: ContractType[];
  perk: string;
  exclusive: string;
}

export const CORPS: readonly CorpDef[] = [
  { id: 'meridian', name: 'Meridian Heavy Industries', kana: 'メリディアン', color: '#ffb547', liaison: 'Director Hale', types: ['delivery', 'refinement', 'sustain'], perk: 'Drones cost 5% less', exclusive: 'meridian_core' },
  { id: 'aster_lune', name: 'Aster-Lune Energy', kana: 'アスター・ルーン', color: '#9dff8a', liaison: 'Dr. Ines Calloway', types: ['delivery', 'refinement'], perk: 'Helium-3 and Voidglass sell 5% higher', exclusive: 'aster_capacitor' },
  { id: 'orrery', name: 'Orrery Survey Institute', kana: 'オーラリー', color: '#4fe3ff', liaison: 'Archivist Thorne', types: ['survey', 'blitz'], perk: '+10% Survey Data', exclusive: 'orrery_array' },
  { id: 'vanguard', name: 'Vanguard Security Concern', kana: 'ヴァンガード', color: '#ff3d9a', liaison: 'Major Wyke', types: ['bounty', 'blitz'], perk: 'Raids 10% weaker', exclusive: 'vanguard_aegis' },
];

export function corpDef(id: CorpId): CorpDef {
  return CORPS.find((c) => c.id === id)!;
}

/** Corporate standing tiers: perk at Trusted, exclusive item at Partner. */
export const STANDING = { trusted: 8, partner: 15 };

export type OutfitArchetype = 'cooperative' | 'colony' | 'outpost' | 'militia' | 'pilgrims' | 'rival_crew';

export const OUTFITS: Record<OutfitArchetype, { label: string; types: ContractType[]; names: string[]; legacy: string }> = {
  cooperative: { label: 'Mining Cooperative', types: ['delivery', 'sustain'], names: ['{s} Miners\' Union', '{s} Ore Cooperative'], legacy: 'credits' },
  colony: { label: 'Frontier Colony', types: ['refinement', 'delivery'], names: ['New {s} Colony', '{s} Homestead'], legacy: 'pilot' },
  outpost: { label: 'Research Outpost', types: ['survey'], names: ['{s} Observatory', 'Station {s}'], legacy: 'part' },
  militia: { label: 'Local Militia', types: ['bounty'], names: ['{s} Watch', '{s} Defence League'], legacy: 'part' },
  pilgrims: { label: 'Pilgrim Sect', types: ['survey', 'delivery'], names: ['Pilgrims of {s}', 'The {s} Vigil'], legacy: 'data_cores' },
  rival_crew: { label: 'Rival Mining Crew', types: ['blitz', 'sustain'], names: ['The {s} Diggers', 'Crew of the "{s}"'], legacy: 'credits' },
};

export const CONTRACT = {
  boardSize: 3,
  refreshSec: 600,
  rerollCost: 2000,
  baseSlots: 1,
  /** Target durations in seconds of current production / activity. */
  deliverySec: 240,
  refineSec: 600,
  sustainSec: 180,
  /** Reward = market value of the target × this. */
  rewardMult: 1.6,
  minReward: 1500,
  deadlineMin: 900,
  deadlineMax: 2400,
  failStanding: 1,
  localLegacy: 10,
  /**
   * Crack-asteroids blitz: the target is a share of what steady Overdrive
   * clicking (clicksPerSec, plus respawnSec between rocks) could crack in time.
   */
  blitz: { seconds: 600, clicksPerSec: 3, respawnSec: 0.6, shareMin: 0.25, shareMax: 0.4, minTarget: 12, maxTarget: 100 },
};

// ---------------------------------------------------------------- bonds

export type BondType = 'rivals' | 'partners' | 'mentor';

export const BONDS: Record<BondType, { name: string; desc: string }> = {
  rivals: { name: 'Rivals', desc: '+10% damage each when they fly together, and a lot of banter.' },
  partners: { name: 'Partners', desc: 'Take 15% less damage together; one covers for the other on a failed mission.' },
  mentor: { name: 'Mentor & student', desc: 'The student earns 50% more XP when they work together.' },
};

export const BOND_CHANCE = 0.35;
