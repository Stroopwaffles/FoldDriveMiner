import * as E from './engine';
import { PERMANENT_NODES } from './fold-data';
import { partDef } from './fleet-data';
import * as F from './fold-rules';
import { migrate } from './save';
import { researchNode } from './research';
import { GameState } from './types';

function hangar(): GameState {
  const s = E.newGame('Rook', 'Halberd Dawn', 1, 777);
  s.credits = 1e7;
  s.threats.nextIn = Infinity;
  s.anomalies.nextIn = Infinity;
  s.trade.nextIn = Infinity;
  s.research.levels['hangar'] = 1;
  s.research.levels['hangar_bays'] = 2;
  s.research.levels['loadout_memory'] = 1;
  E.ensureCrew(s);
  return s;
}

/** A Pickaxe with a reactor, drill and armor, piloted by Juno and mining. */
function fittedPickaxe(s: GameState) {
  const m = E.buildMech(s, 'pickaxe')!;
  for (const [slot, id] of [
    ['reactor', 'fusion_cell'],
    ['drill', 'hand_drill'],
    ['armor', 'plate_mk1'],
  ] as const) {
    E.buyPart(s, id);
    E.equipPart(s, m.id, slot, id);
  }
  const juno = s.pilots.find((p) => p.story === 'juno')!;
  E.seatPilot(s, m.id, juno.id);
  E.setMechJob(s, m.id, 'mining');
  return { m, juno };
}

const PARTS_COST = ['fusion_cell', 'hand_drill', 'plate_mk1'].reduce((a, id) => a + partDef(id).cost, 0);

describe('Loadout Memory: research gate', () => {
  it('is a Fleet node that needs the Mech Hangar and becomes permanent QoL', () => {
    const node = researchNode('loadout_memory');
    expect(node.requires).toEqual(['hangar']);
    expect(node.branch).toBe('fleet');
    expect(PERMANENT_NODES).toContain('loadout_memory');
  });

  it('saving, rebuilding and auto-rebuild need the research', () => {
    const s = hangar();
    const { m } = fittedPickaxe(s);
    s.research.levels['loadout_memory'] = 0;
    expect(E.loadoutsUnlocked(s)).toBe(false);
    expect(E.saveLoadout(s, m.id)).toBeNull();
    expect(E.setAutoRebuild(s, true)).toBe(false);

    s.research.levels['loadout_memory'] = 1;
    const l = E.saveLoadout(s, m.id)!;
    s.research.levels['loadout_memory'] = 0;
    E.scrapMech(s, m.id);
    const r = E.rebuildLoadout(s, l.id);
    expect(r.built).toEqual([]);
    expect(r.issues[0]).toMatch(/Loadout Memory/);
    expect(s.mechs.length).toBe(0);
  });
});

describe('Loadout Memory: saving', () => {
  it('saves frame, parts, pilot, job and zone, and updates instead of duplicating', () => {
    const s = hangar();
    const { m, juno } = fittedPickaxe(s);
    const l = E.saveLoadout(s, m.id)!;
    expect(l.frame).toBe('pickaxe');
    expect(l.parts).toEqual({ reactor: 'fusion_cell', drill: 'hand_drill', armor: 'plate_mk1' });
    expect(l.pilotId).toBe(juno.id);
    expect(l.job).toBe('mining');
    expect(l.zone).toBe(m.zone);
    expect(E.mechLoadout(s, m.id)?.id).toBe(l.id);

    E.equipPart(s, m.id, 'armor', null);
    E.saveLoadout(s, m.id, false);
    expect(s.loadouts.saved.length).toBe(1);
    expect(s.loadouts.saved[0].parts.armor).toBeUndefined();
    expect(s.loadouts.saved[0].pilotId).toBeNull();
    expect(s.loadouts.saved[0].job).toBe('idle');
  });

  it('renames and deletes', () => {
    const s = hangar();
    const { m } = fittedPickaxe(s);
    const l = E.saveLoadout(s, m.id)!;
    expect(E.renameLoadout(s, l.id, '  Digger One  ')).toBe(true);
    expect(l.name).toBe('Digger One');
    expect(E.renameLoadout(s, l.id, '   ')).toBe(false);
    expect(E.deleteLoadout(s, l.id)).toBe(true);
    expect(s.loadouts.saved).toEqual([]);
  });
});

