import { describe, expect, it } from 'vitest';
import * as E from './engine';
import * as F from './fold-rules';
import { FOLD } from './fold-data';
import { improvementDef } from './improvement-data';
import * as IR from './improvement-rules';
import { CONTRACT } from './trade-data';
import * as TR from './trade-rules';
import { Contract, GameState } from './types';

function ready(): GameState {
  const s = E.newGame('Rook', 'Halberd', 1, 44);
  s.research.levels['fold_drive'] = 1;
  s.research.levels['refinery'] = 1;
  s.research.levels['alloys'] = 1;
  s.drill.tier = 4;
  s.stats.creditsEarned = 1e9;
  s.threats.nextIn = Infinity;
  s.trade.nextIn = Infinity;
  return s;
}

describe('fuel without Voidglass', () => {
  it('the Helium Fuel Depot needs no Voidglass', () => {
    const d = improvementDef('fuel_depot');
    expect(Object.keys(d.ingots)).not.toContain('voidglass');
    expect(Object.keys(d.alloys)).not.toContain('nullsteel');
    const s = ready(); // drill Mk.IV: Helium-3, no Voidglass
    expect(IR.materialsReachable(s, d)).toBe(true);
  });

  it('Cryoplate burns as fuel at twice its Helium-3 ingot', () => {
    const s = ready();
    expect(F.cryoplateFuelUnits()).toBe(FOLD.cryoplateFuelUnits);
    expect(F.cryoplateFuelUnits()).toBe(2 * F.fuelUnits(s, 'helium3', true));
    s.alloys.cryoplate = 100;
    F.feedDrive(s);
    expect(s.alloys.cryoplate).toBe(0);
    expect(s.fold.charge).toBeCloseTo((100 * FOLD.cryoplateFuelUnits) / F.chargeNeeded(s), 12);
  });

  it('the drive never burns ingots or alloys an accepted construction contract needs', () => {
    const s = ready();
    const c: Contract = {
      id: 999, issuer: { kind: 'corp', id: 'aster_lune' }, type: 'construction', title: 'Build a Fuel Depot',
      target: 1, progress: 0, deadline: 1e4, duration: 1e4, reward: { credits: 1, surveyData: 0, dataCores: 0 },
      baseline: 0, held: 0, improvement: 'fuel_depot', materials: { ingots: { helium3: 40 }, alloys: { cryoplate: 15 } },
    };
    s.contracts.active = [c];
    s.alloys.cryoplate = 25;
    s.ingots.helium3 = 100;
    F.feedDrive(s);
    expect(s.alloys.cryoplate).toBe(15);
    expect(s.ingots.helium3).toBe(40);
    expect(IR.buildBlocker(s, c)).toBeNull();
  });

  it('Aster-Lune contracts sometimes pay fold charge cells once the drive is online', () => {
    const s = ready();
    let withCells = 0;
    let total = 0;
    for (let i = 0; i < 300; i++) {
      TR.refreshBoard(s);
      for (const c of s.contracts.board.filter((x) => x.issuer.id === 'aster_lune')) {
        total++;
        if (c.reward.foldCells) withCells++;
      }
    }
    expect(total).toBeGreaterThan(20);
    expect(withCells / total).toBeGreaterThan(CONTRACT.asterCellChance * 0.5);
    expect(withCells / total).toBeLessThan(CONTRACT.asterCellChance * 1.5);
    // Paid into the stores when the contract completes: build an Aster-Lune improvement that pays cells.
    let job: Contract | undefined;
    for (let k = 0; k < 600 && !job; k++) {
      TR.refreshBoard(s);
      job = s.contracts.board.find((x) => x.issuer.id === 'aster_lune' && x.type === 'construction' && x.reward.foldCells);
    }
    expect(job).toBeTruthy();
    s.contracts.active = [];
    expect(TR.acceptContract(s, job!.id)).toBe(true);
    const cost = IR.buildCost(s, job!);
    for (const [o, n] of Object.entries(cost.ingots)) s.ingots[o as keyof typeof s.ingots] = n!;
    for (const [a, n] of Object.entries(cost.alloys)) s.alloys[a as keyof typeof s.alloys] = n!;
    const cells = s.trade.inventory.fold_cell;
    expect(TR.buildContract(s, job!.id, E.emptyEvents())).toBe(true);
    expect(s.trade.inventory.fold_cell).toBe(cells + job!.reward.foldCells!);
  });
});
