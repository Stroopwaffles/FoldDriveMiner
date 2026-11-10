import * as E from './engine';
import { FOLD } from './fold-data';
import * as F from './fold-rules';
import { CURRENT_VERSION, migrate } from './save';
import * as S from './sector-rules';
import { GameState } from './types';

function ready(): GameState {
  const s = E.newGame('Rook', 'Halberd Dawn', 1, 31337);
  s.credits = 1e9;
  s.surveyData = 1e5;
  s.drill.tier = 4;
  s.threats.nextIn = Infinity;
  s.anomalies.nextIn = Infinity;
  s.trade.nextIn = Infinity;
  s.research.levels['fold_drive'] = 1;
  s.stats.creditsEarned = 1e8;
  return s;
}

describe('milestone 6: charging the Fold Drive', () => {
  it('Helium-3 and Voidglass charge the drive; ingots count as the ore that made them', () => {
    const s = ready();
    const need = F.chargeNeeded(s);
    s.cargo.helium3 = need / 2;
    F.feedDrive(s);
    expect(s.fold.charge).toBeCloseTo(0.5, 6);
    expect(s.cargo.helium3).toBeCloseTo(0, 6);
    s.ingots.helium3 = 10;
    const before = s.fold.charge;
    F.feedDrive(s);
    expect(s.fold.charge - before).toBeCloseTo((10 * E.oreRatio(s)) / need, 6);
    expect(F.fuelUnits(s, 'voidglass', false)).toBe(FOLD.voidglassUnits);
    expect(F.fuelUnits(s, 'ferrite', false)).toBe(0);
  });

  it('charge stops at the cap; over-charge research raises it', () => {
    const s = ready();
    s.cargo.helium3 = 1e9;
    F.feedDrive(s);
    expect(s.fold.charge).toBeCloseTo(1, 6);
    s.research.levels['overcharge_cap'] = 2;
    F.feedDrive(s);
    expect(s.fold.charge).toBeCloseTo(1.5, 6);
  });

  it('auto-feed pulls fuel from the hold each tick; nothing works without the research', () => {
    const s = ready();
    s.fold.autoFeed = true;
    s.cargo.helium3 = 100;
    E.tick(s, 0.1);
    expect(s.fold.charge).toBeGreaterThan(0);
    const t = ready();
    t.research.levels['fold_drive'] = 0;
    t.cargo.helium3 = 100;
    expect(F.feedDrive(t)).toBe(0);
  });

  it('efficiency research and Fold Harmonics make fuel go further; deeper sectors need more', () => {
    const s = ready();
    const base = F.chargeEfficiency(s);
    s.research.levels['charge_efficiency'] = 2;
    s.fold.core['core_harmonics'] = 1;
    expect(F.chargeEfficiency(s)).toBeCloseTo(base + 0.4 + 0.15, 6);
    const need0 = F.chargeNeeded(s);
    s.sector.depth = 2;
    expect(F.chargeNeeded(s)).toBeCloseTo(need0 * FOLD.chargeGrowth ** 2, 6);
  });
});

describe('milestone 6: Fold Resonance and the Jump Core', () => {
  it('Resonance grows with run earnings and over-charge', () => {
    const s = ready();
    s.fold.charge = 1;
    const g = F.resonanceGain(s);
    expect(g).toBe(Math.floor(Math.sqrt(1e8 / 1e6) * FOLD.resonanceMult));
    s.fold.charge = 1.5;
    expect(F.resonanceGain(s)).toBeGreaterThan(g);
    s.fold.runStartCredits = 1e8;
    expect(F.resonanceGain(s)).toBe(1); // minimum
  });

  it('lifetime Resonance boosts production', () => {
    const s = ready();
    s.drones.prospector = 10;
    const before = E.droneRateTotal(s);
    s.fold.lifetimeResonance = 10;
    expect(E.droneRateTotal(s)).toBeCloseTo(before * 1.2, 6);
  });

  it('Jump Core upgrades cost Resonance and cap out', () => {
    const s = ready();
    s.fold.resonance = 100;
    expect(F.buyCore(s, 'core_bays')).toBe(true);
    expect(F.buyCore(s, 'core_bays')).toBe(true);
    expect(F.buyCore(s, 'core_bays')).toBe(false); // max 2
    expect(s.fold.resonance).toBe(100 - 6 - 15);
    s.research.levels['hangar'] = 1;
    expect(E.hangarBays(s)).toBe(3);
  });

  it('the archive only takes researched, non-permanent nodes up to its slots', () => {
    const s = ready();
    s.research.levels['drone_efficiency'] = 3;
    s.research.levels['cargo_compression'] = 2;
    expect(F.toggleArchive(s, 'drone_efficiency')).toBe(false); // no slots
    s.fold.core['core_archive'] = 1;
    expect(F.toggleArchive(s, 'drone_efficiency')).toBe(true);
    expect(F.toggleArchive(s, 'cargo_compression')).toBe(false); // full
    expect(F.toggleArchive(s, 'drone_efficiency')).toBe(true); // untoggle
    expect(s.fold.archive).toEqual([]);
  });
});

