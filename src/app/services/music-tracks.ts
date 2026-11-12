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
  {
    id: 'signal_fire',
    name: 'Signal Fire',
    mood: 'E minor · 116 BPM · driving, for a scramble',
    bpm: 116,
    chords: [
      { pad: [55, 59, 64], root: 28 }, // Em
      { pad: [55, 60, 64], root: 36 }, // C
      { pad: [55, 59, 62], root: 31 }, // G
      { pad: [54, 57, 62], root: 26 }, // D
    ],
    melody: [
      [[0, 71, 2], [2, 74, 2], [4, 76, 4], [8, 79, 2], [10, 76, 2], [12, 74, 4]],
      [[0, 76, 6], [6, 72, 2], [8, 71, 4], [12, 72, 4]],
      [[0, 74, 2], [2, 71, 2], [4, 67, 4], [8, 71, 4], [12, 74, 4]],
      [[0, 78, 8], [8, 76, 4], [12, 74, 4]],
      [[0, 79, 4], [4, 78, 2], [6, 76, 2], [8, 83, 4], [12, 81, 4]],
      [[0, 79, 4], [4, 76, 4], [8, 72, 4], [12, 76, 4]],
      [[0, 74, 4], [4, 79, 4], [8, 83, 6], [14, 81, 2]],
      [[0, 78, 12], [12, 74, 4]],
    ],
    drums: 'drive',
    bass: 'octave',
    arp: 'updown',
    lead: 'saw',
    gain: 0.9,
  },
  {
    id: 'resonance',
    name: 'Resonance',
    mood: 'D minor · 88 BPM · slow and strange, for the long fold',
    bpm: 88,
    chords: [
      { pad: [57, 62, 65], root: 26 }, // Dm
      { pad: [58, 62, 65], root: 34 }, // Bb
      { pad: [55, 58, 62], root: 31 }, // Gm
      { pad: [57, 61, 64], root: 33 }, // A
    ],
    melody: [
      [[0, 69, 8], [8, 65, 4], [12, 67, 4]],
      [[0, 70, 8], [8, 69, 4], [12, 65, 4]],
      [[0, 67, 6], [6, 70, 2], [8, 74, 8]],
      [[0, 73, 8], [8, 69, 8]],
      [[0, 74, 4], [4, 72, 4], [8, 69, 8]],
      [[0, 70, 4], [4, 74, 4], [8, 77, 8]],
      [[0, 79, 6], [6, 77, 2], [8, 74, 4], [12, 70, 4]],
      [[0, 73, 12], [12, 76, 4]],
    ],
    drums: 'half',
    bass: 'sustain',
    arp: 'sparse',
    lead: 'triangle',
    gain: 1.05,
  },
  {
    id: 'sunset_hangar',
    name: 'Sunset Hangar',
    mood: 'A minor / C major · 124 BPM · bright, end-of-shift',
    bpm: 124,
    chords: [
      { pad: [57, 60, 65], root: 29 }, // F
      { pad: [55, 59, 62], root: 31 }, // G
      { pad: [55, 59, 64], root: 28 }, // Em
      { pad: [57, 60, 64], root: 33 }, // Am
    ],
    melody: [
      [[0, 72, 2], [2, 72, 2], [4, 77, 4], [8, 76, 2], [10, 74, 2], [12, 72, 4]],
      [[0, 74, 4], [4, 71, 4], [8, 67, 4], [12, 71, 4]],
      [[0, 71, 2], [2, 72, 2], [4, 74, 4], [8, 76, 8]],
      [[0, 72, 6], [6, 71, 2], [8, 69, 8]],
      [[0, 81, 4], [4, 79, 2], [6, 77, 2], [8, 76, 4], [12, 77, 4]],
      [[0, 79, 6], [6, 74, 2], [8, 71, 4], [12, 74, 4]],
      [[0, 76, 4], [4, 79, 4], [8, 83, 4], [12, 79, 4]],
      [[0, 81, 16]],
    ],
    drums: 'four',
    bass: 'syncopated',
    arp: 'up',
    lead: 'brass',
    gain: 0.95,
  },
  {
    id: 'starlight_courier',
    name: 'Starlight Courier',
    mood: 'F minor · 112 BPM · driving brass, for the long haul',
    bpm: 112,
    chords: [
      { pad: [53, 56, 60], root: 29 }, // Fm
      { pad: [53, 56, 61], root: 25 }, // Db
      { pad: [55, 58, 63], root: 27 }, // Eb
      { pad: [55, 60, 64], root: 24 }, // C
    ],
    melody: [
      [[0, 72, 2], [2, 77, 2], [4, 80, 4], [8, 79, 2], [10, 77, 2], [12, 75, 4]],
      [[0, 77, 6], [6, 73, 2], [8, 72, 4], [12, 73, 4]],
      [[0, 75, 4], [4, 79, 4], [8, 82, 4], [12, 79, 4]],
      [[0, 76, 8], [8, 72, 4], [12, 79, 4]],
      [[0, 84, 4], [4, 82, 2], [6, 80, 2], [8, 77, 4], [12, 80, 4]],
      [[0, 85, 4], [4, 84, 4], [8, 80, 4], [12, 77, 4]],
      [[0, 82, 2], [2, 80, 2], [4, 79, 4], [8, 75, 4], [12, 79, 4]],
      [[0, 76, 4], [4, 79, 4], [8, 84, 8]],
    ],
    drums: 'drive',
    bass: 'syncopated',
    arp: 'updown',
    lead: 'brass',
    gain: 0.9,
  },
  {
    id: 'quiet_telemetry',
    name: 'Quiet Telemetry',
    mood: 'B minor · 76 BPM · slow and still, for night shifts',
    bpm: 76,
    chords: [
      { pad: [54, 59, 62], root: 35 }, // Bm
      { pad: [55, 59, 62], root: 31 }, // G
      { pad: [54, 57, 62], root: 26 }, // D
      { pad: [52, 57, 61], root: 33 }, // A
    ],
    melody: [
      [[0, 78, 8], [8, 74, 4], [12, 76, 4]],
      [[0, 79, 8], [8, 78, 4], [12, 74, 4]],
      [[0, 78, 6], [6, 76, 2], [8, 74, 8]],
      [[0, 73, 8], [8, 76, 8]],
      [[0, 83, 8], [8, 81, 4], [12, 78, 4]],
      [[0, 79, 4], [4, 83, 4], [8, 86, 8]],
      [[0, 85, 6], [6, 83, 2], [8, 81, 4], [12, 78, 4]],
      [[0, 76, 12], [12, 73, 4]],
    ],
    drums: 'half',
    bass: 'sustain',
    arp: 'sparse',
    lead: 'triangle',
    gain: 1.05,
  },
  {
    id: 'overclock',
    name: 'Overclock',
    mood: 'G minor · 128 BPM · fast and hot, for Overdrive',
    bpm: 128,
    chords: [
      { pad: [55, 58, 62], root: 31 }, // Gm
      { pad: [55, 58, 63], root: 27 }, // Eb
      { pad: [53, 58, 62], root: 34 }, // Bb
      { pad: [53, 57, 60], root: 29 }, // F
    ],
    melody: [
      [[0, 79, 2], [2, 79, 2], [4, 82, 2], [6, 79, 2], [8, 77, 4], [12, 74, 4]],
      [[0, 75, 2], [2, 77, 2], [4, 79, 4], [8, 82, 4], [12, 79, 4]],
      [[0, 77, 2], [2, 74, 2], [4, 77, 4], [8, 82, 6], [14, 84, 2]],
      [[0, 81, 8], [8, 77, 4], [12, 72, 4]],
      [[0, 86, 4], [4, 84, 2], [6, 82, 2], [8, 79, 4], [12, 82, 4]],
      [[0, 84, 4], [4, 82, 4], [8, 79, 4], [12, 75, 4]],
      [[0, 82, 2], [2, 84, 2], [4, 86, 4], [8, 89, 4], [12, 86, 4]],
      [[0, 84, 4], [4, 81, 4], [8, 77, 8]],
    ],
    drums: 'four',
    bass: 'octave',
    arp: 'up',
    lead: 'saw',
    gain: 0.88,
  },
  {
    id: 'lantern_light',
    name: 'Lantern Light',
    mood: 'D major · 104 BPM · warm and hopeful, for trading days',
    bpm: 104,
    chords: [
      { pad: [54, 57, 62], root: 26 }, // D
      { pad: [54, 59, 62], root: 35 }, // Bm
      { pad: [55, 59, 62], root: 31 }, // G
      { pad: [52, 57, 61], root: 33 }, // A
    ],
    melody: [
      [[0, 74, 2], [2, 78, 2], [4, 81, 4], [8, 78, 4], [12, 76, 4]],
      [[0, 74, 4], [4, 71, 4], [8, 74, 2], [10, 76, 2], [12, 78, 4]],
      [[0, 79, 4], [4, 78, 2], [6, 76, 2], [8, 74, 4], [12, 71, 4]],
      [[0, 73, 8], [8, 76, 8]],
      [[0, 86, 4], [4, 85, 2], [6, 83, 2], [8, 81, 4], [12, 78, 4]],
      [[0, 83, 6], [6, 81, 2], [8, 78, 4], [12, 74, 4]],
      [[0, 79, 2], [2, 81, 2], [4, 83, 4], [8, 86, 4], [12, 83, 4]],
      [[0, 85, 8], [8, 81, 8]],
    ],
    drums: 'four',
    bass: 'syncopated',
    arp: 'updown',
    lead: 'triangle',
    gain: 1,
  },
  {
    id: 'event_horizon',
    name: 'Event Horizon',
    mood: 'C minor · 92 BPM · heavy and tense, for the deep sectors',
    bpm: 92,
    chords: [
      { pad: [55, 60, 63], root: 36 }, // Cm
      { pad: [56, 60, 63], root: 32 }, // Ab
      { pad: [56, 60, 65], root: 29 }, // Fm
      { pad: [55, 59, 62], root: 31 }, // G
    ],
    melody: [
      [[0, 79, 6], [6, 75, 2], [8, 72, 8]],
      [[0, 80, 6], [6, 79, 2], [8, 75, 4], [12, 72, 4]],
      [[0, 77, 4], [4, 80, 4], [8, 84, 8]],
      [[0, 83, 8], [8, 79, 4], [12, 74, 4]],
      [[0, 84, 4], [4, 82, 4], [8, 79, 8]],
      [[0, 80, 4], [4, 84, 4], [8, 87, 8]],
      [[0, 89, 6], [6, 87, 2], [8, 84, 4], [12, 80, 4]],
      [[0, 83, 12], [12, 86, 4]],
    ],
    drums: 'half',
    bass: 'octave',
    arp: 'sparse',
    lead: 'saw',
    gain: 0.95,
  },
];

export function trackById(id: string): Track | undefined {
  return TRACKS.find((t) => t.id === id);
}
