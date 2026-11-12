import { TRACKS } from './music-tracks';

describe('music tracks', () => {
  it('has twelve tracks with unique ids and names', () => {
    expect(TRACKS.length).toBe(12);
    expect(new Set(TRACKS.map((t) => t.id)).size).toBe(TRACKS.length);
    expect(new Set(TRACKS.map((t) => t.name)).size).toBe(TRACKS.length);
  });

  for (const t of TRACKS) {
    it(`${t.name}: well-formed 4-chord, 8-bar loop`, () => {
      expect(t.chords.length).toBe(4);
      for (const c of t.chords) {
        expect(c.root).toBeGreaterThanOrEqual(24);
        expect(c.root).toBeLessThanOrEqual(38);
        expect(c.pad.length).toBe(3);
      }
      expect(t.melody.length).toBe(8);
      for (const bar of t.melody) {
        let end = 0;
        for (const [step, note, len] of bar) {
          expect(step).toBeGreaterThanOrEqual(end); // no overlapping notes
          expect(len).toBeGreaterThan(0);
          expect(note).toBeGreaterThanOrEqual(60);
          expect(note).toBeLessThanOrEqual(96);
          end = step + len;
        }
        expect(end).toBeLessThanOrEqual(16);
      }
      expect(t.bpm).toBeGreaterThanOrEqual(60);
      expect(t.bpm).toBeLessThanOrEqual(140);
    });
  }
});
