import * as E from './engine';
import { partDef } from './fleet-data';
import { CURRENT_VERSION, migrate } from './save';
import * as S from './sector-rules';
import * as T from './threat-rules';
import { CONTRACT, MERCHANT, STANDING } from './trade-data';
import * as TR from './trade-rules';
import { GameState } from './types';
import { Rng } from './rng';

function rich(): GameState {
  const s = E.newGame('Rook', 'Halberd Dawn', 1, 9090);
  s.credits = 1e12;
  s.surveyData = 1e6;
  s.drill.tier = 2;
  s.stats.creditsEarned = 1e6;
  s.threats.nextIn = Infinity;
  s.anomalies.nextIn = Infinity;
  return s;
}

function run(s: GameState, sec: number, step = 1) {
  for (let t = 0; t < sec; t += step) E.tick(s, step);
}

describe('milestone 5b: merchant convoys', () => {
  it('a convoy arrives once you are earning, then departs', () => {
    const s = rich();
    s.trade.nextIn = 1;
    run(s, 2);
    expect(s.trade.fleets.length).toBe(1);
    expect(s.trade.fleets[0]!.stock.length).toBeGreaterThanOrEqual(MERCHANT.baseItems - 1);
    run(s, MERCHANT.stayMax + 5, 5);
    expect(s.trade.fleets.length).toBe(0);
  });

  it('the Lantern Market only trades in pirate havens', () => {
    const s = rich();
    for (let i = 0; i < 40; i++) {
      TR.spawnFleet(s, E.emptyEvents());
      expect(s.trade.fleets[0]!.clan).not.toBe('lantern');
    }
  });

  it('buying with credits or barter, and reputation grows', () => {
    const s = rich();
    s.cargo.titanite = 1e6;
    s.cargo.iridium = 1e6;
    s.drill.tier = 3;
    TR.spawnFleet(s, E.emptyEvents(), 'halcyon');
    const f = s.trade.fleets[0]!;
    const part = f.stock.find((x) => x.kind === 'part')!;
    expect(part).toBeDefined();
    expect(TR.buyItem(s, part.id, 'credits', E.emptyEvents())).toBe(true);
    expect(s.parts[part.partId!]).toBe(1);
    expect(s.trade.rep.halcyon).toBeGreaterThan(0);
    expect(TR.buyItem(s, part.id, 'credits', E.emptyEvents())).toBe(false); // sold
    const barter = f.stock.find((x) => !x.sold && x.barterOre);
    if (barter) {
      const before = s.cargo[barter.barterOre!];
      expect(TR.buyItem(s, barter.id, 'barter', E.emptyEvents())).toBe(true);
      expect(s.cargo[barter.barterOre!]).toBe(before - barter.barterAmount!);
    }
  });

  it('sector-unique parts are 30% stronger than the base part', () => {
    const p = partDef('sx:123:breaker');
    expect(p.rarity).toBe('unique');
    expect(p.stats.mining).toBe(Math.round(12 * 1.3));
    expect(p.name).toContain('Pneumatic Breaker');
  });

  it('charts reveal hidden anomalies; ore contracts raise prices for the sector', () => {
    const s = rich();
    TR.spawnFleet(s, E.emptyEvents(), 'grey_tithe');
    s.trade.fleets[0]!.stock = [
      { id: 900, kind: 'chart', label: 'chart', desc: '', price: 1, sold: false },
      { id: 901, kind: 'ore_contract', label: 'oc', desc: '', price: 1, ore: 'ferrite', sold: false },
    ];
    const hidden = s.anomalies.list.filter((a) => a.status === 'hidden').length;
    expect(hidden).toBeGreaterThan(0);
    TR.buyItem(s, 900, 'credits', E.emptyEvents());
    expect(s.anomalies.list.filter((a) => a.status === 'hidden').length).toBe(0);
    const price = E.orePrice(s, 'ferrite');
    TR.buyItem(s, 901, 'credits', E.emptyEvents());
    expect(E.orePrice(s, 'ferrite')).toBeCloseTo(price * 1.25, 6);
  });

  it('a countermeasure cancels a sector trait', () => {
    let seed = 1;
    while (!S.generateSector(seed, 1).traits.includes('ion_storms')) seed++;
    const s = rich();
    s.sector.seed = seed;
    s.sector.depth = 1;
    E.syncSector(s);
    TR.ensureTradeSector(s);
    expect(S.sectorMods(s).clickPower).toBeLessThan(1);
    s.trade.sectorBuffs.cancelled.push('ion_storms');
    expect(S.sectorMods(s).clickPower).toBeGreaterThanOrEqual(1 - 1e-9);
  });

  it('a convoy that arrives while you are away waits for you', () => {
    const s = rich();
    s.trade.nextIn = 10;
    E.simulateOffline(s, 3600);
    expect(s.trade.fleets.length).toBe(0);
    expect(s.trade.pending).toBe(true);
    run(s, 1);
    expect(s.trade.fleets.length).toBe(1);
    expect(s.trade.fleets[0]!.remaining).toBeCloseTo(MERCHANT.waitAfterReturn, 0);
  });

  it('favors and escorts earn reputation', () => {
    const s = rich();
    TR.spawnFleet(s, E.emptyEvents(), 'okonkwo');
    const f = s.trade.fleets[0]!;
    s.cargo[f.favor!.ore] = f.favor!.amount;
    const rep = s.trade.rep.okonkwo;
    expect(TR.deliverFavor(s, E.emptyEvents())).toBe(true);
    expect(s.trade.rep.okonkwo).toBe(rep + MERCHANT.favorRep);
    s.drones.guardian = 200;
    s.research.levels['guardian_drones'] = 1;
    const r = T.launchEscort(s, [], true, E.emptyEvents())!;
    expect(r.title).toBe('Convoy Escort');
    expect(f.escortDone).toBe(true);
    if (r.outcome !== 'defeat') expect(s.trade.rep.okonkwo).toBe(rep + MERCHANT.favorRep + MERCHANT.escortRep);
  });

  it('repair kits and med kits work', () => {
    const s = rich();
    s.research.levels['hangar'] = 1;
    E.ensureCrew(s);
    const m = E.buildMech(s, 'pickaxe')!;
    m.armor = 1;
    s.trade.inventory.repair_kit = 1;
    expect(TR.useRepairKit(s, m.id)).toBe(true);
    expect(m.armor).toBe(E.mechStats(s, m).armor);
    s.pilots[0].injuredRemaining = 500;
    s.trade.inventory.medkit = 1;
    expect(TR.useMedkit(s, s.pilots[0].id)).toBe(true);
    expect(s.pilots[0].injuredRemaining).toBe(0);
  });
});

