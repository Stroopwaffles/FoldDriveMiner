import { Injectable, computed, effect, signal } from '@angular/core';
import { NumberFormat } from '../game/format';
import { readStorage, writeStorage } from './storage';

export interface Settings {
  sfxVolume: number;
  music: boolean;
  musicVolume: number;
  crt: boolean;
  /** 'system' follows the OS reduced-motion setting. */
  reducedMotion: 'system' | 'on' | 'off';
  numberFormat: NumberFormat;
}

const KEY = 'fdm.settings';
const DEFAULTS: Settings = {
  sfxVolume: 0.6,
  music: true,
  musicVolume: 0.5,
  crt: true,
  reducedMotion: 'system',
  numberFormat: 'suffix',
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