describe('milestone 6: the jump', () => {
  function jumpable(): GameState {
    const s = ready();
    s.fold.charge = 1;
    s.research.levels['hangar'] = 1;
    s.research.levels['repair_bay'] = 1;
    s.research.levels['refinery'] = 1;
    s.research.levels['drone_efficiency'] = 3;
    E.ensureCrew(s);
    E.syncRefinerySlots(s);
    const m = E.buildMech(s, 'bulwark')!;
    s.parts['crimson_lance'] = 1;
    s.parts['breaker'] = 2;
    E.buyPart(s, 'fusion_cell');
    E.equipPart(s, m.id, 'reactor', 'fusion_cell');
    s.parts['vermilion_plating'] = 1;
    E.equipPart(s, m.id, 'armor', 'vermilion_plating');
    s.drones.prospector = 500;
    s.cargo.ferrite = 1000;
    s.dataCores = 7;
    s.pilots[0].injuredRemaining = 999;
    s.pilots[0].level = 12;
    s.trade.rep.halcyon = 9;
    s.contracts.standing.orrery = 4;
    s.anomalies.codex = { gravity_lens: 2 };
    s.threats.jackalEncounters = 2;
    return s;
  }

  it('needs the drive and a full charge', () => {
    const s = ready();
    expect(F.canJump(s)).toMatch(/full charge/);
    s.research.levels['fold_drive'] = 0;
    expect(F.canJump(s)).toMatch(/Research/);
    expect(F.foldJump(s)).toBeNull();
  });

  it('carries the core hull to the chosen sector and leaves the rest behind', () => {
    const s = jumpable();
    s.fold.destination = 1;
    const dest = S.destinationPreview(s, F.destinationCount(s))[1].def;
    const gain = F.resonanceGain(s);
    const r = F.foldJump(s)!;
    const n = r.state;
    expect(n.sector.depth).toBe(1);
    expect(n.sector.seed).toBe(dest.seed);
    expect(n.sector.code).toBe(dest.code);
    expect(n.zone).toBe(dest.zones[0].id);
    // Comes along
    expect(n.fold.resonance).toBe(gain);
    expect(n.fold.lifetimeResonance).toBe(gain);
    expect(n.fold.jumps).toBe(1);
    expect(n.pilots.map((p) => p.story)).toEqual(['juno', 'kit']);
    expect(n.pilots[0].level).toBe(12);
    expect(n.pilots[0].injuredRemaining).toBe(0);
    expect(n.bonds.length).toBe(1);
    expect(n.dataCores).toBe(7);
    expect(n.trade.rep.halcyon).toBe(9);
    expect(n.contracts.standing.orrery).toBe(4);
    expect(n.anomalies.codex.gravity_lens).toBe(2);
    expect(n.threats.jackalEncounters).toBe(2);
    expect(n.parts['crimson_lance']).toBe(1);
    expect(n.parts['vermilion_plating']).toBe(1); // was fitted: back in the vault
    expect(n.parts['breaker']).toBeUndefined(); // standard: left behind
    expect(n.fold.blueprints).toContain('bulwark');
    // Left behind
    expect(n.credits).toBe(0);
    expect(n.cargo.ferrite).toBe(0);
    expect(n.drones.prospector).toBe(0);
    expect(n.mechs).toEqual([]);
    expect(n.research.levels['drone_efficiency']).toBeUndefined();
    expect(n.research.levels['fold_drive']).toBe(1);
    expect(n.fold.charge).toBe(0);
    expect(n.fold.runStartCredits).toBe(s.stats.creditsEarned);
    expect(r.first).toBe(true);
  });

  it('the archive and permanent research survive; QoL becomes permanent after 2 runs', () => {
    const s = jumpable();
    s.fold.core['core_archive'] = 1;
    F.toggleArchive(s, 'drone_efficiency');
    const a = F.foldJump(s)!.state;
    expect(a.research.levels['drone_efficiency']).toBe(3);
    expect(a.research.levels['refinery']).toBeUndefined(); // only 1 run so far
    expect(a.fold.qolCounts['refinery']).toBe(1);
    // Second run: research the refinery again, jump again → now permanent.
    a.research.levels['refinery'] = 1;
    a.fold.charge = 1;
    const b = F.foldJump(a)!.state;
    expect(b.research.levels['refinery']).toBe(1);
    expect(F.permanentNodes(b)).toContain('refinery');
    expect(b.sector.depth).toBe(2);
  });

  it('Jump Core head starts apply on arrival', () => {
    const s = jumpable();
    s.fold.core = { core_drones: 2, core_credits: 2, core_drill: 1 };
    const n = F.foldJump(s)!.state;
    expect(n.drones.prospector).toBe(20);
    expect(n.credits).toBe(20000);
    expect(n.drill.tier).toBe(2);
  });

  it('blueprints make known frames cheap to rebuild', () => {
    const s = jumpable();
    const n = F.foldJump(s)!.state;
    expect(E.mechBuildCost(n, 'bulwark')).toBeCloseTo(90000 * FOLD.blueprintCost, 6);
    expect(E.mechBuildCost(n, 'kestrel')).toBe(60000);
  });

  it('deeper sectors produce more and raid harder', () => {
    const s = jumpable();
    const n = F.foldJump(s)!.state;
    expect(F.depthMult(n)).toBeCloseTo(1 + FOLD.depthProduction, 6);
    expect(F.depthRaidMult(n)).toBeCloseTo(1 + FOLD.depthRaids, 6);
  });

  it('Long-Range Sensors add a destination and reveal more traits', () => {
    const s = ready();
    expect(F.destinationCount(s)).toBe(3);
    s.fold.core['core_sensors'] = 1;
    expect(F.destinationCount(s)).toBe(4);
    expect(F.revealedTraits(s)).toBe(2);
  });

  it('migrates a version 6 save', () => {
    const v6 = E.newGame('Rook', 'Halberd', 1, 1) as unknown as Record<string, unknown>;
    v6['version'] = 6;
    delete v6['fold'];
    v6['mechs'] = [{ frame: 'pickaxe' }].map((m) => ({ ...m }));
    const m = migrate({ ...v6, mechs: [] });
    expect(m.version).toBe(CURRENT_VERSION);
    expect(m.fold.charge).toBe(0);
    expect(m.fold.resonance).toBe(0);
  });
});