describe('Loadout Memory: rebuilding', () => {
  it('builds the frame and buys exactly the missing standard parts, using storage first', () => {
    const s = hangar();
    const { m } = fittedPickaxe(s);
    const l = E.saveLoadout(s, m.id)!;
    E.scrapMech(s, m.id); // parts go back to storage
    s.parts['hand_drill'] = 0;
    s.parts['plate_mk1'] = 0;

    const before = s.credits;
    const cost = E.rebuildCost(s, [l.id]);
    expect(cost.frames).toBe(1);
    expect(cost.fromStores).toEqual(['Fusion Cell']);
    expect(cost.buy.sort()).toEqual(['Hand Drill', 'Plate Mk.I']);
    const expected = E.mechBuildCost(s, 'pickaxe') + partDef('hand_drill').cost + partDef('plate_mk1').cost;
    expect(cost.credits).toBe(expected);

    const r = E.rebuildLoadout(s, l.id);
    expect(r.issues).toEqual([]);
    expect(r.built).toEqual([l.name]);
    expect(r.bought).toBe(2);
    expect(r.spent).toBe(expected);
    expect(before - s.credits).toBe(expected);
    expect(s.parts['fusion_cell']).toBe(0);

    const built = E.loadoutMech(s, l)!;
    expect(built.parts).toEqual(l.parts);
    expect(built.pilotId).toBe(l.pilotId);
    expect(built.job).toBe('mining');
    // Nothing left to do now.
    expect(E.rebuildCost(s, [l.id]).credits).toBe(0);
  });

  it('skips what it cannot afford, never spends Data Cores, and says so', () => {
    const s = hangar();
    const { m } = fittedPickaxe(s);
    const l = E.saveLoadout(s, m.id)!;
    E.scrapMech(s, m.id);
    s.parts = {};
    s.dataCores = 50;
    // Enough for the frame and the reactor, not the rest.
    s.credits = E.mechBuildCost(s, 'pickaxe') + partDef('fusion_cell').cost + 100;

    const r = E.rebuildLoadout(s, l.id);
    expect(r.built).toEqual([l.name]);
    expect(E.loadoutMech(s, l)!.parts).toEqual({ reactor: 'fusion_cell' });
    expect(r.issues.some((i) => /couldn't afford Hand Drill/.test(i))).toBe(true);
    expect(r.issues.some((i) => /couldn't afford Plate Mk\.I/.test(i))).toBe(true);
    expect(s.credits).toBe(100);
    expect(s.dataCores).toBe(50);

    // With more credits a second press refits the same mech instead of building another.
    s.credits = PARTS_COST;
    E.rebuildLoadout(s, l.id);
    expect(s.mechs.length).toBe(1);
    expect(E.loadoutMech(s, l)!.parts).toEqual(l.parts);
  });

  it('reports a frame it cannot afford, locked parts and missing uniques', () => {
    const s = hangar();
    const m = E.buildMech(s, 'bulwark')!;
    s.parts['crimson_lance'] = 1;
    s.parts['he3_reactor'] = 1;
    E.equipPart(s, m.id, 'drill', 'crimson_lance');
    E.equipPart(s, m.id, 'reactor', 'he3_reactor');
    const l = E.saveLoadout(s, m.id)!;
    E.scrapMech(s, m.id);
    s.parts = {};

    const cost = E.rebuildCost(s, [l.id]);
    expect(cost.blocked.join(' ')).toMatch(/Crimson Fang Lance isn't in the Vault/);
    expect(cost.blocked.join(' ')).toMatch(/Helium-3 Reactor needs Mech Engineering/);

    const poor = structuredClone(s);
    poor.credits = 10;
    expect(E.rebuildLoadout(poor, l.id).issues[0]).toMatch(/can't afford the Bulwark frame/);
    expect(poor.mechs.length).toBe(0);

    const r = E.rebuildLoadout(s, l.id);
    expect(r.built.length).toBe(1);
    expect(r.issues.some((i) => /unique/.test(i))).toBe(true);
    expect(r.issues.some((i) => /locked/.test(i))).toBe(true);
  });

  it('never pulls a pilot out of another mech, and stops at full bays', () => {
    const s = hangar();
    const { m, juno } = fittedPickaxe(s);
    const l = E.saveLoadout(s, m.id)!;
    l.mechId = null; // pretend its mech is gone; Juno still flies m
    const r = E.rebuildLoadout(s, l.id);
    expect(r.issues).toContain(`${l.name}: ${juno.callsign} is flying ${m.designation}`);
    expect(m.pilotId).toBe(juno.id);

    while (s.mechs.length < E.hangarBays(s)) E.buildMech(s, 'kestrel');
    l.mechId = null;
    expect(E.rebuildLoadout(s, l.id).issues[0]).toMatch(/no free hangar bay/);
  });
});

describe('Loadout Memory: Fold Jumps', () => {
  function jumpReady(): GameState {
    const s = hangar();
    s.research.levels['fold_drive'] = 1;
    s.fold.charge = 1;
    s.stats.creditsEarned = 1e8;
    return s;
  }

  it('loadouts survive a jump, unlinked from the mechs left behind', () => {
    const s = jumpReady();
    const { m } = fittedPickaxe(s);
    E.saveLoadout(s, m.id);
    E.renameLoadout(s, s.loadouts.saved[0].id, 'Old Faithful');
    const n = F.foldJump(s)!.state;
    expect(n.mechs).toEqual([]);
    expect(n.loadouts.saved.length).toBe(1);
    expect(n.loadouts.saved[0].name).toBe('Old Faithful');
    expect(n.loadouts.saved[0].parts).toEqual({ reactor: 'fusion_cell', drill: 'hand_drill', armor: 'plate_mk1' });
    expect(n.loadouts.saved[0].mechId).toBeNull();
    expect(n.loadouts.pending).toBe(false);
  });

  it('auto-rebuild waits for credits after a jump, then builds', () => {
    const s = jumpReady();
    const { m } = fittedPickaxe(s);
    E.saveLoadout(s, m.id);
    E.setAutoRebuild(s, true);
    const n = F.foldJump(s)!.state;
    expect(n.loadouts.pending).toBe(true);
    // The research has to come back first (or be permanent / archived).
    n.research.levels['hangar'] = 1;
    n.research.levels['loadout_memory'] = 1;
    n.threats.nextIn = Infinity;
    n.anomalies.nextIn = Infinity;
    n.trade.nextIn = Infinity;
    n.credits = 10;
    E.tick(n, 0.1);
    expect(n.mechs.length).toBe(0);
    n.credits = E.rebuildCost(n).credits;
    const ev = E.tick(n, 0.1);
    expect(ev.rebuilt?.length).toBe(1);
    expect(n.mechs.length).toBe(1);
    expect(n.mechs[0].parts).toEqual(n.loadouts.saved[0].parts);
    expect(n.loadouts.pending).toBe(false);
  });

  it('old saves without loadouts load with empty defaults', () => {
    const s = hangar();
    const raw = JSON.parse(JSON.stringify(s));
    delete raw.loadouts;
    const loaded = migrate(raw);
    expect(loaded.loadouts).toEqual({ saved: [], auto: false, pending: false, nextId: 1 });
  });
});
