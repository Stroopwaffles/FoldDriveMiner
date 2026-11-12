import { Component, computed, input } from '@angular/core';
import { SceneSetting } from '../game/story-data';
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

const STARS: Record<SceneSetting, { speed: number; tint: string } | null> = {
  bridge: { speed: 6, tint: '#4fe3ff' },
  belt: { speed: 0.6, tint: '#ffd23f' },
  hangar: null,
  battle: { speed: 2, tint: '#ff6b6b' },
  beacon: { speed: 0.3, tint: '#6dfff0' },
  fold: null,
  wrecks: { speed: 0.4, tint: '#9dffb0' },
  station: { speed: 0.5, tint: '#ffe08a' },
  nebula: { speed: 0.5, tint: '#ffb0f0' },
  void: { speed: 0.15, tint: '#c77dff' },
};

/**
 * The animated scenery behind a story episode: a cockpit, an asteroid belt, the hangar, a
 * firefight, a beacon's signal, the fold tunnel, a wreck field, a station, a nebula or the void.
 */
@Component({
  selector: 'fdm-story-backdrop',
  imports: [Starfield],
  templateUrl: './story-backdrop.html',
  styleUrl: './story-backdrop.scss',
})
export class StoryBackdrop {
  readonly setting = input.required<SceneSetting>();
  readonly still = typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;

  /** One-item list keyed by setting: a change re-creates the scene, which fades in. */
  protected readonly scene = computed(() => [this.setting()]);
  protected readonly stars = computed(() => STARS[this.setting()]);

  protected readonly rocks = [
    { y: 18, s: 1.4, dur: 60, delay: -10, spin: 40 },
    { y: 62, s: 2.2, dur: 85, delay: -50, spin: -70 },
    { y: 40, s: 0.8, dur: 45, delay: -30, spin: 25 },
    { y: 80, s: 1.1, dur: 70, delay: -5, spin: -35 },
    { y: 8, s: 0.6, dur: 50, delay: -38, spin: 30 },
  ];
  protected readonly rock = '-20,-6 -12,-18 4,-20 18,-10 20,6 8,18 -10,16 -20,6';
  protected readonly drones = spread(5, 7);
  protected readonly lamps = [0, 1, 2, 3, 4, 5];
  protected readonly girders = [8, 30, 70, 92];
  protected readonly sparks = spread(14, 8);
  protected readonly lasers = spread(10, 9);
  protected readonly blasts = spread(6, 10);
  protected readonly raiders = [
    { y: 22, dur: 9, delay: 0, s: 1 },
    { y: 58, dur: 12, delay: -4, s: 0.7 },
    { y: 36, dur: 15, delay: -9, s: 0.5 },
  ];
  protected readonly rings = [0, 1, 2, 3, 4];
  protected readonly streaks = Array.from({ length: 36 }, (_, i) => ({ a: i * 10 + ((i * 37) % 7), d: (i * 0.29) % 1.6 }));
  protected readonly hulks = [
    { x: 12, y: 30, s: 1.2, rot: -18, dur: 160 },
    { x: 62, y: 64, s: 1.6, rot: 12, dur: 220 },
    { x: 80, y: 16, s: 0.7, rot: 150, dur: 190 },
  ];
  protected readonly hull = '-74,-18 38,-24 76,-8 84,4 40,24 -74,20';
  protected readonly debris = spread(18, 11);
  protected readonly traffic = spread(6, 12);
  protected readonly clouds = [
    { x: 20, y: 30, w: 70, c: 'rgba(255, 61, 154, 0.35)', dur: 40 },
    { x: 70, y: 60, w: 80, c: 'rgba(79, 227, 255, 0.28)', dur: 55 },
    { x: 50, y: 20, w: 60, c: 'rgba(199, 125, 255, 0.35)', dur: 47 },
    { x: 30, y: 80, w: 55, c: 'rgba(255, 210, 63, 0.18)', dur: 62 },
  ];
  protected readonly twinkles = spread(24, 13);
  protected readonly motes = spread(30, 14);

  protected cos(deg: number): number {
    return Math.cos((deg * Math.PI) / 180);
  }
  protected sin(deg: number): number {
    return Math.sin((deg * Math.PI) / 180);
  }
}
