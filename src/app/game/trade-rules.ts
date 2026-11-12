/**
 * Milestone 5b rules: merchant convoys (stock, barter, reputation, favors,
 * escorts), the contract board (megacorps and sector-local outfits) and
 * pilot bonds.
 */
import { THREAT } from './threat-data';
import { AlloyId } from './alloy-data';
import { alloyPrice } from './alloy-rules';
import { IMPROVEMENT, ImprovementDef, improvementDef } from './improvement-data';
import { construct, constructionOptions, improvementBonus, materialsFor } from './improvement-rules';
import { CURIO, CURIOS, CurioDef } from './curio-data';
import { CORES } from './core-data';
import { makeRelic } from './core-rules';
import { choice } from './story-rules';
import { CONFIG, ORES, ORE_IDS, OreId, ZoneId, oreDef, zoneDef } from './config';
import { currentZone, hasResearch, oreReachable, researchLevel, zoneUnlocked } from './common';
import { generatePilot, pilotById, rosterCap } from './crew-rules';
import { DroneType, PARTS, partDef, sectorPartId } from './fleet-data';
import { droneCostOf, droneUnlocked, mechStats } from './fleet-rules';
import { Rng } from './rng';
import { SECTOR_NAMES } from './sector-data';
import { sectorMods, sectorOf, sectorZones } from './sector-rules';
import { startEvent } from './threat-rules';
import {
  BOND_CHANCE,
  BondType,
  CLANS,
  CLAN_STOCK,
  CONTRACT,
  CORPS,
  ClanId,
  ContractType,
  CorpId,
  ItemKind,
  ITEM_INFO,
  MERCHANT,
  OUTFITS,
  OutfitArchetype,
  REP_TIERS,
  STANDING,
  clanDef,
  corpDef,
} from './trade-data';
import { Contract, ContractsState, GameState, LocalOutfit, MerchantFleet, PilotState, StockItem, TickEvents, TradeState } from './types';
// Engine helpers (cyclic import, only used at call time).
import { baseDrillPower, batchCapacity, drillPower, droneRateTotal, ingotPrice, mechRateTotal, oreRatio, orePrice, overdriveMult } from './engine';
import { productionValuePerSec } from './anomaly-rules';

// ---------------------------------------------------------------- state

export function emptyTrade(): TradeState {
  return {
    fleets: [],
    nextIn: MERCHANT.intervalMin,
    pending: false,
    visits: 0,
    rep: { halcyon: 0, grey_tithe: 0, okonkwo: 0, lantern: 0, collegium: 0 },
    inventory: { repair_kit: 0, medkit: 0, fold_cell: 0 },
    overdriveCell: 0,
    deterrent: 0,
    researchGrant: 0,
    sectorBuffs: { key: '', sell: {}, cancelled: [] },
    perks: [],
    nextId: 1,
  };
}

export function emptyContracts(): ContractsState {
  return {
    board: [],
    active: [],
    refreshIn: 0,
    standing: { meridian: 0, aster_lune: 0, orrery: 0, vanguard: 0, colonial: 0 },
    exclusives: [],
    local: [],
    localKey: '',
    completed: 0,
    failed: 0,
    nextId: 1,
  };
}

function sectorKey(state: GameState): string {
  return `${state.sector.seed}:${state.sector.depth}`;
}

/** Sector-bound purchases and local outfits reset when the sector changes. */
export function ensureTradeSector(state: GameState): void {
  const key = sectorKey(state);
  if (state.trade.sectorBuffs.key !== key) state.trade.sectorBuffs = { key, sell: {}, cancelled: [] };
  if (state.contracts.localKey !== key) {
    state.contracts.local = generateOutfits(state);
    state.contracts.localKey = key;
    state.contracts.board = state.contracts.board.filter((c) => c.issuer.kind === 'corp');
    state.contracts.active = state.contracts.active.filter((c) => c.issuer.kind === 'corp');
  }
  // Older saves could run past the cap.
  for (const o of state.contracts.local) o.standing = Math.min(CONTRACT.localLegacy, o.standing);
}

/** Adds a random not-yet-found curio to the Codex. Returns it, or null when the set is complete. */
export function identifyCurio(state: GameState): CurioDef | null {
  const have = new Set(state.anomalies.curios ?? []);
  const left = CURIOS.filter((c) => !have.has(c.id));
  if (!left.length) return null;
  const rng = new Rng(state.rng);
  const pick = left[Math.floor(rng.next() * left.length)];
  state.rng = rng.state;
  state.anomalies.curios = [...(state.anomalies.curios ?? []), pick.id];
  return pick;
}

function news(events: TickEvents, text: string, good: boolean, from: 'merchant' | 'corp' | 'vesper' = 'vesper', clan?: ClanId): void {
  events.trade.push({ text, good, from, ...(clan ? { clan } : {}) });
}

// ---------------------------------------------------------------- modifiers used elsewhere

/** Sector ore contracts bought from merchants. */
export function tradeSellMult(state: GameState, ore: OreId): number {
  let m = (1 + (state.trade.sectorBuffs.sell[ore] ?? 0)) * (1 + improvementBonus(state, 'sell'));
  if (corpPerk(state, 'aster_lune') && (ore === 'helium3' || ore === 'voidglass')) m *= 1.05;
  return m;
}

/** Sector traits cancelled by countermeasures. */
export function cancelledTraits(state: GameState): string[] {
  return state.trade?.sectorBuffs?.cancelled ?? [];
}

export function corpStanding(state: GameState, corp: CorpId): number {
  return state.contracts.standing[corp] ?? 0;
}

export function corpPerk(state: GameState, corp: CorpId): boolean {
  return (state.contracts?.standing?.[corp] ?? 0) >= STANDING.trusted;
}

export function droneCostMult(state: GameState): number {
  return corpPerk(state, 'meridian') ? 0.95 : 1;
}

export function surveyMult(state: GameState): number {
  return (corpPerk(state, 'orrery') ? 1.1 : 1) * (1 + researchLevel(state, 'core_decryption') * CORES.decryptionPerLevel) * (1 + improvementBonus(state, 'survey'));
}

