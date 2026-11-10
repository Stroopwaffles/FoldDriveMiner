/**
 * Random commander and ship names for the New Game form. Purely cosmetic,
 * so it uses Math.random rather than the game's seeded RNG.
 */

const FIRST = [
  'Ada', 'Bastian', 'Corin', 'Dahlia', 'Emeric', 'Freya', 'Galen', 'Hester', 'Idris', 'Kenji', 'Lyra', 'Marcus',
  'Nadia', 'Osric', 'Petra', 'Rhea', 'Silas', 'Tamsin', 'Ulric', 'Vera', 'Wolfe', 'Xavi', 'Yara', 'Zora', 'Akane',
  'Ren', 'Mika', 'Darius', 'Ilse', 'Tomas',
];

const LAST = [
  'Ashgrove', 'Blackwood', 'Castellan', 'Drake', 'Falkner', 'Graves', 'Hawke', 'Ironside', 'Kestrel', 'Locke',
  'Marlowe', 'Mercer', 'Okafor', 'Pryce', 'Rainier', 'Stroud', 'Tachibana', 'Vance', 'Wilder', 'Corvin', 'Halloran',
  'Steele', 'Morrow', 'Sinclair', 'Achterberg',
];

/** One-word handles, the way the crew would say it over comms. */
const HANDLES = ['Rook', 'Ash', 'Vane', 'Brick', 'Hex', 'Ozzy', 'Tango', 'Spoke', 'Dune', 'Moth', 'Flint', 'Rigger', 'Slate', 'Cobb'];

const SHIP_A = [
  'Halberd', 'Crimson', 'Iron', 'Silver', 'Lantern', 'Starlit', 'Ember', 'Vagrant', 'Northern', 'Gilded', 'Thunder',
  'Quiet', 'Wandering', 'Azure', 'Last', 'Solar', 'Cobalt', 'Hollow', 'Valiant', 'Midnight', 'Rusted', 'Lucky',
  'Distant', 'Stubborn', 'Brass',
];

const SHIP_B = [
  'Dawn', 'Comet', 'Promise', 'Lance', 'Horizon', 'Drifter', 'Sparrow', 'Anvil', 'Gambit', 'Tide', 'Fortune', 'Vigil',
  'Prospect', 'Heron', 'Bastion', 'Kettle', 'Harvest', 'Crown', 'Lark', 'Mule', 'Pick', 'Echo', 'Spark', 'Errand',
];

function pick<T>(list: readonly T[], rand: () => number): T {
  return list[Math.floor(rand() * list.length)];
}

/** "First Last", a surname alone, or a handle. Always 20 characters or fewer. */
export function randomCommander(rand: () => number = Math.random): string {
  const r = rand();
  if (r < 0.5) {
    const name = `${pick(FIRST, rand)} ${pick(LAST, rand)}`;
    if (name.length <= 20) return name;
  }
  return r < 0.75 ? pick(LAST, rand) : pick(HANDLES, rand);
}

/** Two words, never the same one twice. Always 24 characters or fewer. */
export function randomShip(rand: () => number = Math.random): string {
  const a = pick(SHIP_A, rand);
  let b = pick(SHIP_B, rand);
  while (b === a) b = pick(SHIP_B, rand);
  return `${a} ${b}`;
}

/** A new name that differs from the current one, when the lists allow. */
export function rerollName(current: string, gen: () => string): string {
  for (let i = 0; i < 8; i++) {
    const n = gen();
    if (n !== current) return n;
  }
  return gen();
}
