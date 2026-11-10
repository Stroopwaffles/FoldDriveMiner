import { ALLOY, ALLOYS } from './alloy-data';
import * as E from './engine';
import * as F from './fold-rules';
import { CURRENT_VERSION, migrate } from './save';
import { GameState } from './types';

function forgeReady(): GameState {
  const s = E.newGame('Rook', 'Halberd Dawn', 1, 4242);
  s.threats.nextIn = Infinity;
  s.anomalies.nextIn = Infinity;
  s.trade.nextIn = Infinity;
  s.drill.tier = 2; // ferrite and titanite
  s.research.levels['refinery'] = 1;
  s.research.levels['alloys'] = 1;
  s.cargoLevel = 10;
  E.syncRefinerySlots(s);
  return s;
}

/** Runs the forge to the end of its batch. */
function finish(s: GameState): number {
  return E.advanceForge(s, s.forge.remaining + 0.01);
}

describe('Alloy Smelting', () => {
  it('needs the research before the forge works', () => {
    const s = forgeReady();
    s.research.levels['alloys'] = 0;
    s.ingots.ferrite = 10;
    s.ingots.titanite = 10;
    expect(E.hasForge(s)).toBe(false);
    expect(E.startForge(s, 'duralloy')).toBe(false);
  });

  it('opens a recipe only when the drill reaches both ores', () => {
    const s = forgeReady();
    const open = ALLOYS.filter((a) => E.recipeOpen(s, a)).map((a) => a.id);
    expect(open).toEqual(['duralloy']);
    s.ingots.titanite = 10;
    s.ingots.iridium = 10;
    expect(E.startForge(s, 'iridsteel')).toBe(false);
  });

  it('turns one ingot of each into one alloy', () => {
    const s = forgeReady();
    s.ingots.ferrite = 7;
    s.ingots.titanite = 3;
    expect(E.startForge(s, 'duralloy')).toBe(true);
    expect(s.forge.batch).toBe(3);
    expect(s.ingots.ferrite).toBe(4);
    expect(s.ingots.titanite).toBe(0);
    expect(s.forge.duration).toBeCloseTo(E.batchDuration(s) * ALLOY.durationMult, 9);
    expect(finish(s)).toBe(3);
    expect(s.alloys.duralloy).toBe(3);
    expect(s.stats.alloysForged).toBe(3);
  });

  it('a batch is capped at what one furnace batch yields', () => {
    const s = forgeReady();
    s.ingots.ferrite = 1000;
    s.ingots.titanite = 1000;
    E.startForge(s, 'duralloy');
    expect(s.forge.batch).toBe(E.forgeCapacity(s));
    expect(E.forgeCapacity(s)).toBe(Math.floor(E.batchCapacity(s) / E.oreRatio(s)));
  });

  it('an alloy sells for 1.5× its two ingots, more with Crucible Lining', () => {
    const s = forgeReady();
    const pair = E.ingotPrice(s, 'ferrite') + E.ingotPrice(s, 'titanite');
    expect(E.alloyPrice(s, 'duralloy')).toBeCloseTo(pair * 1.5, 9);
    s.research.levels['crucible_lining'] = 2;
    expect(E.alloyPrice(s, 'duralloy')).toBeCloseTo(pair * 2, 9);
    s.alloys.duralloy = 4;
    const credits = s.credits;
    expect(E.sellAlloy(s, 'duralloy')).toBeCloseTo(pair * 2 * 4, 6);
    expect(s.credits).toBeCloseTo(credits + pair * 2 * 4, 6);
    expect(s.alloys.duralloy).toBe(0);
  });

  it('takes hold space, with the forge output reserved', () => {
    const s = forgeReady();
    s.ingots.ferrite = 5;
    s.ingots.titanite = 5;
    const before = E.cargoUsed(s);
    E.startForge(s, 'duralloy');
    // Ten ingots out, five alloys reserved.
    expect(E.cargoUsed(s)).toBe(before - 5);
    finish(s);
    expect(E.cargoUsed(s)).toBe(before - 5);
  });

  it('repeats with Auto-Refine and auto-sells when flagged', () => {
    const s = forgeReady();
    s.research.levels['auto_refine'] = 1;
    s.research.levels['auto_sell'] = 1;
    s.ingots.ferrite = 4;
    s.ingots.titanite = 4;
    E.startForge(s, 'duralloy');
    s.forge.batch = 2; // two small batches
    s.ingots.ferrite = 2;
    s.ingots.titanite = 2;
    expect(E.setForgeRepeat(s, true)).toBe(true);
    expect(E.advanceForge(s, s.forge.duration * 2 + 0.1)).toBe(4);
    expect(E.toggleAutoSellAlloy(s, 'duralloy')).toBe(true);
    const ev = E.tick(s, 0.1);
    expect(ev.autoSoldCredits).toBeGreaterThan(0);
    expect(s.alloys.duralloy).toBe(0);
  });

  it('Sell All includes alloys', () => {
    const s = forgeReady();
    s.alloys.duralloy = 2;
    expect(E.sellAll(s)).toBeCloseTo(2 * E.alloyPrice(s, 'duralloy'), 6);
  });

  it('the forge and alloy stock reset on a Fold Jump, like ingots', () => {
    const s = forgeReady();
    s.alloys.duralloy = 50;
    s.forge.alloy = 'duralloy';
    s.research.levels['fold_drive'] = 1;
    s.fold.charge = 1;
    s.stats.creditsEarned = 1e8;
    const n = F.foldJump(s)!.state;
    expect(n.alloys.duralloy).toBe(0);
    expect(n.forge.alloy).toBeNull();
  });

  it('migrates a version 9 save', () => {
    const v9 = E.newGame('Rook', 'Halberd', 1, 99) as unknown as Record<string, unknown>;
    v9['version'] = 9;
    delete v9['alloys'];
    delete v9['forge'];
    (v9['autoSell'] as Record<string, unknown>)['alloy'] = undefined;
    delete (v9['autoSell'] as Record<string, unknown>)['alloy'];
    const m = migrate(v9);
    expect(m.version).toBe(CURRENT_VERSION);
    expect(m.alloys.nullsteel).toBe(0);
    expect(m.forge.batch).toBe(0);
    expect(m.autoSell.alloy.duralloy).toBe(false);
  });
});