export function raidMult(state: GameState): number {
  return (corpPerk(state, 'vanguard') ? 0.9 : 1) * Math.max(0.1, 1 - improvementBonus(state, 'raids'));
}

export function overdriveCellActive(state: GameState): boolean {
  return (state.trade?.overdriveCell ?? 0) > 0;
}

/** Extra research speed from merchants: a timed Collegium grant and the Fellowship perk. */
export function researchGrantBonus(state: GameState): number {
  return (state.trade?.researchGrant ?? 0) > 0 ? MERCHANT.grantBonus : 0;
}

export function fellowshipBonus(state: GameState): number {
  return state.trade?.perks?.includes('collegium_fellowship') ? MERCHANT.fellowshipBonus : 0;
}

export function deterrentActive(state: GameState): boolean {
  return (state.trade?.deterrent ?? 0) > 0;
}

// ---------------------------------------------------------------- merchants

export function repTier(rep: number) {
  return [...REP_TIERS].reverse().find((t) => rep >= t.min)!;
}

function pickClan(state: GameState, rng: Rng): ClanId {
  const haven = sectorOf(state).traits.includes('pirate_haven');
  const here = new Set(state.trade.fleets.map((f) => f.clan));
  // Only one convoy per clan at a time (a Trade Nexus can host several clans).
  const allowed = CLANS.filter((c) => (!c.blackMarket || haven || choice(state) === 'break') && !here.has(c.id));
  const options = allowed.length ? allowed : CLANS.filter((c) => !c.blackMarket || haven || choice(state) === 'break');
  // The Lantern Market is at home in a Pirate Haven: it turns up there far more often.
  const weight = (c: (typeof CLANS)[number]) => (c.blackMarket && haven ? MERCHANT.lanternHavenWeight : 1);
  const total = options.reduce((sum, c) => sum + weight(c), 0);
  let roll = rng.next() * total;
  for (const c of options) {
    roll -= weight(c);
    if (roll < 0) return c.id;
  }
  return options[options.length - 1].id;
}

/** A credit price that keeps up with the economy. */
function scaledPrice(state: GameState, sec: number): number {
  return Math.max(500, productionValuePerSec(state) * sec);
}

function makeItem(state: GameState, clan: ClanId, kind: ItemKind, rng: Rng, discount: number): StockItem | null {
  const t = state.trade;
  const info = ITEM_INFO[kind];
  const item: StockItem = { id: t.nextId++, kind, label: info.name, desc: info.desc, price: 0, sold: false };
  const def = sectorOf(state);
  switch (kind) {
    case 'part': {
      const pool = PARTS.filter((p) => p.rarity === 'standard');
      const base = pool[Math.floor(rng.next() * pool.length)];
      const unique = clan === 'halcyon' ? rng.next() < 0.6 : rng.next() < 0.25;
      const id = unique ? sectorPartId(def.seed, base.id) : base.id;
      const p = partDef(id);
      item.partId = id;
      item.label = p.name;
      const stats = Object.entries(p.stats)
        .filter(([, v]) => v)
        .map(([k, v]) => `${(v as number) > 0 ? '+' : ''}${v} ${k}`);
      if (p.supply) stats.push(`+${p.supply} power`);
      item.desc = `${unique ? 'Sector-unique part. ' : ''}${stats.join(', ')}`;
      item.price = Math.round(p.cost * (unique ? 1 : 0.8));
      break;
    }
    case 'chart': {
      const hidden = state.anomalies.list.filter((a) => a.status === 'hidden').length;
      item.desc = hidden ? `Reveals ${hidden} hidden anomal${hidden > 1 ? 'ies' : 'y'} in this sector.` : 'No hidden anomalies left — pays out in Survey Data instead.';
      item.price = scaledPrice(state, 90);
      break;
    }
    case 'ore_contract': {
      const ores = ORE_IDS.filter((o) => oreReachable(state, o));
      item.ore = ores[ores.length - 1 - Math.floor(rng.next() * Math.min(2, ores.length))];
      item.label = `Sector contract: ${oreDef(item.ore).name}`;
      item.desc = `+25% sell price for ${oreDef(item.ore).name} while you stay in this sector.`;
      item.price = scaledPrice(state, 240);
      break;
    }
    case 'countermeasure': {
      const bad = def.traits.filter((x) => ['ion_storms', 'pirate_haven', 'micrometeor_swarm', 'gravity_shear', 'dense_field'].includes(x) && !t.sectorBuffs.cancelled.includes(x));
      if (!bad.length) return null;
      item.trait = bad[Math.floor(rng.next() * bad.length)];
      item.label = `Countermeasure: ${item.trait.replace(/_/g, ' ')}`;
      item.desc = `Cancels the "${item.trait.replace(/_/g, ' ')}" trait while you stay in this sector.`;
      item.price = scaledPrice(state, 360);
      break;
    }
    case 'drones': {
      const types: DroneType[] = (['prospector', 'cutter', 'hauler', 'surveyor', 'guardian', 'salvager'] as DroneType[]).filter((d) => droneUnlocked(state, d));
      item.drone = types[Math.floor(rng.next() * types.length)];
      item.count = 5 + Math.floor(rng.next() * 6);
      item.label = `${item.count} ${item.drone} drones`;
      item.price = Math.round(droneCostOf(state, item.drone, item.count) * 0.7);
      break;
    }
    case 'repair_kit':
      item.price = scaledPrice(state, 45);
      break;
    case 'base_coords':
      // Only worth selling once there are pirates about and their base is still hidden.
      if (state.threats.baseFound || state.threats.raids < 1) return null;
      item.price = scaledPrice(state, 300);
      break;
    case 'pirate_leads':
      if (state.threats.baseFound || state.threats.raids < 1) return null;
      item.price = scaledPrice(state, 120);
      break;
    case 'medkit':
      item.price = scaledPrice(state, 45);
      break;
    case 'overdrive_cell':
      item.price = scaledPrice(state, 60);
      break;
    case 'deterrent':
      item.price = scaledPrice(state, 150);
      break;
    case 'research_grant':
      item.price = scaledPrice(state, 180);
      break;
    case 'fold_cell':
      item.price = scaledPrice(state, 200);
      break;
    case 'pilot':
      if (state.pilots.length >= rosterCap(state)) return null;
      item.price = scaledPrice(state, 300);
      break;
    case 'curio':
      item.price = scaledPrice(state, 120);
      break;
    case 'data_cores':
      // Scholars hoard cores: the Collegium brings bigger lots.
      item.count = clan === 'collegium' ? 2 + Math.floor(rng.next() * 3) : 1 + Math.floor(rng.next() * 2);
      item.label = `${item.count} Data Core${item.count > 1 ? 's' : ''}`;
      item.price = scaledPrice(state, 400) * item.count;
      break;
    case 'survey_data':
      item.count = Math.round(20 + 10 * state.sector.depth + rng.next() * 30);
      item.label = `${item.count} Survey Data`;
      item.price = scaledPrice(state, 100);
      break;
    case 'exclusive':
      break;
  }
  item.price = Math.round(item.price * (1 - discount));
  // Barter: the clan takes ore it wants instead of credits.
  const clanWants = clanDef(clan).wants.filter((o) => oreReachable(state, o));
  if (item.price > 0 && clanWants.length && rng.next() < 0.7) {
    item.barterOre = clanWants[Math.floor(rng.next() * clanWants.length)];
    item.barterAmount = Math.ceil(item.price / (orePrice(state, item.barterOre) * MERCHANT.barterRate));
  }
  return item;
}

