import { OreId, ZoneDef, zoneDef } from './config';
import { mainStar, sectorOf, starDef } from './sector-rules';
import { StarId } from './sector-data';
import { GameState } from './types';

/**
 * What the mining viewport looks like behind the asteroid. Each zone gets a theme from what
 * it is (its site, then its richest ore, then how deep it sits), and the sector's star sets the light.
 */
export type BackdropTheme = 'belt' | 'trade' | 'wreck' | 'dense' | 'crystal' | 'ice' | 'void';

export type StarLook = 'yellow' | 'red_dwarf' | 'blue_giant' | 'pulsar' | 'nebula' | 'black_hole';

export interface Backdrop {
  theme: BackdropTheme;
  /** Main star, and a second one for binary systems. */
  star: StarLook;
  starColor: string;
  companion: { star: StarLook; color: string } | null;
}

const SITE_THEME: Record<string, BackdropTheme> = {
  shipping_lane: 'trade',
  battlefield: 'wreck',
  graveyard: 'wreck',
  compression_belt: 'dense',
  crystal_bloom: 'crystal',
  comet_trail: 'ice',
};

const ORE_THEME: Record<OreId, BackdropTheme> = {
  ferrite: 'belt',
  titanite: 'dense',
  iridium: 'crystal',
  helium3: 'ice',
  voidglass: 'void',
};

export function zoneTheme(zone: ZoneDef): BackdropTheme {
  if (zone.site) return SITE_THEME[zone.site] ?? 'belt';
  // Voidglass anywhere in the mix, or the outermost zone, reads as the deep dark.
  if ((zone.composition.voidglass ?? 0) > 0.15 || zone.index >= 4) return 'void';
  let best: OreId = 'ferrite';
  let share = 0;
  for (const [ore, f] of Object.entries(zone.composition) as [OreId, number][]) {
    if (f > share) {
      best = ore;
      share = f;
    }
  }
  return ORE_THEME[best];
}

function look(id: StarId): StarLook {
  return id === 'binary' ? 'yellow' : id;
}

export function backdrop(state: GameState): Backdrop {
  const def = sectorOf(state);
  const main = mainStar(def);
  const partner = def.stars[0] === 'binary' ? def.stars.slice(1).find((s) => s !== main.id && s !== 'binary') : undefined;
  return {
    theme: zoneTheme(zoneDef(state.zone)),
    star: look(main.id),
    starColor: main.color,
    companion: partner ? { star: look(partner), color: starDef(partner).color } : null,
  };
}
