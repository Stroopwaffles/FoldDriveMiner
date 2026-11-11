import { ZONES } from './config';
import { backdrop, zoneTheme } from './backdrop';
import * as E from './engine';
import { generateSector } from './sector-rules';

describe('zone backdrops', () => {
  it('home zones each get their own look', () => {
    expect(ZONES.map((z) => zoneTheme(z))).toEqual(['belt', 'trade', 'wreck', 'ice', 'void']);
  });

  it('a fresh game shows the home belt under a yellow star', () => {
    const s = E.newGame('Rook', 'Halberd', 1, 1);
    expect(backdrop(s)).toEqual({ theme: 'belt', star: 'yellow', starColor: '#ffd23f', companion: null });
  });

  it('generated sectors give every zone a valid theme, and the sky varies', () => {
    const themes = new Set<string>();
    for (let seed = 1; seed <= 60; seed++) {
      for (const z of generateSector(seed * 131, 3).zones) themes.add(zoneTheme(z));
    }
    expect(themes.size).toBeGreaterThanOrEqual(5);
  });
});