export function spawnFleet(state: GameState, events: TickEvents, clan?: ClanId): MerchantFleet {
  const t = state.trade;
  const rng = new Rng(state.rng);
  const id = clan ?? pickClan(state, rng);
  const tier = repTier(t.rep[id]);
  const kinds = [...CLAN_STOCK[id]];
  const count = MERCHANT.baseItems + tier.extraItems;
  const stock: StockItem[] = [];
  for (let i = 0; i < count * 2 && stock.length < count; i++) {
    const kind = kinds[Math.floor(rng.next() * kinds.length)];
    if (stock.some((s) => s.kind === kind && kind !== 'part' && kind !== 'drones')) continue;
    const item = makeItem(state, id, kind, rng, tier.discount);
    if (item) stock.push(item);
  }
  // A legendary part, sometimes: only for Data Cores.
  const relic = makeRelic(state, rng, t.nextId);
  if (relic) {
    t.nextId++;
    stock.push(relic);
  }
  // Partners get the clan's exclusive (once).
  const ex = clanDef(id).exclusive;
  if (tier.name === 'Partner' && !t.perks.includes(ex)) {
    stock.push({ id: t.nextId++, kind: 'exclusive', label: exclusiveName(ex), desc: exclusiveDesc(ex), price: scaledPrice(state, 600), sold: false, partId: PARTS.some((p) => p.id === ex) ? ex : undefined });
  }
  const wants = clanDef(id).wants.filter((o) => oreReachable(state, o));
  const favorOre = wants.length ? wants[Math.floor(rng.next() * wants.length)] : 'ferrite';
  const fleet: MerchantFleet = {
    clan: id,
    remaining: rng.range(MERCHANT.stayMin, MERCHANT.stayMax),
    stock,
    favor: { ore: favorOre, amount: Math.max(50, Math.round(droneRateTotal(state) * 300)), done: false },
    escortDone: false,
  };
  state.rng = rng.state;
  t.fleets.push(fleet);
  t.visits++;
  state.stats.convoysHosted = (state.stats.convoysHosted ?? 0) + 1;
  news(events, `UNIDENTIFIED CONVOY ON APPROACH — TRANSPONDER: ${clanDef(id).name.toUpperCase()}. They'll trade for a while; open the BOARD.`, true);
  news(events, clanDef(id).greet, true, 'merchant', id);
  return fleet;
}

function exclusiveName(id: string): string {
  return { halcyon_chrome: 'Halcyon Chrome Plating', tithe_codex: 'The Tithe\'s Codex', combine_overhaul: 'Combine Overhaul Contract', jackal_map: 'The Jackal\'s Bounty Map', collegium_fellowship: 'Collegium Fellowship' }[id] ?? id;
}

function exclusiveDesc(id: string): string {
  return (
    {
      halcyon_chrome: 'Unique armor: +130 armor, +6 speed.',
      tithe_codex: 'A record of the first fold. 5 Data Cores and a Codex revelation.',
      combine_overhaul: 'Permanent: wreck rebuilds cost 10% instead of 25%, repairs 25% faster.',
      jackal_map: 'Reveals the pirate base right now.',
      collegium_fellowship: 'Permanent: +10% research speed, and 3 Data Cores to seal the charter.',
    }[id] ?? ''
  );
}

export type PayMethod = 'credits' | 'barter' | 'cores';

/** The convoy selling an item. */
function fleetSelling(state: GameState, itemId: number): MerchantFleet | undefined {
  return state.trade.fleets.find((f) => f.stock.some((s) => s.id === itemId));
}

/** A convoy by clan, or the only/first one. */
function fleetOf(state: GameState, clan?: ClanId): MerchantFleet | undefined {
  const fleets = state.trade.fleets;
  return clan ? fleets.find((f) => f.clan === clan) : fleets[0];
}

/** How many convoys can trade here at once. */
export function maxConvoys(state: GameState): number {
  return sectorOf(state).traits.includes('trade_nexus') ? MERCHANT.nexusConvoys : 1;
}

