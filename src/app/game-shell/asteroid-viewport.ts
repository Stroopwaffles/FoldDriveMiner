import { Component, DestroyRef, computed, inject, signal } from '@angular/core';
import { CONFIG, ORES, ORE_IDS, oreDef, zoneDef } from '../game/config';
import { holdInterval, holdShouldWait, isHot, mechOperable, overdriveMult } from '../game/engine';
import { MechPortrait } from '../ui/mech-portrait';
import { DroneSprite } from '../ui/drone-sprite';
import { DRONE_IDS, DroneType } from '../game/fleet-data';
import { Rng } from '../game/rng';
import { AsteroidState } from '../game/types';
import { GameService } from '../services/game.service';
import { SettingsService } from '../services/settings.service';
import { Starfield } from '../ui/starfield';

interface Shape {
  outline: string;
  shadow: string;
  cracks: string[];
  specks: { points: string; color: string }[];
  craters: { cx: number; cy: number; r: number }[];
}

interface FloatText {
  id: number;
  x: number;
  y: number;
  text: string;
  color: string;
  big: boolean;
}

interface Debris {
  id: number;
  x: number;
  y: number;
  dx: number;
  dy: number;
  rot: number;
  color: string;
}

let fxId = 0;

/** Builds a cel-shaded asteroid from its seed. Coordinates are in a -100..100 box. */
function buildShape(a: AsteroidState): Shape {
  const rng = new Rng(a.shapeSeed);
  const n = 14;
  const pts: [number, number][] = [];
  for (let i = 0; i < n; i++) {
    const ang = (i / n) * Math.PI * 2 + rng.range(-0.12, 0.12);
    const r = 78 * rng.range(0.82, 1.08);
    pts.push([Math.cos(ang) * r, Math.sin(ang) * r * 0.88]);
  }
  const outline = pts.map(([x, y]) => `${x.toFixed(1)},${y.toFixed(1)}`).join(' ');
  // Shadow: the outline shifted up-left, used as a mask cutout for the lit area.
  const shadow = pts.map(([x, y]) => `${(x * 0.92 - 14).toFixed(1)},${(y * 0.92 - 12).toFixed(1)}`).join(' ');

  const cracks: string[] = [];
  for (let c = 0; c < 6; c++) {
    let x = rng.range(-12, 12);
    let y = rng.range(-12, 12);
    const ang = (c / 6) * Math.PI * 2 + rng.range(-0.4, 0.4);
    const segs = [`${x.toFixed(1)},${y.toFixed(1)}`];
    for (let s = 0; s < 4; s++) {
      const len = rng.range(12, 20);
      const a2 = ang + rng.range(-0.6, 0.6);
      x += Math.cos(a2) * len;
      y += Math.sin(a2) * len;
      segs.push(`${x.toFixed(1)},${y.toFixed(1)}`);
    }
    cracks.push(segs.join(' '));
  }

  const specks: Shape['specks'] = [];
  for (const id of ORE_IDS) {
    if (id === 'ferrite') continue;
    const count = Math.round(a.composition[id] * 40);
    for (let i = 0; i < count; i++) {
      const ang = rng.range(0, Math.PI * 2);
      const r = rng.range(0, 55);
      const cx = Math.cos(ang) * r;
      const cy = Math.sin(ang) * r * 0.88;
      const s = rng.range(3, 7);
      specks.push({
        points: `${cx},${cy - s} ${cx + s * 0.7},${cy} ${cx},${cy + s} ${cx - s * 0.7},${cy}`,
        color: oreDef(id).color,
      });
    }
  }

  const craters = Array.from({ length: 5 }, () => ({
    cx: rng.range(-45, 45),
    cy: rng.range(-40, 40),
    r: rng.range(5, 13),
  }));

  return { outline, shadow, cracks, specks, craters };
}

