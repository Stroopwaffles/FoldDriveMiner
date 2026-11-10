/**
 * Background music, written as data. Every track is an original 16-bar loop:
 * a 4-chord progression repeated four times, with the lead melody on bars 1–8
 * and the arpeggio taking over on bars 9–16.
 *
 * Notes are MIDI numbers (60 = middle C). Melody entries are
 * [step in bar (0–15), note, length in 16th steps].
 */

export type DrumStyle = 'four' | 'half' | 'drive';
export type BassStyle = 'octave' | 'sustain' | 'syncopated';
export type ArpStyle = 'up' | 'updown' | 'sparse';
export type LeadVoice = 'saw' | 'triangle' | 'brass';

export interface Chord {
  /** Pad voicing around middle C. */
  pad: number[];
  /** Bass root, around MIDI 24–38. */
  root: number;
}

export interface Track {
  id: string;
  name: string;
  /** Short mood line for the settings screen. */
  mood: string;
  bpm: number;
  chords: Chord[];
  melody: [number, number, number][][];
  drums: DrumStyle;
  bass: BassStyle;
  arp: ArpStyle;
  lead: LeadVoice;
  /** Overall level trim for this track. */
  gain: number;
}

export const TRACKS: readonly Track[] = [
  {
    id: 'frontier',
    name: 'Frontier Drive',
    mood: 'A minor · 100 BPM · the original theme',
    bpm: 100,
    chords: [
      { pad: [57, 60, 64], root: 33 }, // Am
      { pad: [53, 57, 60], root: 29 }, // F
      { pad: [55, 60, 64], root: 36 }, // C
      { pad: [55, 59, 62], root: 31 }, // G
    ],
    melody: [
      [[0, 76, 4], [4, 74, 2], [6, 72, 2], [8, 74, 4], [12, 76, 4]],
      [[0, 77, 6], [6, 76, 2], [8, 72, 8]],
      [[0, 79, 4], [4, 76, 4], [8, 72, 2], [10, 74, 2], [12, 76, 4]],
      [[0, 74, 8], [8, 71, 4], [12, 74, 4]],
      [[0, 81, 4], [4, 79, 2], [6, 76, 2], [8, 72, 4], [12, 76, 4]],
      [[0, 77, 4], [4, 81, 4], [8, 79, 4], [12, 77, 4]],
      [[0, 76, 4], [4, 79, 4], [8, 84, 8]],
      [[0, 83, 4], [4, 81, 2], [6, 79, 2], [8, 74, 8]],
    ],
    drums: 'four',
    bass: 'octave',
    arp: 'up',
    lead: 'saw',
    gain: 1,
  },
  {
    id: 'neon_ring',
    name: 'Neon Ring',
    mood: 'E minor · 118 BPM · fast and bright',
    bpm: 118,
    chords: [
      { pad: [52, 55, 59], root: 28 }, // Em
      { pad: [52, 55, 60], root: 36 }, // C
      { pad: [50, 54, 57], root: 38 }, // D
      { pad: [50, 54, 59], root: 35 }, // Bm
    ],
    melody: [
      [[0, 71, 2], [2, 74, 2], [4, 76, 4], [8, 74, 2], [10, 71, 2], [12, 69, 4]],
      [[0, 67, 2], [2, 69, 2], [4, 71, 6], [12, 72, 4]],
      [[0, 74, 4], [4, 72, 2], [6, 71, 2], [8, 69, 4], [12, 66, 4]],
      [[0, 71, 8], [8, 66, 4], [12, 69, 4]],
      [[0, 79, 4], [4, 78, 2], [6, 76, 2], [8, 74, 4], [12, 76, 4]],
      [[0, 76, 2], [2, 74, 2], [4, 72, 4], [8, 79, 8]],
      [[0, 78, 4], [4, 76, 4], [8, 74, 4], [12, 78, 4]],
      [[0, 76, 12], [12, 71, 4]],
    ],
    drums: 'drive',
    bass: 'octave',
    arp: 'updown',
    lead: 'saw',
    gain: 0.9,
  },
  {
    id: 'cold_halo',
    name: 'Cold Halo',
    mood: 'D minor · 84 BPM · slow and dreamy',
    bpm: 84,
    chords: [
      { pad: [50, 53, 57], root: 26 }, // Dm
      { pad: [50, 53, 58], root: 34 }, // Bb
      { pad: [48, 53, 57], root: 29 }, // F
      { pad: [48, 52, 55], root: 36 }, // C
    ],
    melody: [
      [[0, 69, 8], [8, 72, 4], [12, 74, 4]],
      [[0, 77, 12], [12, 74, 4]],
      [[0, 72, 8], [8, 69, 8]],
      [[0, 67, 12], [12, 69, 4]],
      [[0, 74, 8], [8, 77, 4], [12, 76, 4]],
      [[0, 74, 8], [8, 70, 8]],
      [[0, 72, 4], [4, 74, 4], [8, 77, 8]],
      [[0, 76, 16]],
    ],
    drums: 'half',
    bass: 'sustain',
    arp: 'sparse',
    lead: 'triangle',
    gain: 1.1,
  },
  {
    id: 'iron_bastion',
    name: 'Iron Bastion',
    mood: 'G minor · 108 BPM · heroic, for the hangar',
    bpm: 108,
    chords: [
      { pad: [55, 58, 62], root: 31 }, // Gm
      { pad: [51, 55, 58], root: 27 }, // Eb
      { pad: [53, 57, 60], root: 29 }, // F
      { pad: [50, 54, 57], root: 26 }, // D
    ],
    melody: [
      [[0, 67, 4], [4, 70, 4], [8, 74, 6], [14, 72, 2]],
      [[0, 70, 4], [4, 67, 4], [8, 70, 8]],
      [[0, 72, 4], [4, 69, 2], [6, 72, 2], [8, 77, 8]],
      [[0, 78, 8], [8, 74, 8]],
      [[0, 79, 6], [6, 77, 2], [8, 74, 4], [12, 70, 4]],
      [[0, 75, 6], [6, 74, 2], [8, 70, 8]],
      [[0, 72, 4], [4, 74, 4], [8, 77, 4], [12, 81, 4]],
      [[0, 78, 12], [12, 74, 4]],
    ],
    drums: 'four',
    bass: 'syncopated',
    arp: 'up',
    lead: 'brass',
    gain: 0.95,
  },
];

export function trackById(id: string): Track | undefined {
  return TRACKS.find((t) => t.id === id);
}
