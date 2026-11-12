import { Injectable, computed, effect, signal } from '@angular/core';
import { NumberFormat } from '../game/format';
import { readStorage, writeStorage } from './storage';

export interface Settings {
  sfxVolume: number;
  music: boolean;
  musicVolume: number;
  /** 'auto' cycles through every track; otherwise a track id to loop. */
  musicTrack: string;
  crt: boolean;
  /** 'system' follows the OS reduced-motion setting. */
  reducedMotion: 'system' | 'on' | 'off';
  numberFormat: NumberFormat;
  /** Speaker bleeps when a comm message arrives. */
  commBleeps: boolean;
  /** The asteroid shakes when hit. */
  screenShake: boolean;
  /** Special Technique cut-ins: full, short, or off. */
  cutIns: 'full' | 'short' | 'off';
  /** The mid-run eyecatch card (every 15 minutes of play). */
  eyecatch: boolean;
  /** Quick banners for big moments: convoys, improvements, the Jackal, strikes, new Codex entries. */
  eventCatches: boolean;
  /** Film grain and colour fringing over the screen. */
  filmGrain: boolean;
  autosaveSec: number;
  /** Two-step confirmation before a Fold Jump. */
  confirmJump: boolean;
  /** Interface scale (1 = 100%). */
  uiScale: number;
  /** Flash the tab title for urgent events while the tab is in the background. */
  tabAlerts: boolean;
  /** Browser notifications for urgent events (opt-in; asks permission). */
  notifications: boolean;
}

const KEY = 'fdm.settings';
const DEFAULTS: Settings = {
  sfxVolume: 0.6,
  music: true,
  musicVolume: 0.5,
  musicTrack: 'auto',
  crt: true,
  reducedMotion: 'system',
  numberFormat: 'suffix',
  commBleeps: true,
  screenShake: true,
  cutIns: 'full',
  eyecatch: true,
  eventCatches: true,
  filmGrain: true,
  autosaveSec: 30,
  confirmJump: true,
  uiScale: 1,
  tabAlerts: true,
  notifications: false,
};

@Injectable({ providedIn: 'root' })
export class SettingsService {
  readonly settings = signal<Settings>(this.load());

  private readonly systemReduced = signal(
    typeof matchMedia !== 'undefined' && matchMedia('(prefers-reduced-motion: reduce)').matches,
  );

  readonly reducedMotion = computed(() => {
    const pref = this.settings().reducedMotion;
    return pref === 'system' ? this.systemReduced() : pref === 'on';
  });

  constructor() {
    effect(() => writeStorage(KEY, JSON.stringify(this.settings())));
  }

  update(patch: Partial<Settings>): void {
    this.settings.update((s) => ({ ...s, ...patch }));
  }

  private load(): Settings {
    const raw = readStorage(KEY);
    if (!raw) return { ...DEFAULTS };
    try {
      return { ...DEFAULTS, ...(JSON.parse(raw) as Partial<Settings>) };
    } catch {
      return { ...DEFAULTS };
    }
  }
}