describe('milestone 5b: contracts', () => {
  it('the board fills once you are earning and offers a local outfit job', () => {
    const s = rich();
    expect(s.contracts.local.length).toBeGreaterThanOrEqual(1);
    run(s, 1);
    expect(s.contracts.board.length).toBeGreaterThan(0);
    expect(s.contracts.board.some((c) => c.issuer.kind === 'local')).toBe(true);
  });

  it('delivery contracts pull ore from the hold and pay out with standing', () => {
    const s = rich();
    TR.refreshBoard(s);
    s.contracts.board = [
      {
        id: 999, issuer: { kind: 'corp', id: 'meridian' }, type: 'delivery', title: 't', ore: 'ferrite', target: 100, progress: 0,
        deadline: 600, duration: 600, reward: { credits: 5000, surveyData: 3, dataCores: 0 }, baseline: 0, held: 0,
      },
    ];
    expect(TR.acceptContract(s, 999)).toBe(true);
    s.cargo.ferrite = 60;
    run(s, 1);
    expect(s.contracts.active[0].progress).toBe(60);
    const credits = s.credits;
    s.cargo.ferrite = 100;
    run(s, 1);
    expect(s.contracts.active.length).toBe(0);
    expect(s.credits).toBeGreaterThanOrEqual(credits + 5000);
    expect(s.contracts.standing.meridian).toBe(2);
    expect(s.cargo.ferrite).toBe(60);
  });

  it('deadlines pause while you are away and expire while you play', () => {
    const s = rich();
    s.contracts.active = [
      {
        id: 5, issuer: { kind: 'corp', id: 'orrery' }, type: 'survey', title: 't', target: 3, progress: 0,
        deadline: 100, duration: 100, reward: { credits: 1, surveyData: 0, dataCores: 0 }, baseline: 0, held: 0,
      },
    ];
    s.contracts.standing.orrery = 4;
    E.simulateOffline(s, 3600);
    expect(s.contracts.active[0].deadline).toBe(100);
    run(s, 101);
    expect(s.contracts.active.length).toBe(0);
    expect(s.contracts.standing.orrery).toBe(4 - CONTRACT.failStanding);
  });

  it('contract slots grow with the Contract Office', () => {
    const s = rich();
    expect(TR.contractSlots(s)).toBe(1);
    s.research.levels['contract_office'] = 2;
    expect(TR.contractSlots(s)).toBe(3);
  });

  it('corporate perks and exclusives', () => {
    const s = rich();
    const cost = E.droneCost(s, 1);
    s.contracts.standing.meridian = STANDING.trusted;
    expect(E.droneCost(s, 1)).toBeCloseTo(cost * 0.95, 6);
    const raid = T.raidStrength(s);
    s.contracts.standing.vanguard = STANDING.trusted;
    expect(T.raidStrength(s)).toBeCloseTo(raid * 0.9, 6);
  });

  it('maxing a local outfit grants a Sector Legacy', () => {
    const s = rich();
    const o = s.contracts.local[0];
    o.standing = CONTRACT.localLegacy - 3;
    s.contracts.active = [
      {
        id: 7, issuer: { kind: 'local', id: o.id }, type: 'delivery', title: 't', ore: 'ferrite', target: 1, progress: 0,
        deadline: 600, duration: 600, reward: { credits: 10, surveyData: 0, dataCores: 0 }, baseline: 0, held: 0,
      },
    ];
    s.cargo.ferrite = 5;
    run(s, 1);
    expect(o.standing).toBe(CONTRACT.localLegacy);
    expect(o.legacyClaimed).toBe(true);
  });

  it('local standing stops at the Sector Legacy, even after more contracts', () => {
    const s = rich();
    const o = s.contracts.local[0];
    o.standing = CONTRACT.localLegacy - 1;
    s.contracts.active = [
      {
        id: 8, issuer: { kind: 'local', id: o.id }, type: 'delivery', title: 't', ore: 'ferrite', target: 1, progress: 0,
        deadline: 600, duration: 600, reward: { credits: 10, surveyData: 0, dataCores: 0 }, baseline: 0, held: 0,
      },
    ];
    s.cargo.ferrite = 5;
    run(s, 1);
    expect(o.standing).toBe(CONTRACT.localLegacy);
    // Saves from before the cap are brought back down on load.
    o.standing = CONTRACT.localLegacy + 7;
    TR.ensureTradeSector(s);
    expect(o.standing).toBe(CONTRACT.localLegacy);
  });
});