export function canBuy(state: GameState, itemId: number, pay: PayMethod): string | null {
  const f = fleetSelling(state, itemId);
  const item = f?.stock.find((s) => s.id === itemId);
  if (!f || !item) return 'Not for sale';
  if (item.sold) return 'Sold';
  if (pay === 'cores') {
    if (!item.dataCores) return 'Not sold for cores';
    if (state.dataCores < item.dataCores) return `Need ${item.dataCores} Data Cores`;
  } else if (item.kind === 'relic') return 'Sold only for Data Cores';
  else if (pay === 'barter') {
    if (!item.barterOre || !item.barterAmount) return 'No barter offered';
    if (state.cargo[item.barterOre] < item.barterAmount) return `Need ${item.barterAmount} ${oreDef(item.barterOre).name}`;
  } else if (state.credits < item.price) return 'Not enough credits';
  if (item.kind === 'pilot' && state.pilots.length >= rosterCap(state)) return 'Roster full';
  return null;
}

export function buyItem(state: GameState, itemId: number, pay: PayMethod, events: TickEvents): boolean {
  if (canBuy(state, itemId, pay) !== null) return false;
  const t = state.trade;
  const f = fleetSelling(state, itemId)!;
  const item = f.stock.find((s) => s.id === itemId)!;
  if (pay === 'cores') state.dataCores -= item.dataCores!;
  else if (pay === 'barter') state.cargo[item.barterOre!] -= item.barterAmount!;
  else state.credits -= item.price;
  item.sold = true;
  t.rep[f.clan] += MERCHANT.repPerPurchase + (item.price > state.credits * 0.2 ? 1 : 0);
  applyItem(state, item, events, f.clan);
  if (clanDef(f.clan).blackMarket && ITEM_INFO[item.kind].contraband) {
    const rng = new Rng(state.rng);
    if (rng.next() < MERCHANT.stingChance && !state.threats.events.some((e) => e.kind === 'raid')) {
      const raid = startEvent(state, 'raid', events, rng);
      raid.remaining = 30;
      news(events, 'Sting! Someone tipped off the pirates about that contraband deal. Raid incoming.', false);
    }
    state.rng = rng.state;
  }
  return true;
}

function applyItem(state: GameState, item: StockItem, events: TickEvents, clan: ClanId): void {
  const t = state.trade;
  switch (item.kind) {
    case 'part':
    case 'relic':
      state.parts[item.partId!] = (state.parts[item.partId!] ?? 0) + 1;
      news(events, `${item.label} added to parts storage.`, true);
      break;
    case 'chart': {
      const hidden = state.anomalies.list.filter((a) => a.status === 'hidden');
      for (const a of hidden) a.status = 'signal';
      if (!hidden.length) state.surveyData += 40;
      news(events, hidden.length ? `Star chart loaded: ${hidden.length} signal(s) now on the MAP.` : 'Star chart loaded. +40 Survey Data.', true);
      break;
    }
    case 'ore_contract':
      t.sectorBuffs.sell[item.ore!] = (t.sectorBuffs.sell[item.ore!] ?? 0) + 0.25;
      break;
    case 'countermeasure':
      t.sectorBuffs.cancelled.push(item.trait!);
      break;
    case 'drones':
      state.drones[item.drone!] += item.count!;
      break;
    case 'repair_kit':
      t.inventory.repair_kit++;
      break;
    case 'medkit':
      t.inventory.medkit++;
      break;
    case 'fold_cell':
      t.inventory.fold_cell++;
      break;
    case 'overdrive_cell':
      t.overdriveCell = MERCHANT.overdriveCellSec;
      break;
    case 'research_grant':
      t.researchGrant = Math.max(t.researchGrant ?? 0, MERCHANT.grantSec);
      news(events, `Collegium analysts plug into the lab. Research +${Math.round(MERCHANT.grantBonus * 100)}% for ${MERCHANT.grantSec / 60} minutes.`, true, 'merchant', clan);
      break;
    case 'base_coords':
      state.threats.baseFound = true;
      news(events, 'The coordinates check out: pirate base located. Plan a strike from the DEFENSE screen.', true);
      break;
    case 'pirate_leads': {
      const th = state.threats;
      th.winsSinceBase += MERCHANT.leadsWins;
      const need = th.strikesWon === 0 ? THREAT.strike.winsToFind : THREAT.strike.winsToRefind;
      if (th.winsSinceBase >= need) {
        th.baseFound = true;
        news(events, 'The sighting reports narrow it down: pirate base located. Plan a strike from the DEFENSE screen.', true);
      } else {
        news(events, `The sighting reports help: ${th.winsSinceBase} of ${need} toward tracing the pirate base.`, true);
      }
      break;
    }
    case 'deterrent':
      t.deterrent = MERCHANT.deterrentSec;
      state.threats.heat = Math.max(0, state.threats.heat - MERCHANT.deterrentHeat);
      break;
    case 'pilot': {
      const rng = new Rng(state.rng);
      const p = generatePilot(state, rng);
      p.level = 3 + Math.floor(rng.next() * 6);
      state.rng = rng.state;
      state.pilots.push(p);
      rollBond(state, p);
      news(events, `${p.name} "${p.callsign}" signs on (level ${p.level} ${p.background}).`, true);
      break;
    }
    case 'curio': {
      const sd = CURIO.surveyData * (1 + state.sector.depth);
      state.surveyData += sd;
      const found = identifyCurio(state);
      news(
        events,
        found
          ? `Curio identified: ${found.name}. Added to the Codex (MAP › CODEX). +${sd} Survey Data.`
          : `Another curio for the shelf. Nothing new for the Codex. +${sd} Survey Data.`,
        true,
      );
      break;
    }
    case 'data_cores':
      state.dataCores += item.count!;
      break;
    case 'survey_data':
      state.surveyData += item.count!;
      break;
    case 'exclusive': {
      const ex = clanDef(clan).exclusive;
      t.perks.push(ex);
      if (item.partId) state.parts[item.partId] = (state.parts[item.partId] ?? 0) + 1;
      if (ex === 'tithe_codex') {
        state.dataCores += 5;
        news(events, 'The Tithe\'s Codex: "The first fold did not go anywhere. It went back."', true, 'merchant', clan);
      }
      if (ex === 'jackal_map') state.threats.baseFound = true;
      if (ex === 'collegium_fellowship') {
        state.dataCores += 3;
        news(events, 'Provost Sel: "Welcome to the Fellowship, Commander. Publish everything."', true, 'merchant', clan);
      }
      break;
    }
  }
}