@Component({
  selector: 'fdm-asteroid-viewport',
  imports: [Starfield, MechPortrait, DroneSprite],
  templateUrl: './asteroid-viewport.html',
  styleUrl: './asteroid-viewport.scss',
})
export class AsteroidViewport {
  protected readonly game = inject(GameService);
  protected readonly settings = inject(SettingsService);

  /** Changes only when a new asteroid spawns (mass is mutated in place). */
  protected readonly asteroid = computed(() => this.game.state()?.asteroid ?? null);
  protected readonly asteroidShape = computed(() => {
    const a = this.asteroid();
    return a ? buildShape(a) : null;
  });

  /** Reads state() directly so it updates on every tick. */
  protected readonly integrity = computed(() => {
    const a = this.game.state()?.asteroid;
    return a ? a.mass / a.maxMass : 1;
  });
  protected readonly zoneName = computed(() => {
    const s = this.game.state();
    return s ? zoneDef(s.zone).name : '';
  });
  /** Threats shown in the viewport. */
  protected readonly rogue = computed(() => this.game.state()?.threats.events.find((e) => e.kind === 'rogue' && e.phase === 'warning') ?? null);
  protected readonly flare = computed(() => this.game.state()?.threats.events.find((e) => e.kind === 'flare') ?? null);
  protected readonly meteors = computed(() => !!this.game.state()?.threats.events.some((e) => e.kind === 'micrometeor' && e.phase === 'active'));
  protected readonly meteorLines = Array.from({ length: 14 }, (_, i) => ({ top: (i * 37) % 100, delay: -(i * 0.31) % 1.2, len: 40 + ((i * 23) % 60) }));
  protected readonly rogueFloats = signal<{ id: number; text: string; x: number; y: number }[]>([]);

  protected readonly golden = computed(() => {
    const s = this.game.state();
    return s ? (s.anomalies.list.find((a) => a.kind === 'golden_asteroid' && a.status === 'signal' && a.zone === s.zone) ?? null) : null;
  });
  protected readonly comet = computed(() => {
    const s = this.game.state();
    return !!s && s.anomalies.list.some((a) => a.kind === 'comet' && a.status === 'active' && a.zone === s.zone);
  });

  protected onGolden(e: MouseEvent): void {
    const r = this.game.goldenClick();
    if (!r || r.locked) return;
    const box = (e.currentTarget as HTMLElement).getBoundingClientRect();
    const text = r.overheated ? 'OVERHEAT!' : r.cracked ? `+${this.game.fmt(r.credits)} cr!` : `-${this.game.fmt(r.damage)}`;
    const f = { id: ++fxId, text, x: e.clientX - box.left, y: e.clientY - box.top };
    this.rogueFloats.update((l) => [...l.slice(-8), f]);
    setTimeout(() => this.rogueFloats.update((l) => l.filter((x) => x.id !== f.id)), 900);
  }

  protected onRogue(e: MouseEvent): void {
    const r = this.game.rogueClick();
    if (!r || r.locked) return;
    const box = (e.currentTarget as HTMLElement).getBoundingClientRect();
    const f = { id: ++fxId, text: r.overheated ? 'OVERHEAT!' : `-${this.game.fmt(r.damage)}`, x: e.clientX - box.left, y: e.clientY - box.top };
    this.rogueFloats.update((l) => [...l.slice(-8), f]);
    setTimeout(() => this.rogueFloats.update((l) => l.filter((x) => x.id !== f.id)), 800);
  }

  protected readonly massLeft = computed(() => this.game.state()?.asteroid.mass ?? 0);

  /** Mechs mining the zone the ship is in, drawn beside the asteroid. */
  protected readonly mechsHere = computed(() => {
    const s = this.game.state();
    if (!s) return [];
    return s.mechs.filter((m) => m.zone === s.zone && m.job === 'mining' && mechOperable(s, m)).slice(0, 3);
  });
  protected readonly cracksShown = computed(() => Math.ceil((1 - this.integrity()) * 6));