describe('milestone 5b: pilot bonds', () => {
  it('Juno and Kit are partners', () => {
    const s = rich();
    s.research.levels['hangar'] = 1;
    s.research.levels['repair_bay'] = 1;
    E.ensureCrew(s);
    const [juno, kit] = s.pilots;
    expect(s.bonds).toEqual([{ a: juno.id, b: kit.id, type: 'partners' }]);
    const fx = TR.squadBondEffects(s, [juno.id, kit.id]);
    expect(fx.damageTaken).toBeCloseTo(0.85, 6);
    expect(TR.squadBondEffects(s, [juno.id]).damageTaken).toBe(1);
  });

  it('rivals hit harder together; mentors speed up students', () => {
    const s = rich();
    s.bonds = [
      { a: 1, b: 2, type: 'rivals' },
      { a: 3, b: 4, type: 'mentor' },
    ];
    const fx = TR.squadBondEffects(s, [1, 2, 3, 4]);
    expect(fx.powerMult.get(1)).toBeCloseTo(1.1, 6);
    expect(fx.powerMult.get(2)).toBeCloseTo(1.1, 6);
    expect(fx.xpMult.get(4)).toBe(1.5);
    expect(fx.xpMult.get(3)).toBeUndefined();
  });

  it('new recruits sometimes bond with the crew', () => {
    let bonded = 0;
    for (let i = 0; i < 40; i++) {
      const s = E.newGame('R', 'H', 1, 1000 + i);
      s.research.levels['hangar'] = 1;
      E.ensureCrew(s);
      const p = E.generatePilot(s, new (class {
        state = 1;
        next() {
          return Math.random();
        }
        range(a: number, b: number) {
          return a + (b - a) * Math.random();
        }
        int(a: number) {
          return a;
        }
      })() as never);
      s.pilots.push(p);
      TR.rollBond(s, p);
      if (s.bonds.length) bonded++;
    }
    expect(bonded).toBeGreaterThan(0);
    expect(bonded).toBeLessThan(40);
  });

  it('migrates a version 5 save', () => {
    const v5 = E.newGame('Rook', 'Halberd', 1, 1) as unknown as Record<string, unknown>;
    v5['version'] = 5;
    delete v5['trade'];
    delete v5['contracts'];
    delete v5['bonds'];
    const m = migrate(v5);
    expect(m.version).toBe(CURRENT_VERSION);
    expect(m.trade.rep.halcyon).toBe(0);
    expect(m.contracts.local.length).toBeGreaterThanOrEqual(1);
    expect(m.bonds).toEqual([]);
  });
});

describe('crack-asteroids blitz contracts', () => {
  it('ask for a real share of what Overdrive clicking can crack in 10 minutes', () => {
    const { blitzTarget } = TR;
    const s = E.newGame('Rook', 'Halberd', 1, 7);
    const rng = new Rng(1);
    const targets = Array.from({ length: 20 }, () => blitzTarget(s, rng));
    expect(Math.min(...targets)).toBeGreaterThanOrEqual(CONTRACT.blitz.minTarget);
    expect(Math.min(...targets)).toBeGreaterThan(10);
    // Half of what's possible at most: never above the steady-clicking ceiling.
    expect(Math.max(...targets)).toBeLessThanOrEqual(CONTRACT.blitz.maxTarget);
    // A stronger drill against the same rocks means a bigger ask.
    s.drill.powerLevel = 20;
    const strong = Array.from({ length: 20 }, () => blitzTarget(s, rng));
    expect(Math.min(...strong)).toBeGreaterThan(Math.min(...targets));
  });
});