export function useRepairKit(state: GameState, mechId: number): boolean {
  const m = state.mechs.find((x) => x.id === mechId);
  if (!m || state.trade.inventory.repair_kit <= 0) return false;
  const max = mechStats(state, m).armor;
  if (m.armor >= max) return false;
  state.trade.inventory.repair_kit--;
  m.armor = max;
  if (m.job === 'repair') {
    m.job = m.returnJob ?? 'idle';
    m.returnJob = null;
  }
  return true;
}

export function useMedkit(state: GameState, pilotId: number): boolean {
  const p = pilotById(state, pilotId);
  if (!p || p.injuredRemaining <= 0 || state.trade.inventory.medkit <= 0) return false;
  state.trade.inventory.medkit--;
  p.injuredRemaining = 0;
  return true;
}

/** Deliver ore for the captain's favor. */
export function deliverFavor(state: GameState, events: TickEvents, clan?: ClanId): boolean {
  const f = fleetOf(state, clan);
  if (!f?.favor || f.favor.done || state.cargo[f.favor.ore] < f.favor.amount) return false;
  state.cargo[f.favor.ore] -= f.favor.amount;
  f.favor.done = true;
  const reward = f.favor.amount * orePrice(state, f.favor.ore) * MERCHANT.favorRewardMult;
  state.credits += reward;
  state.stats.creditsEarned += reward;
  state.trade.rep[f.clan] += MERCHANT.favorRep;
  news(events, `Favor delivered. ${clanDef(f.clan).captain} pays ${Math.round(reward).toLocaleString()} cr and won't forget it.`, true, 'merchant', f.clan);
  return true;
}

/** Escort the convoy: an automatic sortie against raiders shadowing it. */
export function escortStrength(state: GameState): number {
  return 12 * (1 + Math.log10(1 + state.stats.creditsEarned / 1e5)) * 0.8;
}

export function onEscortResult(state: GameState, won: boolean, events: TickEvents, clan?: ClanId): void {
  const f = fleetOf(state, clan);
  if (!f) return;
  f.escortDone = true;
  if (won) {
    state.trade.rep[f.clan] += MERCHANT.escortRep;
    news(events, `Convoy escorted safely. ${clanDef(f.clan).name} reputation +${MERCHANT.escortRep}.`, true, 'merchant', f.clan);
  } else {
    news(events, 'The raiders broke through the escort. The convoy limps away.', false, 'merchant', f.clan);
  }
}

function advanceMerchants(state: GameState, dt: number, events: TickEvents, offline: boolean): void {
  const t = state.trade;
  if (t.overdriveCell > 0) t.overdriveCell = Math.max(0, t.overdriveCell - dt);
  if (t.deterrent > 0) t.deterrent = Math.max(0, t.deterrent - dt);
  if (t.researchGrant > 0) t.researchGrant = Math.max(0, t.researchGrant - dt);
  for (const f of [...t.fleets]) {
    f.remaining -= dt;
    if (f.remaining <= 0) {
      news(events, `${clanDef(f.clan).name} have burned out for the shipping lanes. Safe travels.`, true);
      t.fleets = t.fleets.filter((x) => x !== f);
    }
  }
  const room = t.fleets.length < maxConvoys(state);
  if (t.pending && !offline && room) {
    t.pending = false;
    const f = spawnFleet(state, events);
    f.remaining = MERCHANT.waitAfterReturn;
    return;
  }
  // Only one convoy at a time, except in a Trade Nexus.
  if (!room) return;
  // Convoys are a fixed part of the economy only once you have something to trade.
  if (state.stats.creditsEarned < 2000) return;
  const traits = sectorOf(state).traits;
  t.nextIn -= dt * (traits.includes('trade_hub') ? 1.5 : 1) * (traits.includes('trade_nexus') ? MERCHANT.nexusArrivalMult : 1) * (1 + improvementBonus(state, 'convoys'));
  if (t.nextIn > 0) return;
  const rng = new Rng(state.rng);
  t.nextIn = rng.range(MERCHANT.intervalMin, MERCHANT.intervalMax);
  state.rng = rng.state;
  if (offline) t.pending = true;
  else spawnFleet(state, events);
}

// ---------------------------------------------------------------- contracts

function generateOutfits(state: GameState): LocalOutfit[] {
  const def = sectorOf(state);
  const rng = new Rng((def.seed ^ 0xa5a5a5a5 ^ Math.imul(def.depth + 3, 0x1b873593)) >>> 0);
  const word = def.name.split(' ').pop()!;
  const count = def.depth === 0 ? 1 + (rng.next() < 0.5 ? 1 : 0) : Math.floor(rng.next() * 3);
  const types = Object.keys(OUTFITS) as OutfitArchetype[];
  const out: LocalOutfit[] = [];
  for (let i = 0; i < count; i++) {
    const archetype = types[Math.floor(rng.next() * types.length)];
    if (out.some((o) => o.archetype === archetype)) continue;
    const names = OUTFITS[archetype].names;
    out.push({
      id: `${def.code}:${archetype}`,
      name: names[Math.floor(rng.next() * names.length)].replace('{s}', word === 'Reach' ? SECTOR_NAMES[def.seed % SECTOR_NAMES.length].split(' ').pop()! : word),
      archetype,
      standing: 0,
      legacyClaimed: false,
    });
  }
  return out;
}

export function contractSlots(state: GameState): number {
  return CONTRACT.baseSlots + (hasResearch(state, 'contract_office') ? state.research.levels['contract_office'] : 0);
}

function counterFor(state: GameState, type: ContractType): number {
  switch (type) {
    case 'bounty':
      return state.threats.raidsWon + state.threats.strikesWon;
    case 'survey':
      return Object.values(state.anomalies.codex).reduce((a, b) => a + (b ?? 0), 0);
    case 'blitz':
      return state.stats.asteroidsCracked;
    default:
      return 0;
  }
}

