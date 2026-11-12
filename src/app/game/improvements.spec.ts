import { describe, expect, it } from 'vitest';
import * as E from './engine';
import * as F from './fold-rules';
import { partDef } from './fleet-data';
import { IMPROVEMENT, improvementDef } from './improvement-data';
import * as IR from './improvement-rules';
import { CORPS, STANDING, corpDef } from './trade-data';
import * as TR from './trade-rules';
import { Contract, GameState } from './types';

/** A late-ish save that can refine every ore and forge every alloy. */
function industrial(): GameState {
  const s = E.newGame('Rook', 'Halberd', 1, 31);
  s.stats.creditsEarned = 1e9;
  s.credits = 1e12;
  s.drill.tier = 5;
  for (const id of ['refinery', 'alloys', 'drill_mk5']) s.research.levels[id] = 1;
  s.threats.nextIn = Infinity;
  s.anomalies.nextIn = Infinity;
  s.trade.nextIn = Infinity;
  return s;
}

/** Refreshes the board until a construction contract for this improvement turns up, then accepts it. */
function takeConstruction(s: GameState, want?: string): Contract {
  for (let i = 0; i < 400; i++) {
    TR.refreshBoard(s);
    const c = s.contracts.board.find((x) => x.type === 'construction' && (!want || x.improvement === want));
    if (c) {
      expect(TR.acceptContract(s, c.id)).toBe(true);
      return c;
    }
  }
  throw new Error(`no construction contract for ${want ?? 'anything'}`);
}

function stock(s: GameState, c: Contract): void {
  const cost = IR.buildCost(s, c);
  for (const [o, n] of Object.entries(cost.ingots)) s.ingots[o as keyof typeof s.ingots] = n!;
  for (const [a, n] of Object.entries(cost.alloys)) s.alloys[a as keyof typeof s.alloys] = n!;
}

describe('sector improvements', () => {
  it('a construction contract lists its ingots and alloys, and building it completes the contract', () => {
    const s = industrial();
    const c = takeConstruction(s, 'research_lab');
    expect(c.materials!.ingots.titanite).toBeGreaterThan(0);
    expect(c.materials!.alloys.iridsteel).toBeGreaterThan(0);
    expect(IR.buildBlocker(s, c)).not.toBeNull();
    const before = E.researchSpeed(s);
    stock(s, c);
    const credits = s.credits;
    expect(TR.buildContract(s, c.id, E.emptyEvents())).toBe(true);
    expect(s.ingots.titanite).toBe(0);
    expect(s.alloys.iridsteel).toBe(0);
    expect(s.credits).toBeGreaterThan(credits);
    expect(s.contracts.active.length).toBe(0);
    expect(IR.builtHere(s)).toContain('research_lab');
    expect(E.researchSpeed(s)).toBeCloseTo(before * 1.3, 6);
  });

  it('each improvement is offered once per sector, and only when its materials can be made', () => {
    const s = industrial();
    s.research.levels['alloys'] = 0;
    for (let i = 0; i < 60; i++) {
      TR.refreshBoard(s);
      for (const c of s.contracts.board.filter((x) => x.type === 'construction')) {
        expect(improvementDef(c.improvement!).tier).toBe(1); // no forge: ingots-only jobs
      }
    }
    const t = industrial();
    const c = takeConstruction(t, 'mining_station');
    stock(t, c);
    TR.buildContract(t, c.id, E.emptyEvents());
    for (let i = 0; i < 100; i++) {
      TR.refreshBoard(t);
      expect(t.contracts.board.some((x) => x.improvement === 'mining_station')).toBe(false);
    }
  });

  it('bonuses apply sector-wide and are left behind by a Fold Jump', () => {
    const s = industrial();
    s.drones.prospector = 50;
    const rate = E.droneRateTotal(s);
    const c = takeConstruction(s, 'mining_station');
    stock(s, c);
    TR.buildContract(s, c.id, E.emptyEvents());
    expect(E.droneRateTotal(s)).toBeCloseTo(rate * 1.2, 6);
    s.research.levels['fold_drive'] = 1;
    s.fold.charge = 1;
    const next = F.foldJump(s)!.state;
    expect(IR.builtHere(next)).toEqual([]);
    expect(IR.improvementBonus(next, 'production')).toBe(0);
  });

  it('the Verdant Horizon Colonial Trust commissions colonies, and trusting it trims the materials', () => {
    const s = industrial();
    expect(corpDef('colonial').types).toContain('construction');
    const c = takeConstruction(s, 'habitat_dome');
    const full = IR.buildCost(s, c).ingots.ferrite!;
    s.contracts.standing.colonial = STANDING.trusted;
    expect(IR.buildCost(s, c).ingots.ferrite!).toBe(Math.ceil(c.materials!.ingots.ferrite! * IMPROVEMENT.colonialDiscount));
    expect(IR.buildCost(s, c).ingots.ferrite!).toBeLessThan(full);
    // Partner: the Trust's exclusive part.
    expect(partDef(corpDef('colonial').exclusive).rarity).toBe('unique');
  });

  it('every corporation has an exclusive part, and they are stronger than before', () => {
    for (const corp of CORPS) expect(partDef(corp.exclusive)).toBeTruthy();
    expect(partDef('meridian_core').supply).toBeGreaterThan(48);
    expect(partDef('aster_capacitor').supply).toBeGreaterThan(40);
    expect(partDef('orrery_array').stats.sensors).toBeGreaterThan(24);
    expect(partDef('vanguard_aegis').stats.armor).toBeGreaterThan(80);
  });
});