  protected readonly heat = computed(() => this.game.state()?.drill.heat ?? 0);
  protected readonly locked = computed(() => (this.game.state()?.drill.lockRemaining ?? 0) > 0);
  protected readonly heatMax = CONFIG.heat.max;
  protected readonly odMax = CONFIG.heat.overdriveMax;
  protected readonly hot = computed(() => {
    const s = this.game.state();
    return s ? isHot(s) : false;
  });
  protected readonly odMult = computed(() => {
    const s = this.game.state();
    return s ? overdriveMult(s) : CONFIG.heat.overdriveMult;
  });
  protected readonly Math = Math;

  /** Owned drone counts as a stable string, so the sprite list only rebuilds when it changes. */
  private readonly droneKey = computed(() => {
    const d = this.game.state()?.drones;
    return d ? DRONE_IDS.map((id) => d[id]).join(',') : '';
  });

  /**
   * Up to 18 orbiting sprites, shared out by how many of each type you own
   * (every owned type gets at least one). Each type flies its own ring.
   */
  protected readonly drones = computed(() => {
    const counts = this.droneKey().split(',').map(Number);
    const owned = DRONE_IDS.map((id, i) => ({ id, n: counts[i] || 0 })).filter((x) => x.n > 0);
    const total = owned.reduce((s, x) => s + x.n, 0);
    const slots = Math.min(total, 18);
    const list: { type: DroneType; r: number; dur: number; delay: number }[] = [];
    let left = slots;
    owned.forEach((x, k) => {
      const share = k === owned.length - 1 ? left : Math.max(1, Math.round((x.n / total) * slots));
      const n = Math.min(share, left, x.n);
      left -= n;
      const ring = DRONE_IDS.indexOf(x.id);
      for (let i = 0; i < n; i++) {
        list.push({ type: x.id, r: 112 + (ring % 3) * 24 + (i % 2) * 10, dur: 9 + (ring % 4) * 2.1 + (i % 3), delay: -(list.length * 1.7) });
      }
    });
    return list;
  });

  protected readonly composition = computed(() => {
    const a = this.asteroid();
    const tier = this.game.state()?.drill.tier ?? 1;
    if (!a) return [];
    return ORES.filter((o) => a.composition[o.id] > 0.001).map((o) => ({
      ore: o,
      pct: a.composition[o.id] * 100,
      reachable: o.tier <= tier,
    }));
  });

  protected readonly floats = signal<FloatText[]>([]);
  protected readonly debris = signal<Debris[]>([]);
  protected readonly shaking = signal(false);
  protected readonly flash = signal(false);

  protected onDrill(e: MouseEvent): void {
    // Effect origin: the click point, or the center for keyboard activation (no coordinates).
    const box = (e.currentTarget as HTMLElement).getBoundingClientRect();
    const keyboard = e.detail === 0;
    const x = keyboard ? box.width / 2 : e.clientX - box.left;
    const y = keyboard ? box.height / 2 : e.clientY - box.top;
    this.hit(x, y);
  }

  // ---------------------------------------------------------------- Trigger Clamp: hold to drill

  protected readonly holding = signal(false);
  private holdTimer: ReturnType<typeof setTimeout> | null = null;
  private pointer = { x: 0, y: 0 };
  private readonly onMove = (e: PointerEvent) => (this.pointer = { x: e.clientX, y: e.clientY });
  private readonly onRelease = () => this.stopHold();

  constructor() {
    inject(DestroyRef).onDestroy(() => this.stopHold());
  }

  protected onHoldStart(e: PointerEvent): void {
    const s = this.game.state();
    if (!s?.drill.clamp || e.button !== 0 || this.holdTimer) return;
    this.pointer = { x: e.clientX, y: e.clientY };
    this.holding.set(true);
    window.addEventListener('pointermove', this.onMove);
    window.addEventListener('pointerup', this.onRelease);
    window.addEventListener('pointercancel', this.onRelease);
    window.addEventListener('blur', this.onRelease);
    // The press itself drills on release (the normal click); held hits start one interval in.
    this.holdTimer = setTimeout(() => this.holdTick(), holdInterval(s) * 1000);
  }