function makeContract(state: GameState, issuer: Contract['issuer'], type: ContractType, rng: Rng): Contract {
  const C = state.contracts;
  // A construction job needs something left to build here; otherwise ask for ingots instead.
  let build: ImprovementDef | undefined;
  if (type === 'construction') {
    const options = issuer.kind === 'corp' ? constructionOptions(state, issuer.id as CorpId) : [];
    if (options.length) build = options[Math.floor(rng.next() * options.length)];
    else type = 'refinement';
  }
  const reachable = ORE_IDS.filter((o) => oreReachable(state, o));
  const issuerName = issuer.kind === 'corp' ? corpDef(issuer.id as CorpId).name : C.local.find((l) => l.id === issuer.id)?.name ?? 'Local outfit';
  const valueSec = Math.max(1, productionValuePerSec(state));
  let ore: OreId | undefined;
  let target = 1;
  let reward = 0;
  let title = '';
  let deadline = rng.range(CONTRACT.deadlineMin, CONTRACT.deadlineMax);
  let materials: Contract['materials'];
  let site: ZoneId | undefined;
  switch (type) {
    case 'delivery': {
      // Energy firms want the fuel ores; others want the best ore you can reach.
      const pref = issuer.id === 'aster_lune' ? reachable.filter((o) => o === 'helium3' || o === 'voidglass') : [];
      const pool = pref.length ? pref : reachable.slice(-2);
      ore = pool[Math.floor(rng.next() * pool.length)];
      const rate = Math.max(droneRateTotal(state) + mechRateTotal(state), 0.5);
      target = Math.max(50, Math.round((rate * CONTRACT.deliverySec) / Math.max(1, ORES.findIndex((o) => o.id === ore) + 1)));
      reward = target * orePrice(state, ore) * CONTRACT.rewardMult;
      title = `Deliver ${target.toLocaleString()} t of ${oreDef(ore).name}`;
      break;
    }
    case 'refinement': {
      ore = reachable[Math.floor(rng.next() * reachable.length)];
      target = Math.max(5, Math.round((batchCapacity(state) / oreRatio(state)) * 3));
      reward = target * ingotPrice(state, ore) * CONTRACT.rewardMult;
      title = `Deliver ${target} ${oreDef(ore).name} ingots`;
      break;
    }
    case 'bounty':
      target = 1 + (rng.next() < 0.4 ? 1 : 0);
      reward = valueSec * 400 * target;
      title = `Win ${target} raid defense${target > 1 ? 's' : ''} or strikes`;
      deadline *= 2;
      break;
    case 'survey':
      target = 1 + (rng.next() < 0.3 ? 1 : 0);
      reward = valueSec * 300 * target;
      title = `Identify ${target} anomal${target > 1 ? 'ies' : 'y'} (scan signals)`;
      deadline *= 2;
      break;
    case 'blitz':
      target = blitzTarget(state, rng);
      reward = valueSec * 12 * target;
      title = `Crack ${target} asteroids in ${Math.round(CONTRACT.blitz.seconds / 60)} minutes`;
      deadline = CONTRACT.blitz.seconds;
      break;
    case 'sustain': {
      const rate = Math.max(1, (droneRateTotal(state) + mechRateTotal(state)) * 1.15);
      target = Math.round(rate);
      reward = valueSec * 360;
      title = `Hold ${target.toLocaleString()} ore/s for ${CONTRACT.sustainSec / 60} minutes`;
      break;
    }
    case 'construction': {
      materials = materialsFor(state, build!);
      let value = 0;
      for (const [o, n] of Object.entries(materials.ingots)) value += n! * ingotPrice(state, o as OreId);
      for (const [a, n] of Object.entries(materials.alloys)) value += n! * alloyPrice(state, a as AlloyId);
      reward = value * IMPROVEMENT.rewardMult;
      target = 1;
      // The corporation picks a charted zone for it.
      const zones = sectorZones(state).filter((z) => zoneUnlocked(state, z.id));
      site = zones[Math.floor(rng.next() * zones.length)]?.id ?? state.zone;
      title = `Build a ${build!.name} in ${zoneDef(site).name}`;
      deadline *= IMPROVEMENT.deadlineMult;
      break;
    }
  }
  const sd = rng.next() < 0.5 ? Math.round(5 + state.sector.depth * 5 + rng.next() * 10) : 0;
  return {
    id: C.nextId++,
    issuer,
    type,
    title: `${issuerName}: ${title}`,
    ore,
    target,
    progress: 0,
    deadline,
    duration: deadline,
    reward: { credits: Math.max(CONTRACT.minReward, Math.round(reward * meridianBonus(state, issuer))), surveyData: sd, dataCores: rng.next() < 0.15 ? 1 : 0 },
    baseline: 0,
    held: 0,
    ...(build ? { improvement: build.id, materials, zone: site } : {}),
  };
}

/**
 * Asteroids for a 10-minute blitz: a quarter to two-fifths of what steady clicking
 * in Overdrive could crack, simulated rock by rock (each crack makes the next
 * rock heavier, but never lighter than the drill's minimum clicks).
 */
export function blitzTarget(state: GameState, rng: Rng): number {
  const B = CONTRACT.blitz;
  const a = CONFIG.asteroid;
  const perClick = drillPower(state) * overdriveMult(state);
  const zoneMass = a.baseMass * currentZone(state).massMult;
  const floor = baseDrillPower(state) * a.minClicks;
  const mods = sectorMods(state).asteroidMass;
  let time = 0;
  let possible = 0;
  for (let c = state.stats.asteroidsCracked; possible < 1000; c++) {
    const growth = Math.min(1 + c * a.massGrowthPerCrack, a.maxMassMult);
    const mass = Math.max(zoneMass * growth, floor) * mods;
    time += Math.ceil(mass / perClick) / B.clicksPerSec + B.respawnSec;
    if (time > B.seconds) break;
    possible++;
  }
  const share = rng.range(B.shareMin, B.shareMax);
  return Math.max(B.minTarget, Math.min(B.maxTarget, Math.round(possible * share)));
}

