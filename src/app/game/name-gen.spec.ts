import { Rng } from './rng';
import { randomCommander, randomShip, rerollName } from './name-gen';

describe('New Game name randomizer', () => {
  it('commander names fit the 20-character field, ship names the 24-character one', () => {
    const rng = new Rng(11);
    const rand = () => rng.next();
    for (let i = 0; i < 2000; i++) {
      const c = randomCommander(rand);
      const s = randomShip(rand);
      expect(c.length).toBeGreaterThan(0);
      expect(c.length).toBeLessThanOrEqual(20);
      expect(s.length).toBeLessThanOrEqual(24);
      const [a, b] = s.split(' ');
      expect(a).not.toBe(b);
    }
  });

  it('gives plenty of variety', () => {
    const rng = new Rng(3);
    const rand = () => rng.next();
    const ships = new Set(Array.from({ length: 300 }, () => randomShip(rand)));
    const cmdrs = new Set(Array.from({ length: 300 }, () => randomCommander(rand)));
    expect(ships.size).toBeGreaterThan(200);
    expect(cmdrs.size).toBeGreaterThan(120);
  });

  it('a reroll changes the name', () => {
    let n = 'Halberd Dawn';
    for (let i = 0; i < 50; i++) {
      const next = rerollName(n, () => randomShip());
      expect(next).not.toBe(n);
      n = next;
    }
  });
});
