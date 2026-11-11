import { Component, computed, input } from '@angular/core';
import { Backdrop } from '../game/backdrop';
import { Starfield } from './starfield';

/** A fixed pseudo-random spread, so layouts never jump between renders. */
function spread(n: number, seed: number) {
  return Array.from({ length: n }, (_, i) => {
    const a = Math.sin((i + 1) * 12.9898 + seed * 78.233) * 43758.5453;
    const b = Math.sin((i + 1) * 39.3468 + seed * 11.135) * 24634.6345;
    const c = Math.sin((i + 1) * 73.156 + seed * 52.235) * 13758.937;
    return { x: (a - Math.floor(a)) * 100, y: (b - Math.floor(b)) * 100, r: c - Math.floor(c), i };
  });
}

/**
 * The scenery behind the asteroid: a sky per zone theme, the sector's star (or two), a
 * starfield, and one animated layer that says where you are (dust, traffic, wrecks, ice…).
 */
@Component({
  selector: 'fdm-zone-backdrop',
  imports: [Starfield],
  templateUrl: './zone-backdrop.html',
  styleUrl: './zone-backdrop.scss',
})
export class ZoneBackdrop {
  readonly bd = input.required<Backdrop>();
  readonly still = input(false);

  /** One-item list keyed by theme + star: a change re-creates the scene, which fades in. */
  protected readonly scene = computed(() => [this.bd()]);
  protected readonly key = (b: Backdrop) => `${b.theme}|${b.star}|${b.companion?.star ?? ''}`;

  protected readonly motes = spread(26, 1);
  protected readonly beacons = Array.from({ length: 9 }, (_, i) => i);
  protected readonly convoy = spread(4, 2);
  protected readonly wrecks = [
    { x: 14, y: 70, s: 1, rot: -14, dur: 140 },
    { x: 58, y: 22, s: 0.55, rot: 22, dur: 190 },
    { x: 86, y: 78, s: 0.7, rot: 160, dur: 170 },
  ];
  protected readonly flashes = spread(5, 3);
  protected readonly boulders = [
    { y: 8, s: 1.3, dur: 70, delay: 0 },
    { y: 80, s: 1.7, dur: 95, delay: -40 },
    { y: 46, s: 0.9, dur: 120, delay: -80 },
  ];
  protected readonly shards = spread(16, 4);
  protected readonly flakes = spread(34, 5);
  protected readonly ribbons = [0, 1, 2];
  protected readonly hull = '-74,-18 38,-24 76,-8 84,4 40,24 -74,20';
}