/** After Master the Cycle, Meridian pays 50% more. */
function meridianBonus(state: GameState, issuer: Contract['issuer']): number {
  return issuer.kind === 'corp' && issuer.id === 'meridian' && choice(state) === 'master' ? 1.5 : 1;
}

export function refreshBoard(state: GameState): void {
  const C = state.contracts;
  const rng = new Rng(state.rng);
  C.board = [];
  for (let i = 0; i < CONTRACT.boardSize; i++) {
    const useLocal = C.local.length > 0 && i === CONTRACT.boardSize - 1;
    if (useLocal) {
      const o = C.local[Math.floor(rng.next() * C.local.length)];
      const types = OUTFITS[o.archetype].types;
      C.board.push(makeContract(state, { kind: 'local', id: o.id }, types[Math.floor(rng.next() * types.length)], rng));
    } else {
      const corps = choice(state) === 'break' ? CORPS.filter((c) => c.id !== 'meridian') : CORPS;
      const corp = corps[Math.floor(rng.next() * corps.length)];
      C.board.push(makeContract(state, { kind: 'corp', id: corp.id }, corp.types[Math.floor(rng.next() * corp.types.length)], rng));
    }
  }
  // Only offer contracts you can work toward.
  C.board = C.board.filter((c) => (c.type !== 'survey' || zoneUnlocked(state, state.zone)) && (c.type !== 'refinement' || hasResearch(state, 'refinery')));
  C.refreshIn = CONTRACT.refreshSec;
  state.rng = rng.state;
}

/** Builds the improvement for an accepted construction contract, spending the materials. */
export function buildContract(state: GameState, id: number, events: TickEvents): boolean {
  const c = state.contracts.active.find((x) => x.id === id);
  if (!c || c.type !== 'construction' || !construct(state, c)) return false;
  c.progress = c.target;
  const def = improvementDef(c.improvement!);
  news(events, `${def.name} complete. ${def.effect}.`, true, 'corp');
  complete(state, c, events);
  return true;
}

export function rerollBoard(state: GameState): boolean {
  if (state.credits < CONTRACT.rerollCost) return false;
  state.credits -= CONTRACT.rerollCost;
  refreshBoard(state);
  return true;
}

export function acceptContract(state: GameState, id: number): boolean {
  const C = state.contracts;
  const c = C.board.find((x) => x.id === id);
  if (!c || C.active.length >= contractSlots(state)) return false;
  C.board = C.board.filter((x) => x !== c);
  c.baseline = counterFor(state, c.type);
  C.active.push(c);
  return true;
}

export function abandonContract(state: GameState, id: number): boolean {
  const C = state.contracts;
  const c = C.active.find((x) => x.id === id);
  if (!c) return false;
  C.active = C.active.filter((x) => x !== c);
  changeStanding(state, c, -CONTRACT.failStanding);
  C.failed++;
  return true;
}

function changeStanding(state: GameState, c: Contract, delta: number): void {
  if (c.issuer.kind === 'corp') {
    const id = c.issuer.id as CorpId;
    state.contracts.standing[id] = Math.max(0, state.contracts.standing[id] + delta);
  } else {
    const o = state.contracts.local.find((l) => l.id === c.issuer.id);
    // Local standing tops out at the Sector Legacy.
    if (o) o.standing = Math.min(CONTRACT.localLegacy, Math.max(0, o.standing + delta));
  }
}

function complete(state: GameState, c: Contract, events: TickEvents): void {
  const C = state.contracts;
  C.active = C.active.filter((x) => x !== c);
  C.completed++;
  state.credits += c.reward.credits;
  state.stats.creditsEarned += c.reward.credits;
  state.surveyData += c.reward.surveyData;
  state.dataCores += c.reward.dataCores;
  changeStanding(state, c, c.type === 'construction' ? IMPROVEMENT.standing : c.issuer.kind === 'corp' ? 2 : 3);
  const bits = [`+${c.reward.credits.toLocaleString()} cr`];
  if (c.reward.surveyData) bits.push(`+${c.reward.surveyData} Survey Data`);
  if (c.reward.dataCores) bits.push('+1 Data Core');
  news(events, `Contract complete — ${c.title}. ${bits.join(', ')}.`, true, 'corp');

  if (c.issuer.kind === 'corp') {
    const id = c.issuer.id as CorpId;
    const s = C.standing[id];
    const def = corpDef(id);
    const gained = c.type === 'construction' ? IMPROVEMENT.standing : 2;
    if (s >= STANDING.trusted && s - gained < STANDING.trusted) news(events, `${def.name} now trusts you: ${def.perk}.`, true, 'corp');
    if (s >= STANDING.partner && !C.exclusives.includes(id)) {
      C.exclusives.push(id);
      state.parts[def.exclusive] = (state.parts[def.exclusive] ?? 0) + 1;
      news(events, `${def.name} names you a partner and sends ${partDef(def.exclusive).name}.`, true, 'corp');
    }
    if (id === 'meridian' && s >= STANDING.trusted && !state.flags['meridianSecret']) {
      state.flags['meridianSecret'] = true;
      news(events, 'Director Hale, private channel: "If you find any old beacons out there, Commander — don\'t decode them. Bring them to us intact."', false, 'corp');
    }
  } else {
    const o = C.local.find((l) => l.id === c.issuer.id);
    if (o && o.standing >= CONTRACT.localLegacy && !o.legacyClaimed) {
      o.legacyClaimed = true;
      grantLegacy(state, o, events);
    }
  }
}

