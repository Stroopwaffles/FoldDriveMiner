/**
 * Alloy Smelting: the Alloy Forge fuses one ingot each of two ores into an
 * alloy worth more than the pair. Recipes open as the drill reaches both ores.
 */
import { OreId } from './config';

export type AlloyId = 'duralloy' | 'iridsteel' | 'cryoplate' | 'nullsteel';

export interface AlloyDef {
  id: AlloyId;
  code: string;
  name: string;
  /** One ingot of each goes into one alloy. */
  inputs: [OreId, OreId];
  color: string;
  flavor: string;
}

export const ALLOYS: readonly AlloyDef[] = [
  {
    id: 'duralloy', code: 'DRL', name: 'Duralloy', inputs: ['ferrite', 'titanite'], color: '#e8b27a',
    flavor: 'Hull plate for every yard in the belt. Never out of demand.',
  },
  {
    id: 'iridsteel', code: 'IRS', name: 'Iridsteel', inputs: ['titanite', 'iridium'], color: '#9fa8ff',
    flavor: 'Frame steel for mech joints. Bends, never breaks.',
  },
  {
    id: 'cryoplate', code: 'CRP', name: 'Cryoplate', inputs: ['iridium', 'helium3'], color: '#a8fff0',
    flavor: 'Reactor shielding, quenched at three kelvin.',
  },
  {
    id: 'nullsteel', code: 'NUL', name: 'Nullsteel', inputs: ['helium3', 'voidglass'], color: '#ff9bf0',
    flavor: 'Fold-coil housings. The metal hums when you hold it.',
  },
];

export const ALLOY_IDS: readonly AlloyId[] = ALLOYS.map((a) => a.id);

export function alloyDef(id: AlloyId): AlloyDef {
  return ALLOYS.find((a) => a.id === id)!;
}

export const ALLOY = {
  /** An alloy sells for this many times its two ingots together. */
  valueMult: 1.5,
  /** Each Crucible Lining level adds this to the multiplier. */
  liningPerLevel: 0.25,
  /** A forge batch takes this many times a furnace batch. */
  durationMult: 1.5,
};
