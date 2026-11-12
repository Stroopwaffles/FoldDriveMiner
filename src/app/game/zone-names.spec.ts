import { describe, expect, it } from 'vitest';
import * as E from './engine';
import * as F from './fold-rules';
import * as S from './sector-rules';
import { ALL_ZONE_NAMES, assignZoneNames, themeOre } from './zone-names';
import { GameState } from './types';

function jumpReady(s: GameState): GameState {
  s.research.levels['fold_drive'] = 1;
  s.fold.charge = 1;
  s.stats.creditsEarned = s.fold.runStartCredits + 1e8;
  return s;
}

describe('zone names', () => {
  it('a Fold Jump gives the new sector fresh names that the save then remembers', () => {
    let s = jumpReady(E.newGame('Rook', 'Halberd', 1, 31));
    const seen = new Set<string>();
    for (let j = 0; j < 8; j++) {
      s = F.foldJump(jumpReady(s))!.state;
      const names = S.sectorZones(s).map((z) => z.name);
      expect(s.sector.zoneNames?.map((n) => n[0])).toEqual(names);
      for (const n of names) {
        expect(seen.has(n)).toBe(false);
        seen.add(n);
      }
      expect(new Set(s.zoneNamesUsed).size).toBe(seen.size);
    }
  });

  it('names follow the zone\'s ore: icy for Helium-3, rusty for Ferrite', () => {
    expect(themeOre({ titanite: 0.19, iridium: 0.25, helium3: 0.56 })).toBe('helium3');
    expect(themeOre({ ferrite: 0.85, titanite: 0.15 })).toBe('ferrite');
    const s = E.newGame('Rook', 'Halberd', 1, 5);
    const [ice] = assignZoneNames(s, [{ composition: { helium3: 0.6, iridium: 0.4 } }]);
    expect(['Rime', 'Frost', 'Glacier', 'Hoarfrost', 'Snowfall', 'Boreal', 'Icefall', 'Winter']).toContain(ice.name.split(' ')[0]);
  });

  it('once every name is used, the pool starts over', () => {
    const s = E.newGame('Rook', 'Halberd', 1, 5);
    s.zoneNamesUsed = ALL_ZONE_NAMES.map((n) => n.name);
    const out = assignZoneNames(s, [{ composition: { ferrite: 1 } }, { composition: { ferrite: 1 } }]);
    expect(out.length).toBe(2);
    expect(out[0].name).not.toBe(out[1].name);
    expect(s.zoneNamesUsed.length).toBe(2);
  });

  it('zone descriptions describe the ore mix instead of repeating the sector type', () => {
    const def = S.generateSector(502384767, 4);
    for (const z of def.zones) {
      expect(z.desc).not.toContain('ice belts');
      expect(z.desc).toMatch(/^(Mostly|Mixed|Mainly) /);
    }
  });
});