/** Maxing a local outfit's standing earns a reward that outlasts the sector. */
function grantLegacy(state: GameState, o: LocalOutfit, events: TickEvents): void {
  const rng = new Rng(state.rng);
  let what = '';
  switch (OUTFITS[o.archetype].legacy) {
    case 'pilot': {
      if (state.pilots.length < rosterCap(state)) {
        const p = generatePilot(state, rng);
        p.level = 10;
        state.pilots.push(p);
        rollBond(state, p);
        what = `${p.name} "${p.callsign}" joins your crew`;
      } else {
        state.dataCores += 3;
        what = '3 Data Cores';
      }
      break;
    }
    case 'part': {
      const pool = PARTS.filter((p) => p.rarity === 'standard');
      const id = sectorPartId(state.sector.seed ^ 0x77, pool[Math.floor(rng.next() * pool.length)].id);
      state.parts[id] = (state.parts[id] ?? 0) + 1;
      what = partDef(id).name;
      break;
    }
    case 'data_cores':
      state.dataCores += 4;
      what = '4 Data Cores';
      break;
    default: {
      const c = Math.round(productionValuePerSec(state) * 1800 + 25000);
      state.credits += c;
      what = `${c.toLocaleString()} cr`;
    }
  }
  state.rng = rng.state;
  news(events, `SECTOR LEGACY — ${o.name} will remember you: ${what}.`, true, 'corp');
}

function advanceContracts(state: GameState, dt: number, events: TickEvents, offline: boolean): void {
  const C = state.contracts;
  if (state.stats.creditsEarned < 500) return;
  if (!offline) {
    C.refreshIn -= dt;
    if (C.refreshIn <= 0 || (!C.board.length && C.refreshIn < CONTRACT.refreshSec - 5)) refreshBoard(state);
  }
  const rate = droneRateTotal(state) + mechRateTotal(state);
  for (const c of [...C.active]) {
    switch (c.type) {
      case 'delivery': {
        // Ore goes to the contract before auto-sell gets it.
        const take = Math.min(state.cargo[c.ore!], c.target - c.progress);
        state.cargo[c.ore!] -= take;
        c.progress += take;
        break;
      }
      case 'refinement': {
        const take = Math.min(Math.floor(state.ingots[c.ore!]), c.target - c.progress);
        state.ingots[c.ore!] -= take;
        c.progress += take;
        break;
      }
      case 'sustain':
        c.held = rate >= c.target ? c.held + dt : 0;
        c.progress = Math.min(CONTRACT.sustainSec, c.held);
        break;
      case 'construction':
        // Built by hand from the BOARD (buildContract); nothing to track meanwhile.
        break;
      default:
        c.progress = Math.min(c.target, counterFor(state, c.type) - c.baseline);
    }
    const goal = c.type === 'sustain' ? CONTRACT.sustainSec : c.target;
    if (c.progress >= goal - 1e-9) {
      complete(state, c, events);
      continue;
    }
    // Deadlines pause while you're away.
    if (!offline) c.deadline -= dt;
    if (c.deadline <= 0) {
      C.active = C.active.filter((x) => x !== c);
      C.failed++;
      changeStanding(state, c, -CONTRACT.failStanding);
      news(events, `Contract expired — ${c.title}.`, false, 'corp');
    }
  }
}

// ---------------------------------------------------------------- bonds

/** A new crew member may bond with someone already aboard. */
export function rollBond(state: GameState, p: PilotState, rng = new Rng(state.rng)): void {
  const others = state.pilots.filter((x) => x.id !== p.id && !state.bonds.some((b) => (b.a === x.id || b.b === x.id) && (b.a === p.id || b.b === p.id)));
  if (!others.length || rng.next() > BOND_CHANCE) {
    state.rng = rng.state;
    return;
  }
  const other = others[Math.floor(rng.next() * others.length)];
  const types: BondType[] = ['rivals', 'partners', 'mentor'];
  const type = types[Math.floor(rng.next() * types.length)];
  // Mentor is always the higher-level pilot (stored as a).
  const [a, b] = type === 'mentor' && other.level < p.level ? [p.id, other.id] : [other.id, p.id];
  state.bonds.push({ a, b, type });
  state.rng = rng.state;
}

export function bondsOf(state: GameState, pilotId: number) {
  return state.bonds.filter((b) => b.a === pilotId || b.b === pilotId);
}

/** Story bond: Juno and Kit are partners. */
export function ensureStoryBonds(state: GameState): void {
  const juno = state.pilots.find((p) => p.story === 'juno');
  const kit = state.pilots.find((p) => p.story === 'kit');
  if (juno && kit && !state.bonds.some((b) => [b.a, b.b].includes(juno.id) && [b.a, b.b].includes(kit.id))) {
    state.bonds.push({ a: juno.id, b: kit.id, type: 'partners' });
  }
}

/** Effects for a squad of pilots flying together. */
export function squadBondEffects(state: GameState, pilotIds: number[]) {
  const set = new Set(pilotIds);
  const powerMult = new Map<number, number>();
  let damageTaken = 1;
  const xpMult = new Map<number, number>();
  const lines: string[] = [];
  for (const b of state.bonds) {
    if (!set.has(b.a) || !set.has(b.b)) continue;
    const pa = pilotById(state, b.a);
    const pb = pilotById(state, b.b);
    if (b.type === 'rivals') {
      powerMult.set(b.a, (powerMult.get(b.a) ?? 1) * 1.1);
      powerMult.set(b.b, (powerMult.get(b.b) ?? 1) * 1.1);
      if (pa && pb) lines.push(`${pa.callsign}: "Try to keep up, ${pb.callsign}." ${pb.callsign}: "Watch your six, show-off."`);
    } else if (b.type === 'partners') {
      damageTaken *= 0.85;
      if (pa && pb) lines.push(`${pa.callsign} and ${pb.callsign} fly wing-to-wing, covering each other.`);
    } else {
      xpMult.set(b.b, 1.5);
      if (pa && pb) lines.push(`${pa.callsign} talks ${pb.callsign} through the approach.`);
    }
  }
  return { powerMult, damageTaken, xpMult, lines };
}

// ---------------------------------------------------------------- time

export function advanceTrade(state: GameState, dt: number, events: TickEvents, offline: boolean): void {
  ensureTradeSector(state);
  advanceMerchants(state, dt, events, offline);
  advanceContracts(state, dt, events, offline);
}

