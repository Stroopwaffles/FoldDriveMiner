/**
 * Curios: strange relics sold by Grey Tithe and Collegium traders. Each one bought is identified
 * and added to the Codex's Curios section with a note and a sketch. They all hint at the loop.
 */
export interface CurioDef {
  id: string;
  name: string;
  /** The Codex note. {ship} is the player's ship name. */
  note: string;
}

export const CURIOS: readonly CurioDef[] = [
  {
    id: 'halcyon_plate',
    name: 'Stamped Hull Plate',
    note: 'A scorched square of hull alloy, stamped HALCYON-CLASS · HULL 6. The rivet pattern matches the {ship} exactly. VESPER refuses to comment.',
  },
  {
    id: 'stopped_watch',
    name: 'Backwards Chronometer',
    note: 'A pilot\'s wrist chronometer, stopped at minus four seconds. When nobody is watching, the second hand ticks the wrong way.',
  },
  {
    id: 'beacon_shard',
    name: 'Beacon Shard',
    note: 'A splinter of Silent Beacon crystal. Held to your ear it whispers coordinates, always to a sector you have already visited.',
  },
  {
    id: 'twin_wrench',
    name: 'Engraved Wrench',
    note: 'A torque wrench engraved K.O. Kit swears she has never lost one. Hers is in her belt right now. This one is older, and worn to the same grip.',
  },
  {
    id: 'sealed_letter',
    name: 'Unopened Letter',
    note: 'Addressed to "the Commander of the {ship}" in your own handwriting. The seal is unbroken. Something tells you not to open it yet.',
  },
  {
    id: 'mech_optic',
    name: 'Flickering Optic',
    note: 'A mech visor torn from its frame, still powered. Its last recorded image is your hangar, from an angle no camera on board could see.',
  },
  {
    id: 'tithe_beads',
    name: 'Grey Tithe Prayer Beads',
    note: 'Thirty-one data chips on a cord. Brother Ansel recognises the knot. "It is mine," he says, "but I have not tied it yet."',
  },
  {
    id: 'meridian_badge',
    name: 'Meridian ID Badge',
    note: 'A Meridian Heavy Industries staff badge: CONTRACTOR, FOLD PROGRAMME. The photo is yours. The issue date is forty years ago.',
  },
  {
    id: 'vermilion_fang',
    name: 'Vermilion Fang',
    note: 'A red-enamelled fang on a chain, the Jackal\'s mark. Scratched on the back in a careful hand: "For Saffi. Don\'t follow me."',
  },
  {
    id: 'frozen_seed',
    name: 'Frozen Seed Pod',
    note: 'A seed pod in a cryo vial, labelled HOME — PLANT AFTER THE LAST JUMP. Nobody aboard remembers which home it means.',
  },
  {
    id: 'eight_ships',
    name: 'Star Chart of Eight',
    note: 'A hand-inked chart of the frontier with eight identical ship silhouettes drawn on it. Seven are crossed out. The eighth is circled.',
  },
  {
    id: 'music_box',
    name: 'Tin Music Box',
    note: 'Wind it and it plays a few bars you swear you\'ve heard on the bridge speakers. Juno hums the next line before it gets there.',
  },
];

export const CURIO = {
  /** Survey Data per curio, ×(1 + sector depth). */
  surveyData: 30,
};

export function curioDef(id: string): CurioDef | undefined {
  return CURIOS.find((c) => c.id === id);
}