  private holdTick(): void {
    const s = this.game.state();
    // The asteroid button is replaced when a rock cracks, so find whatever is under the pointer now.
    const el = (document.elementFromPoint(this.pointer.x, this.pointer.y) as HTMLElement | null)?.closest<HTMLElement>('.asteroid-btn');
    if (!s || !el) return this.stopHold();
    // Held hits wait out a lockout quietly (and the Thermal Governor keeps them in Overdrive).
    if (s.drill.lockRemaining <= 0 && !holdShouldWait(s)) {
      const box = el.getBoundingClientRect();
      this.hit(this.pointer.x - box.left, this.pointer.y - box.top);
    }
    this.holdTimer = setTimeout(() => this.holdTick(), holdInterval(s) * 1000);
  }

  private stopHold(): void {
    if (this.holdTimer) clearTimeout(this.holdTimer);
    this.holdTimer = null;
    this.holding.set(false);
    window.removeEventListener('pointermove', this.onMove);
    window.removeEventListener('pointerup', this.onRelease);
    window.removeEventListener('pointercancel', this.onRelease);
    window.removeEventListener('blur', this.onRelease);
  }

  /** One drill hit, with its effects at (x, y) inside the asteroid button. */
  private hit(x: number, y: number): void {
    const r = this.game.drill();
    if (!r) return;

    if (r.locked) return;
    if (r.overheated) {
      this.addFloat(x, y, 'OVERHEAT!', '#ff3b3b', true);
      return;
    }

    let shown = 0;
    for (const o of ORES) {
      const amt = r.gained[o.id];
      if (amt > 0.0001) {
        this.addFloat(x + shown * 14, y - shown * 18, `+${this.game.fmt(amt)} ${o.code}`, o.color, r.overdrive);
        shown++;
      }
    }
    if (r.lost > 0.0001 && shown === 0) this.addFloat(x, y, 'CARGO FULL', '#ffd23f', false);
    if (r.dataCore) this.addFloat(x, y - 50, '+1 DATA CORE', '#ff3d9a', true);
    if (r.surveyData > 0) this.addFloat(x - 20, y + 30, `+${this.game.fmt(r.surveyData)} SURVEY DATA`, '#4fe3ff', true);

    if (!this.settings.reducedMotion()) {
      this.burst(x, y, r.cracked ? 22 : r.overdrive ? 8 : 5);
      if (this.settings.settings().screenShake) {
        this.shaking.set(false);
        requestAnimationFrame(() => this.shaking.set(true));
      }
    }
    if (r.cracked) {
      this.flash.set(true);
      setTimeout(() => this.flash.set(false), 250);
    }
  }

  private addFloat(x: number, y: number, text: string, color: string, big: boolean): void {
    const f: FloatText = { id: ++fxId, x, y, text, color, big };
    this.floats.update((l) => [...l.slice(-14), f]);
    setTimeout(() => this.floats.update((l) => l.filter((i) => i.id !== f.id)), 1000);
  }

  private burst(x: number, y: number, count: number): void {
    const a = this.asteroid();
    const colors = a
      ? ORES.filter((o) => a.composition[o.id] > 0.05).map((o) => o.color)
      : ['#d98a4e'];
    const parts: Debris[] = Array.from({ length: count }, () => {
      const ang = Math.random() * Math.PI * 2;
      const dist = 30 + Math.random() * (count > 10 ? 160 : 70);
      return {
        id: ++fxId,
        x,
        y,
        dx: Math.cos(ang) * dist,
        dy: Math.sin(ang) * dist,
        rot: Math.random() * 540 - 270,
        color: colors[Math.floor(Math.random() * colors.length)],
      };
    });
    this.debris.update((l) => [...l.slice(-60), ...parts]);
    const ids = new Set(parts.map((p) => p.id));
    setTimeout(() => this.debris.update((l) => l.filter((p) => !ids.has(p.id))), 700);
  }
}
